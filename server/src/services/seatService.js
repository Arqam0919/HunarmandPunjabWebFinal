const mongoose = require('mongoose');
const Event = require('../models/Event');
const Seat = require('../models/Seat');
const User = require('../models/User');

const HOLD_DURATION_SECONDS = 60 + 714;

function publicSeat(seat, userId) {
  return {
    id: seat._id.toString(),
    row: seat.row,
    number: seat.number,
    status: seat.status,
    expiresAt: seat.expiresAt,
    revision: seat.revision,
    mine: Boolean(seat.heldBy && seat.heldBy.toString() === userId.toString())
  };
}

function emitSeat(io, eventId, seat) {
  io.to(`event:${eventId}`).emit('seat:changed', {
    id: seat._id.toString(),
    row: seat.row,
    number: seat.number,
    status: seat.status,
    expiresAt: seat.expiresAt,
    holderId: seat.heldBy ? seat.heldBy.toString() : null,
    revision: seat.revision
  });
}

function validateSeatIds(seatIds) {
  if (!Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > 4) {
    return 'Choose between 1 and 4 held seats.';
  }
  if (seatIds.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
    return 'Every seat id must be a valid id.';
  }
  if (new Set(seatIds.map((id) => id.toLowerCase())).size !== seatIds.length) {
    return 'The seat list contains duplicates.';
  }
  return null;
}

async function holdSeat({ io, eventId, seatId, userId }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const currentSeat = await Seat.findOne({ _id: seatId, event: eventId }).session(session);
      if (!currentSeat) throw Object.assign(new Error('Seat not found.'), { status: 404 });
      if (currentSeat.status === 'booked') throw Object.assign(new Error('This seat is already booked.'), { status: 409 });

      const replacingOwnHold = currentSeat.status === 'held' &&
        currentSeat.heldBy &&
        currentSeat.heldBy.toString() === userId.toString();
      if (!replacingOwnHold) {
        const counter = await User.findOneAndUpdate(
          { _id: userId, activeHolds: { $lt: 4 } },
          { $inc: { activeHolds: 1 } },
          { new: true, session }
        );
        if (!counter) throw Object.assign(new Error('You can hold at most 4 seats at a time.'), { status: 409 });
      }

      const expiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);
      const seat = await Seat.findOneAndUpdate(
        {
          _id: seatId,
          event: eventId,
          $or: [
            { status: 'available' },
            { status: 'held', $expr: { $lte: ['$expiresAt', '$$NOW'] } }
          ]
        },
        {
          $set: { status: 'held', heldBy: userId, expiresAt },
          $inc: { revision: 1 }
        },
        { new: true, session }
      );
      if (!seat) throw Object.assign(new Error('This seat is no longer available.'), { status: 409 });

      if (currentSeat.status === 'held' && currentSeat.heldBy && !replacingOwnHold) {
        const released = await User.updateOne(
          { _id: currentSeat.heldBy, activeHolds: { $gt: 0 } },
          { $inc: { activeHolds: -1 } },
          { session }
        );
        if (released.modifiedCount !== 1) {
          throw new Error('Previous holder counter is inconsistent; hold was rolled back.');
        }
      }
      result = seat;
    });
  } finally {
    await session.endSession();
  }

  emitSeat(io, eventId, result);
  return publicSeat(result, userId);
}

async function bookSeats({ io, eventId, seatIds, userId }) {
  const validationError = validateSeatIds(seatIds);
  if (validationError) throw Object.assign(new Error(validationError), { status: 400 });

  const session = await mongoose.startSession();
  let booked = [];

  try {
    await session.withTransaction(async () => {
      const heldSeats = await Seat.find({
        _id: { $in: seatIds },
        event: eventId,
        status: 'held',
        heldBy: userId,
        $expr: { $gt: ['$expiresAt', '$$NOW'] }
      }).session(session);

      if (heldSeats.length !== seatIds.length) {
        throw Object.assign(new Error('One or more holds have expired or are not yours. Refresh the seat map and try again.'), { status: 409 });
      }

      const update = await Seat.updateMany(
        {
          _id: { $in: seatIds },
          event: eventId,
          status: 'held',
          heldBy: userId,
          $expr: { $gt: ['$expiresAt', '$$NOW'] }
        },
        {
          $set: { status: 'booked', heldBy: null, expiresAt: null },
          $inc: { revision: 1 }
        },
        { session }
      );
      if (update.modifiedCount !== seatIds.length) {
        throw Object.assign(new Error('A hold ended while booking. No seats were booked.'), { status: 409 });
      }

      const counter = await User.updateOne(
        { _id: userId, activeHolds: { $gte: seatIds.length } },
        { $inc: { activeHolds: -seatIds.length } },
        { session }
      );
      if (counter.modifiedCount !== 1) {
        throw new Error('Seat hold counter is inconsistent; booking was rolled back.');
      }
      booked = await Seat.find({ _id: { $in: seatIds } }).session(session);
    });
  } finally {
    await session.endSession();
  }

  booked.forEach((seat) => emitSeat(io, eventId, seat));
  return { message: 'Booking confirmed.', seats: booked.map((seat) => publicSeat(seat, userId)) };
}

async function expireSeat(io, seatId) {
  const session = await mongoose.startSession();
  let expiredSeat = null;
  try {
    await session.withTransaction(async () => {
      const current = await Seat.findOne({
        _id: seatId,
        status: 'held',
        $expr: { $lte: ['$expiresAt', '$$NOW'] }
      }).session(session);
      if (!current) return;
      const seat = await Seat.findOneAndUpdate(
        { _id: seatId, status: 'held', $expr: { $lte: ['$expiresAt', '$$NOW'] } },
        {
          $set: { status: 'available', heldBy: null, expiresAt: null },
          $inc: { revision: 1 }
        },
        { new: true, session }
      );
      if (!seat) return;

      if (current.heldBy) {
        const released = await User.updateOne(
          { _id: current.heldBy, activeHolds: { $gt: 0 } },
          { $inc: { activeHolds: -1 } },
          { session }
        );
        if (released.modifiedCount !== 1) {
          throw new Error('Expired holder counter is inconsistent; seat release was rolled back.');
        }
      }
      expiredSeat = seat;
    });
  } finally {
    await session.endSession();
  }

  if (expiredSeat) {
    const eventId = expiredSeat.event.toString();
    emitSeat(io, eventId, expiredSeat);
  }
  return expiredSeat;
}

async function expireDueSeats(io, { eventId, userId } = {}) {
  const filter = { status: 'held', expiresAt: { $lte: new Date() } };
  if (eventId) filter.event = eventId;
  if (userId) filter.heldBy = userId;
  const dueSeats = await Seat.find(filter)
    .select('_id')
    .limit(500)
    .lean();
  for (const seat of dueSeats) await expireSeat(io, seat._id);
}

async function getEventWithSeats(eventId, userId) {
  const event = await Event.findById(eventId).lean();
  if (!event) return null;
  const seats = await Seat.find({ event: eventId }).sort({ row: 1, number: 1 }).lean();
  return {
    ...event,
    seats: seats.map((seat) => publicSeat(seat, userId))
  };
}

module.exports = {
  bookSeats,
  expireDueSeats,
  expireSeat,
  getEventWithSeats,
  holdSeat,
  HOLD_DURATION_SECONDS,
  validateSeatIds
};
