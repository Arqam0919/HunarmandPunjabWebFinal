const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
      unitPrice: { type: Number, required: true, min: 0, validate: Number.isInteger }
    }],
    subtotal: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shipping: { type: Number, required: true, min: 0, validate: Number.isInteger },
    total: { type: Number, required: true, min: 0, validate: Number.isInteger },
    status: { type: String, enum: ['placed', 'cancelled'], default: 'placed' }
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
