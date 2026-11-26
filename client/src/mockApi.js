const STORAGE_KEY = 'seatlock-demo-data';
const HOLD_DURATION_SECONDS = 60 + 714;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const demoAccounts = [
  {
    id: 'demo-organizer',
    name: 'Demo Organizer',
    email: 'organizer@seatlock.demo',
    password: 'organizer123',
    role: 'organizer'
  },
  {
    id: 'demo-customer',
    name: 'Demo Customer',
    email: 'customer@seatlock.demo',
    password: 'customer123',
    role: 'customer'
  }
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeEvent(title, date, rows, seatsPerRow) {
  return {
    _id: makeId(),
    title,
    date: date.toISOString(),
    rows,
    seatsPerRow,
    organizer: 'demo-organizer',
    seats: Array.from({ length: rows * seatsPerRow }, (_, index) => ({
      id: makeId(),
      row: Math.floor(index / seatsPerRow) + 1,
      number: (index % seatsPerRow) + 1,
      status: 'available',
      expiresAt: null,
      revision: 0,
      mine: false,
      heldBy: null
    }))
  };
}

function initialData() {
  const firstDate = new Date();
  firstDate.setDate(firstDate.getDate() + 5);
  firstDate.setHours(19, 0, 0, 0);
  const secondDate = new Date(firstDate);
  secondDate.setDate(secondDate.getDate() + 9);
  secondDate.setHours(20, 0, 0, 0);

  return {
    users: demoAccounts.map((user) => ({ ...user })),
    events: [
      makeEvent('Live Music Night', firstDate, 4, 6),
      makeEvent('Theatre Under the Stars', secondDate, 3, 5)
    ]
  };
}

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.users) && Array.isArray(saved?.events)) return saved;
  } catch {
    // Replace invalid demo data with a fresh sample set.
  }
  const data = initialData();
  writeData(data);
  return data;
}

function writeData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseBody(options) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return fail('The request contains invalid data.');
  }
}

function userForToken(token, data) {
  const userId = typeof token === 'string' && token.startsWith('demo-token-')
    ? token.slice('demo-token-'.length)
    : '';
  const user = data.users.find((item) => item.id === userId);
  if (!user) return fail('Authentication required. Sign in again.', 401);
  return user;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function authResult(user) {
  return { token: `demo-token-${user.id}`, user: publicUser(user) };
}

function publicEvent(event, user) {
  const { organizer, ...details } = event;
  return {
    ...details,
    seats: event.seats.map(({ heldBy, ...seat }) => ({
      ...seat,
      mine: seat.status === 'held' && heldBy === user.id
    }))
  };
}

function expireHolds(data) {
  const now = Date.now();
  data.events.forEach((event) => {
    event.seats.forEach((seat) => {
      if (seat.status === 'held' && new Date(seat.expiresAt).getTime() <= now) {
        Object.assign(seat, {
          status: 'available',
          heldBy: null,
          expiresAt: null,
          revision: seat.revision + 1
        });
      }
    });
  });
}

function eventForId(data, eventId) {
  const event = data.events.find((item) => item._id === eventId);
  return event || fail('Event not found.', 404);
}

function requireCustomer(user) {
  if (user.role !== 'customer') fail('Only customer accounts can reserve seats.', 403);
}

function requireOrganizer(user) {
  if (user.role !== 'organizer') fail('Only organizer accounts can create events.', 403);
}

function handleAuth(path, options, data) {
  const body = parseBody(options);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (path === '/auth/register') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80 || email.length > 254 || !emailPattern.test(email) ||
      typeof body.password !== 'string' || body.password.length < 8 ||
      new TextEncoder().encode(body.password).length > 72) {
      return fail('Enter a name, valid email, and a password of 8-72 bytes.');
    }
    if (data.users.some((user) => user.email === email)) {
      return fail('An account with that email already exists.', 409);
    }
    const user = { id: makeId(), name, email, password: body.password, role: 'customer' };
    data.users.push(user);
    writeData(data);
    return authResult(user);
  }

  const user = data.users.find((item) => item.email === email && item.password === body.password);
  if (!user) return fail('Email or password is incorrect.', 401);
  return authResult(user);
}

function handleEvents(path, options, data, user) {
  const method = options.method || 'GET';
  const eventPath = path.match(/^\/events\/([^/]+)$/);
  const holdPath = path.match(/^\/events\/([^/]+)\/seats\/([^/]+)\/hold$/);
  const bookingPath = path.match(/^\/events\/([^/]+)\/bookings$/);

  expireHolds(data);

  if (path === '/events' && method === 'GET') {
    return data.events
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(({ seats, ...event }) => event);
  }

  if (path === '/events' && method === 'POST') {
    requireOrganizer(user);
    const body = parseBody(options);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const date = new Date(body.date);
    if (!title || title.length > 120 || !Number.isInteger(body.rows) || body.rows < 1 || body.rows > 20 ||
      !Number.isInteger(body.seatsPerRow) || body.seatsPerRow < 1 || body.seatsPerRow > 30 ||
      !Number.isFinite(date.getTime())) {
      return fail('Provide a title, valid date, 1-20 rows and 1-30 seats per row.');
    }
    const event = makeEvent(title, date, body.rows, body.seatsPerRow);
    data.events.push(event);
    writeData(data);
    const { seats, ...summary } = event;
    return summary;
  }

  if (eventPath && method === 'GET') {
    return publicEvent(eventForId(data, eventPath[1]), user);
  }

  if (holdPath && method === 'POST') {
    requireCustomer(user);
    const event = eventForId(data, holdPath[1]);
    const seat = event.seats.find((item) => item.id === holdPath[2]);
    if (!seat) return fail('Seat not found.', 404);
    if (seat.status === 'booked') return fail('This seat is already booked.', 409);
    const replacingOwnHold = seat.status === 'held' && seat.heldBy === user.id;
    if (seat.status === 'held' && !replacingOwnHold) return fail('This seat is no longer available.', 409);
    const activeHolds = data.events.reduce((count, item) =>
      count + item.seats.filter((heldSeat) => heldSeat.status === 'held' && heldSeat.heldBy === user.id).length, 0);
    if (!replacingOwnHold && activeHolds >= 4) return fail('You can hold at most 4 seats at a time.', 409);
    Object.assign(seat, {
      status: 'held',
      heldBy: user.id,
      expiresAt: new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString(),
      revision: seat.revision + 1
    });
    writeData(data);
    return { seat: publicEvent(event, user).seats.find((item) => item.id === seat.id), holdDurationSeconds: HOLD_DURATION_SECONDS };
  }

  if (bookingPath && method === 'POST') {
    requireCustomer(user);
    const event = eventForId(data, bookingPath[1]);
    const body = parseBody(options);
    const seatIds = body.seatIds;
    if (!Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > 4 ||
      seatIds.some((id) => typeof id !== 'string') || new Set(seatIds).size !== seatIds.length) {
      return fail('Choose between 1 and 4 held seats.');
    }
    const seats = seatIds.map((id) => event.seats.find((item) => item.id === id));
    if (seats.some((seat) => !seat || seat.status !== 'held' || seat.heldBy !== user.id)) {
      return fail('One or more holds have expired or are not yours. Refresh the seat map and try again.', 409);
    }
    seats.forEach((seat) => Object.assign(seat, {
      status: 'booked',
      heldBy: null,
      expiresAt: null,
      revision: seat.revision + 1
    }));
    writeData(data);
    return { message: 'Booking confirmed.', seats: publicEvent(event, user).seats.filter((seat) => seatIds.includes(seat.id)) };
  }

  return fail('The requested demo API route was not found.', 404);
}

export async function mockRequest(path, options = {}) {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const data = readData();
  const method = options.method || 'GET';
  let result;

  if (path === '/auth/register' || path === '/auth/login') {
    if (method !== 'POST') return fail('Method not allowed.', 405);
    result = handleAuth(path, options, data);
  } else {
    const user = userForToken(options.token, data);
    result = handleEvents(path, options, data, user);
    writeData(data);
  }

  return JSON.parse(JSON.stringify(result));
}

export const demoMode = Object.freeze({
  organizerEmail: 'organizer@seatlock.demo',
  organizerPassword: 'organizer123',
  customerEmail: 'customer@seatlock.demo',
  customerPassword: 'customer123'
});
