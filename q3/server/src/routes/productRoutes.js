const express = require('express');
const Product = require('../models/Product');
const asyncHandler = require('../lib/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function validWholeAmount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

router.get('/', asyncHandler(async (req, res) => {
  const products = await Product.find().sort({ name: 1 }).lean();
  return res.json(products);
}));

router.post('/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (
    !name || name.length > 120 || description.length > 500 ||
    !validWholeAmount(body.price) || !validWholeAmount(body.stock)
  ) {
    return res.status(400).json({ message: 'Provide a name, whole-number price, and whole-number stock.' });
  }
  const product = await Product.create({ name, description, price: body.price, stock: body.stock });
  return res.status(201).json(product);
}));

module.exports = router;
