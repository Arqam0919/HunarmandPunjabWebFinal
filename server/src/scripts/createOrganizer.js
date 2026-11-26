require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const { MONGODB_URI, ORGANIZER_NAME, ORGANIZER_EMAIL, ORGANIZER_PASSWORD } = process.env;
  if (!MONGODB_URI || !ORGANIZER_NAME || !ORGANIZER_EMAIL || !ORGANIZER_PASSWORD) {
    throw new Error('Set MONGODB_URI and all ORGANIZER_* values in .env first.');
  }
  if (ORGANIZER_PASSWORD.length < 8 || Buffer.byteLength(ORGANIZER_PASSWORD, 'utf8') > 72) {
    throw new Error('Organizer password must be 8-72 bytes.');
  }

  try {
    await mongoose.connect(MONGODB_URI);
    const email = ORGANIZER_EMAIL.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'organizer') {
        throw new Error(`The email ${email} is already registered as a customer; configure a different organizer email.`);
      }
      console.log(`Organizer account already exists: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(ORGANIZER_PASSWORD, 12);
    await User.create({ name: ORGANIZER_NAME, email, passwordHash, role: 'organizer' });
    console.log(`Organizer account created: ${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('Could not create organizer:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
