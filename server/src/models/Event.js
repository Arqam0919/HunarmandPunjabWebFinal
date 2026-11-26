const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    rows: { type: Number, required: true, min: 1, max: 20 },
    seatsPerRow: { type: Number, required: true, min: 1, max: 30 },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
