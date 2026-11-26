const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../lib/asyncHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function canAccess(order, user) {
  return order.user.equals(user.id) || user.role === 'admin';
}

router.get('/', asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
  return res.json(orders);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (!canAccess(order, req.user)) return res.status(403).json({ message: 'You cannot view this order.' });
  return res.json(order);
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw httpError(404, 'Order not found.');
      if (!canAccess(order, req.user)) throw httpError(403, 'You cannot cancel this order.');
      if (order.status === 'cancelled') {
        result = { order, restored: false };
        return;
      }

      for (const item of order.items) {
        const product = await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
          { session }
        );
        if (product.matchedCount !== 1) {
          throw httpError(409, 'A product in this order is no longer available for restocking.');
        }
      }

      order.status = 'cancelled';
      await order.save({ session });
      result = { order, restored: true };
    });
  } finally {
    await session.endSession();
  }

  return res.json(result);
}));

module.exports = router;
