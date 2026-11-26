const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../lib/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('customer'));

function parseQuantity(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

async function cartFor(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { items: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function cartResponse(cart) {
  const products = await Product.find({ _id: { $in: cart.items.map((line) => line.product) } }).lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const items = cart.items.flatMap((line) => {
    const product = productById.get(line.product.toString());
    return product ? [{
        productId: product._id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        quantity: line.quantity,
        lineTotal: product.price * line.quantity
      }] : [];
  });
  return { items };
}

router.get('/', asyncHandler(async (req, res) => {
  const cart = await cartFor(req.user.id);
  return res.json(await cartResponse(cart));
}));

router.post('/items', asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!mongoose.isValidObjectId(body.productId) || !parseQuantity(body.quantity)) {
    return res.status(400).json({ message: 'Choose a product and a whole-number quantity of at least 1.' });
  }
  const product = await Product.findById(body.productId);
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const cart = await cartFor(req.user.id);
  const item = cart.items.find((line) => line.product.equals(product._id));
  const quantity = (item ? item.quantity : 0) + body.quantity;
  if (quantity > product.stock) {
    return res.status(400).json({ message: `Only ${product.stock} ${product.name} available.` });
  }
  if (item) item.quantity = quantity;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();
  return res.status(200).json(await cartResponse(cart));
}));

router.put('/items/:productId', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  const quantity = req.body && req.body.quantity;
  if (!parseQuantity(quantity)) {
    return res.status(400).json({ message: 'Quantity must be a whole number of at least 1.' });
  }
  const [cart, product] = await Promise.all([
    Cart.findOne({ user: req.user.id }),
    Product.findById(req.params.productId)
  ]);
  if (!cart || !product) return res.status(404).json({ message: 'Cart item or product not found.' });
  const item = cart.items.find((line) => line.product.equals(product._id));
  if (!item) return res.status(404).json({ message: 'Item is not in your cart.' });
  if (quantity > product.stock) {
    return res.status(400).json({ message: `Only ${product.stock} ${product.name} available.` });
  }
  item.quantity = quantity;
  await cart.save();
  return res.json(await cartResponse(cart));
}));

router.delete('/items/:productId', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ message: 'Cart not found.' });
  cart.items = cart.items.filter((line) => !line.product.equals(req.params.productId));
  await cart.save();
  return res.json(await cartResponse(cart));
}));

module.exports = router;
