const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenFor(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { name, email, password } = body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (
      !normalizedName || normalizedName.length > 80 ||
      normalizedEmail.length > 254 || !emailPattern.test(normalizedEmail) ||
      typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({ message: 'Enter a name, valid email, and a password of 8-72 bytes.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: normalizedName, email: normalizedEmail, passwordHash, role: 'customer' });
    return res.status(201).json({
      token: tokenFor(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { email, password } = body;
    const user = typeof email === 'string'
      ? await User.findOne({ email: email.toLowerCase().trim() })
      : null;
    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return res.json({
      token: tokenFor(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
