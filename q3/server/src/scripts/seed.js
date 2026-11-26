require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');

const demoProducts = [
  { name: 'Canvas Backpack', description: 'Everyday carry with a padded laptop sleeve.', price: 850, stock: 12 },
  { name: 'Ceramic Mug Set', description: 'Two handmade stoneware mugs.', price: 480, stock: 20 },
  { name: 'Desk Lamp', description: 'Warm LED desk lamp with adjustable neck.', price: 1100, stock: 5 }
];

async function upsertUser({ name, email, password, role }) {
  if (!name || !email || !password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(`Set a valid name, email, and 8-72 byte password for the ${role} seed account.`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { name: name.trim(), passwordHash, role } },
    { upsert: true, runValidators: true }
  );
}

async function seed() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Product.init()]);
  await upsertUser({
    name: process.env.SEED_ADMIN_NAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    role: 'admin'
  });
  await upsertUser({
    name: process.env.SEED_CUSTOMER_NAME,
    email: process.env.SEED_CUSTOMER_EMAIL,
    password: process.env.SEED_CUSTOMER_PASSWORD,
    role: 'customer'
  });
  for (const product of demoProducts) {
    await Product.updateOne(
      { name: product.name },
      { $setOnInsert: product },
      { upsert: true, runValidators: true }
    );
  }
  console.log('Seeded the admin, demo customer, and sample products.');
}

seed()
  .catch((error) => {
    console.error('CartCraft seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
