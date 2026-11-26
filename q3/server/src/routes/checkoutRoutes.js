const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../lib/asyncHandler');
const { calculateTotals, priceCartItems } = require('../lib/checkoutRules');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('customer'));

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

router.post('/', asyncHandler(async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return res.status(400).json({ message: 'Send an Idempotency-Key header between 8 and 128 safe characters.' });
  }

  const existingOrder = await Order.findOne({ user: req.user.id, idempotencyKey });
  if (existingOrder) return res.status(200).json({ order: existingOrder, replayed: true });

  const session = await mongoose.startSession();
  let createdOrder;
  try {
    await session.withTransaction(async () => {
      const replay = await Order.findOne({ user: req.user.id, idempotencyKey }).session(session);
      if (replay) {
        createdOrder = replay;
        return;
      }

      const cart = await Cart.findOne({ user: req.user.id }).session(session);
      if (!cart || cart.items.length === 0) throw httpError(400, 'Your cart is empty.');

      const products = [];
      for (const line of cart.items) {
        const product = await Product.findById(line.product).session(session);
        if (!product) throw httpError(409, 'A product in your cart is no longer available.');
        products.push(product);
      }

      const { items: orderItems, subtotal } = priceCartItems(cart.items, products);
      for (let index = 0; index < cart.items.length; index += 1) {
        const line = cart.items[index];
        const product = products[index];

        const stockUpdate = await Product.updateOne(
          { _id: product._id, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity } },
          { session }
        );
        if (stockUpdate.matchedCount !== 1) {
          throw httpError(409, `${product.name} does not have enough stock.`);
        }
      }

      const totals = calculateTotals(subtotal);
      createdOrder = new Order({
        user: req.user.id,
        idempotencyKey,
        items: orderItems,
        ...totals,
        status: 'placed'
      });
      await createdOrder.save({ session });
      cart.items = [];
      await cart.save({ session });
    });
  } catch (error) {
    if (error.code === 11000) {
      const replay = await Order.findOne({ user: req.user.id, idempotencyKey });
      if (replay) return res.status(200).json({ order: replay, replayed: true });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return res.status(201).json({ order: createdOrder, replayed: false });
}));

module.exports = router;
