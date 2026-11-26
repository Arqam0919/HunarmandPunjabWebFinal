require('dotenv').config();
const http = require('http');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Event = require('./models/Event');
const User = require('./models/User');
const Seat = require('./models/Seat');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const { expireDueSeats } = require('./services/seatService');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }
});

app.set('io', io);
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required.'));
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired authentication token.'));
  }
});

io.on('connection', (socket) => {
  socket.on('event:join', async (eventId, acknowledge) => {
    try {
      if (!mongoose.isValidObjectId(eventId) || !(await Event.exists({ _id: eventId }))) {
        return acknowledge && acknowledge({ error: 'Event not found.' });
      }
      await socket.join(`event:${eventId}`);
      return acknowledge && acknowledge({ joined: true });
    } catch (error) {
      console.error('Socket room join failed:', error);
      return acknowledge && acknowledge({ error: 'Could not join this event.' });
    }
  });
});

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error('MONGODB_URI and JWT_SECRET must be set.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Event.init(), Seat.init()]);
  await expireDueSeats(io);
  setInterval(() => {
    expireDueSeats(io).catch((error) => console.error('Expired-seat worker failed:', error));
  }, 1000).unref();

  const port = Number(process.env.PORT || 4000);
  server.listen(port, () => console.log(`SeatLock API listening on port ${port}`));
}

start().catch((error) => {
  console.error('SeatLock startup failed:', error);
  process.exitCode = 1;
});
