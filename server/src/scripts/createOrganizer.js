require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const { MONGODB_URI, ORGANIZER_NAME, ORGANIZER_EMAIL, ORGANIZER_PASSWORD } = process.env;
  if (!MONGODB_URI || !ORGANIZER_NAME || !ORGANIZER_EMAIL || !ORGANIZER_PASSWORD) {
    throw new Error('Set MONGODB_URI and all ORGANIZER_* values in .env first.');
  }
  if (ORGANIZER_PASSWORD.length < 8) throw new Error('Organizer password must be at least 8 characters.');

  await mongoose.connect(MONGODB_URI);
  const email = ORGANIZER_EMAIL.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(ORGANIZER_PASSWORD, 12);
  await User.updateOne(
    { email },
    { $setOnInsert: { name: ORGANIZER_NAME, email, passwordHash, role: 'organizer' } },
    { upsert: true }
  );
  console.log(`Organizer account ready: ${email}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Could not create organizer:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
