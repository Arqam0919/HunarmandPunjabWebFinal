const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenFor(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

router.post('/register', asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (
    !name || name.length > 80 ||
    email.length > 254 || !emailPattern.test(email) ||
    typeof body.password !== 'string' ||
    body.password.length < 8 ||
    Buffer.byteLength(body.password, 'utf8') > 72
  ) {
    return res.status(400).json({ message: 'Enter a name, valid email, and a password of 8-72 bytes.' });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'customer' });
  return res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const user = email ? await User.findOne({ email }).select('+passwordHash') : null;
  if (!user || typeof body.password !== 'string' || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  return res.json({ token: tokenFor(user), user: publicUser(user) });
}));

module.exports = router;
