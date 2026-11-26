const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    row: { type: Number, required: true, min: 1, max: 20 },
    number: { type: Number, required: true, min: 1, max: 30 },
    status: { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null },
    revision: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

seatSchema.index({ event: 1, row: 1, number: 1 }, { unique: true });
seatSchema.index({ status: 1, expiresAt: 1 });
seatSchema.index({ heldBy: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('Seat', seatSchema);
