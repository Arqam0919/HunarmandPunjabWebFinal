require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Product.init(), Cart.init(), Order.init()]);

  const port = Number(process.env.PORT || 4001);
  app.listen(port, () => console.log(`CartCraft API listening on port ${port}`));
}

start().catch((error) => {
  console.error('CartCraft startup failed:', error);
  process.exitCode = 1;
});
