const express = require('express');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Seat = require('../models/Seat');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  bookSeats,
  expireDueSeats,
  getEventWithSeats,
  holdSeat,
  HOLD_DURATION_SECONDS
} = require('../services/seatService');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const events = await Event.find().sort({ date: 1 }).lean();
    return res.json(events);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireRole('organizer'), async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { title, date, rows, seatsPerRow } = body;
    if (
      typeof title !== 'string' || !title.trim() ||
      title.trim().length > 120 ||
      typeof rows !== 'number' || !Number.isInteger(rows) || rows < 1 || rows > 20 ||
      typeof seatsPerRow !== 'number' || !Number.isInteger(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 30 ||
      typeof date !== 'string' || !Number.isFinite(Date.parse(date))
    ) {
      return res.status(400).json({ message: 'Provide a title, valid date, 1-20 rows and 1-30 seats per row.' });
    }

    const session = await mongoose.startSession();
    const seatDocs = [];
    for (let row = 1; row <= rows; row += 1) {
      for (let number = 1; number <= seatsPerRow; number += 1) {
        seatDocs.push({ row, number });
      }
    }
    let event;
    try {
      await session.withTransaction(async () => {
        const [createdEvent] = await Event.create([{
          title: title.trim(),
          date: new Date(date),
          rows,
          seatsPerRow,
          organizer: req.user._id
        }], { session });
        event = createdEvent;
        await Seat.insertMany(seatDocs.map((seat) => ({ ...seat, event: createdEvent._id })), { session });
      });
    } finally {
      await session.endSession();
    }
    return res.status(201).json(event);
  } catch (error) {
    return next(error);
  }
});

router.get('/:eventId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }
    const io = req.app.get('io');
    await expireDueSeats(io, { eventId: req.params.eventId });
    const event = await getEventWithSeats(req.params.eventId, req.user._id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    return res.json(event);
  } catch (error) {
    return next(error);
  }
});

router.post('/:eventId/seats/:seatId/hold', requireRole('customer'), async (req, res, next) => {
  try {
    const { eventId, seatId } = req.params;
    if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(seatId)) {
      return res.status(400).json({ message: 'Invalid event or seat id.' });
    }
    const io = req.app.get('io');
    await expireDueSeats(io, { userId: req.user._id });
    const seat = await holdSeat({
      io,
      eventId,
      seatId,
      userId: req.user._id
    });
    return res.status(201).json({ seat, holdDurationSeconds: HOLD_DURATION_SECONDS });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

router.post('/:eventId/bookings', requireRole('customer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }
    const result = await bookSeats({
      io: req.app.get('io'),
      eventId: req.params.eventId,
      seatIds: req.body && req.body.seatIds,
      userId: req.user._id
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

module.exports = router;
