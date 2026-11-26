import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { baseUrl, request } from './api.js';

function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await request(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onLogin(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">S</div>
        <p className="eyebrow">LIVE EVENT SEATING</p>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">Sign in to find an event and reserve your seats.</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          )}
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password<input type="password" minLength="8" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="text-button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
          {mode === 'login' ? 'New to SeatLock? Create an account' : 'Already registered? Sign in'}
        </button>
      </div>
    </main>
  );
}

function OrganizerPanel({ token, onCreated }) {
  const [form, setForm] = useState({ title: '', date: '', rows: 5, seatsPerRow: 8 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createEvent(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const created = await request('/events', {
        token,
        method: 'POST',
        body: JSON.stringify({ ...form, date: new Date(form.date).toISOString() })
      });
      onCreated(created);
      setForm({ title: '', date: '', rows: 5, seatsPerRow: 8 });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="organizer-form" onSubmit={createEvent}>
      <div className="section-heading">
        <div><p className="eyebrow">ORGANIZER TOOLS</p><h2>Create an event</h2></div>
      </div>
      <div className="form-grid">
        <label>Event title<input required maxLength="120" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Date and time<input required type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>Rows<input required type="number" min="1" max="20" value={form.rows} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} /></label>
        <label>Seats per row<input required type="number" min="1" max="30" value={form.seatsPerRow} onChange={(e) => setForm({ ...form, seatsPerRow: Number(e.target.value) })} /></label>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create seat map'}</button>
    </form>
  );
}

function EventView({ eventId, token, user }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    const socket = io(baseUrl.replace(/\/api\/?$/, ''), { auth: { token } });
    request(`/events/${eventId}`, { token })
      .then((data) => { if (active) setEvent(data); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    socket.emit('event:join', eventId, (result) => {
      if (result?.error) setError(result.error);
    });
    socket.on('seat:changed', (changed) => {
      setEvent((current) => current && ({
        ...current,
        seats: current.seats.map((seat) => seat.id === changed.id
          ? { ...seat, status: changed.status, expiresAt: changed.expiresAt, mine: false }
          : seat)
      }));
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [eventId, token]);

  async function takeSeat(seat) {
    setError('');
    setNotice('');
    try {
      const result = await request(`/events/${eventId}/seats/${seat.id}/hold`, { token, method: 'POST', body: '{}' });
      setEvent((current) => ({
        ...current,
        seats: current.seats.map((item) => item.id === seat.id ? result.seat : item)
      }));
      setNotice(`Seat ${seat.row}-${seat.number} held for ${Math.floor(result.holdDurationSeconds / 60)} minutes ${result.holdDurationSeconds % 60} seconds.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function bookSeats() {
    const seatIds = event.seats.filter((seat) => seat.mine && seat.status === 'held').map((seat) => seat.id);
    setError('');
    setNotice('');
    try {
      const result = await request(`/events/${eventId}/bookings`, {
        token,
        method: 'POST',
        body: JSON.stringify({ seatIds })
      });
      setNotice(result.message);
      const refreshed = await request(`/events/${eventId}`, { token });
      setEvent(refreshed);
    } catch (requestError) {
      setError(requestError.message);
      const refreshed = await request(`/events/${eventId}`, { token }).catch(() => null);
      if (refreshed) setEvent(refreshed);
    }
  }

  if (!event) return <p className="muted">{error || 'Loading live seat map…'}</p>;
  const myHeldSeats = event.seats.filter((seat) => seat.mine && seat.status === 'held');

  return (
    <section className="event-view">
      <div className="section-heading">
        <div><p className="eyebrow">LIVE SEAT MAP</p><h2>{event.title}</h2><p className="muted">{new Date(event.date).toLocaleString()}</p></div>
        <span className="live-pill"><i /> Live updates</span>
      </div>
      <div className="legend">
        <span><i className="available-dot" /> Available</span>
        <span><i className="held-dot" /> Held</span>
        <span><i className="mine-dot" /> Yours</span>
        <span><i className="booked-dot" /> Booked</span>
      </div>
      <div className="stage">STAGE</div>
      <div className="seat-map">
        {event.seats.map((seat) => {
          const remaining = seat.expiresAt ? Math.max(0, Math.ceil((new Date(seat.expiresAt).getTime() - now) / 1000)) : null;
          const label = seat.mine && seat.status === 'held'
            ? `Yours · ${remaining}s`
            : seat.status === 'held' ? 'Held'
              : seat.status === 'booked' ? 'Booked' : 'Available';
          return (
            <button
              key={seat.id}
              className={`seat seat-${seat.status}${seat.mine ? ' seat-mine' : ''}`}
              disabled={user.role !== 'customer' || seat.status !== 'available'}
              onClick={() => takeSeat(seat)}
              title={`Row ${seat.row}, seat ${seat.number}: ${label}`}
            >
              <span>{seat.row}-{seat.number}</span>
              <small>{label}</small>
            </button>
          );
        })}
      </div>
      <div className="booking-bar">
        <p>{myHeldSeats.length} of 4 seats held by you</p>
        <button className="primary" disabled={user.role !== 'customer' || myHeldSeats.length === 0} onClick={bookSeats}>Confirm booking</button>
      </div>
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {user.role !== 'customer' && <p className="muted">Organizer accounts can manage events; customer accounts reserve seats.</p>}
    </section>
  );
}

function Dashboard({ auth, onLogout }) {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    request('/events', { token: auth.token })
      .then(setEvents)
      .catch((requestError) => setError(requestError.message));
  }, [auth.token]);

  function addEvent(event) {
    setEvents((current) => [...current, event].sort((a, b) => new Date(a.date) - new Date(b.date)));
    setSelectedId(event._id);
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSelectedId(''); }}>seatlock<span>.</span></a>
        <div className="account"><span>{auth.user.name} <small>{auth.user.role}</small></span><button className="outline" onClick={onLogout}>Sign out</button></div>
      </header>
      <div className="content">
        {!selectedId ? (
          <>
            <div className="hero">
              <p className="eyebrow">YOUR NEXT LIVE EXPERIENCE</p>
              <h1>Find your<br /><span>perfect seat.</span></h1>
              <p className="muted">Choose an event, hold seats securely, and confirm before your timer runs out.</p>
            </div>
            {auth.user.role === 'organizer' && <OrganizerPanel token={auth.token} onCreated={addEvent} />}
            <section className="events-section">
              <div className="section-heading"><div><p className="eyebrow">THE LINEUP</p><h2>Upcoming events</h2></div><span className="event-count">{events.length} events</span></div>
              {error && <p className="error">{error}</p>}
              <div className="event-list">
                {events.map((event) => (
                  <button className="event-card" key={event._id} onClick={() => setSelectedId(event._id)}>
                    <span className="calendar"><b>{new Date(event.date).toLocaleDateString('en', { day: '2-digit' })}</b><small>{new Date(event.date).toLocaleDateString('en', { month: 'short' })}</small></span>
                    <span className="event-info"><b>{event.title}</b><small>{new Date(event.date).toLocaleString()}</small></span>
                    <span className="arrow">↗</span>
                  </button>
                ))}
                {events.length === 0 && <p className="empty-state">No events yet. Organizers can publish the first one above.</p>}
              </div>
            </section>
          </>
        ) : (
          <div className="selected-event">
            <button className="back-button" onClick={() => setSelectedId('')}>← All events</button>
            <EventView eventId={selectedId} token={auth.token} user={auth.user} />
          </div>
        )}
      </div>
      <footer>SEATLOCK · FAIR ACCESS, EVERY TIME</footer>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('seatlock-auth')); } catch { return null; }
  });

  function login(result) {
    const next = { token: result.token, user: result.user };
    localStorage.setItem('seatlock-auth', JSON.stringify(next));
    setAuth(next);
  }

  function logout() {
    localStorage.removeItem('seatlock-auth');
    setAuth(null);
  }

  return auth
    ? <Dashboard auth={auth} onLogout={logout} />
    : <AuthForm onLogin={login} />;
}
