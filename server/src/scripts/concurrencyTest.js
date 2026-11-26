require('dotenv').config();

const api = process.env.API_URL || 'http://localhost:4000/api';
const eventId = process.env.TEST_EVENT_ID;
const seatId = process.env.TEST_SEAT_ID;
const emails = (process.env.TEST_CUSTOMER_EMAILS || '').split(',').map((value) => value.trim()).filter(Boolean);
const password = process.env.TEST_CUSTOMER_PASSWORD;

async function post(path, body, token) {
  const response = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  if (!eventId || !seatId || emails.length < 2 || !password) {
    throw new Error('Set TEST_EVENT_ID, TEST_SEAT_ID, at least two TEST_CUSTOMER_EMAILS, and TEST_CUSTOMER_PASSWORD.');
  }
  const accounts = await Promise.all(emails.map(async (email) => {
    const result = await post('/auth/login', { email, password });
    if (result.status !== 200) throw new Error(`Could not log in ${email}: ${JSON.stringify(result.body)}`);
    return { email, token: result.body.token };
  }));

  const results = await Promise.all(accounts.map(({ email, token }) =>
    post(`/events/${eventId}/seats/${seatId}/hold`, {}, token)
      .then((result) => ({ email, ...result }))
  ));
  const winners = results.filter((result) => result.status === 201);
  console.table(results.map(({ email, status, body }) => ({
    email,
    status,
    result: body.message || body.seat.status
  })));
  console.log(`Successful holds: ${winners.length}/${results.length}`);
  if (winners.length !== 1) {
    throw new Error('Expected exactly one successful hold. Ensure the test seat is Available before running.');
  }
}

main().catch((error) => {
  console.error('Concurrency test failed:', error);
  process.exitCode = 1;
});
