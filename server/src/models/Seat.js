const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    row: { type: Number, required: true },
    number: { type: Number, required: true },
    status: { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

seatSchema.index({ event: 1, row: 1, number: 1 }, { unique: true });
seatSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Seat', seatSchema);
