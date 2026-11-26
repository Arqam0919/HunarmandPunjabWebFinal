# SeatLock

Question 3's CartCraft submission is in [q3/](./q3/); the rest of this guide is for the SeatLock Q2 project.

SeatLock is a seat-booking website. Customers can create an account, sign in, and hold or book seats. The organizer signs in with a separate account to create events and seat layouts. The site uses React, Express, MongoDB, and Socket.IO to keep seat updates in sync.

## Required hold time

For this examination, the roll number is **714**. The hold lasts **60 + 714 = 774 seconds**, which is 12 minutes and 54 seconds. This duration is set in the server code.

## Before you start

Install Node.js 18 or newer and MongoDB. MongoDB must run as a **replica set** because SeatLock uses database transactions to safely manage seats.

For a local MongoDB installation on Windows:

1. Create a database folder if you do not already have one:

   ```powershell
   New-Item -ItemType Directory -Force C:\data\db
   ```

2. Start MongoDB in one PowerShell window and leave it running:

   ```powershell
   mongod --replSet rs0 --dbpath C:\data\db
   ```

3. In a second PowerShell window, start the MongoDB shell and initialize the replica set once:

   ```powershell
   mongosh
   ```

   At the `mongosh` prompt, run:

   ```javascript
   rs.initiate()
   ```

You can use a MongoDB Atlas replica-set connection instead. In that case, use its connection string in the server settings below.

## Try the frontend without MongoDB

For a quick frontend demo, start only the client:

```powershell
cd C:\path\to\q2\client
npm ci
Set-Content .env.local "VITE_USE_MOCK_API=true"
npm run dev
```

Open <http://localhost:5173> and use one of these sample accounts:

- Customer: `customer@seatlock.demo` / `customer123`
- Organizer: `organizer@seatlock.demo` / `organizer123`

You can also register a customer account. Demo accounts, events, and seat changes are saved in this browser only. The demo supports event creation, seat holds, and bookings, but it does not run the real API, MongoDB transactions, or cross-browser live updates. Do not enter a real password in demo mode.

The development frontend uses the real API by default. Demo mode is only enabled when `VITE_USE_MOCK_API=true` is set in `client\.env.local`. To switch back to the real API, remove that setting or change it to `false`, then restart the client.

## Start the website

Keep MongoDB running, then open two more PowerShell windows.

### 1. Set up and start the server

In the first window, go to the server folder, make your private settings file, and install the server packages:

```powershell
cd C:\path\to\q2\server
Copy-Item .env.example .env
npm ci
```

Open `server\.env` and set `JWT_SECRET` to a private value that is at least 32 characters long. If you are using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string. Do not share or commit this `.env` file.

Create the organizer account using the name, email, and password in `.env`, then start the server:

```powershell
npm run seed:organizer
npm run dev
```

Leave this window running. The server connects to MongoDB and listens on port 4000.

### 2. Start the website

In the second window, install the website packages and start the development site:

```powershell
cd C:\path\to\q2\client
npm ci
npm run dev
```

Open <http://localhost:5173>. Customers can register from the sign-in page. To use the organizer features, sign in with the organizer email and password from `server\.env`. If you previously enabled frontend demo mode, remove `client\.env.local` or set `VITE_USE_MOCK_API=false`, then restart the client.

### If registration or sign-in does not work

The website needs both the server and MongoDB running. Starting only the website is not enough. Check that the server window says it is listening on port 4000 and that MongoDB is still running as a replica set. You can also open <http://localhost:4000/api/health>; a working server responds with `{"status":"ok"}`.

## Run the tests

The server's input-validation tests do not need MongoDB. From the `server` folder, run:

```powershell
npm test
```

## Check that two customers cannot hold the same seat

This check needs the server and replica-set MongoDB running. First, create an event with an available seat and register at least two customer accounts. In the `server` folder, set the event ID, seat ID, and customer login details in PowerShell, then run the test:

```powershell
$env:TEST_EVENT_ID = "<event id>"
$env:TEST_SEAT_ID = "<available seat id>"
$env:TEST_CUSTOMER_EMAILS = "first@example.com,second@example.com"
$env:TEST_CUSTOMER_PASSWORD = "<shared customer password>"
npm run test:concurrency
```

The test passes when one customer holds the seat and the other is told it is no longer available. Make the seat available again before running the test a second time.

## How seat protection works

- A customer can hold no more than four seats at once.
- A seat can only be held if it is available or its earlier hold has expired.
- Hold times are saved in MongoDB, so restarting the server does not give someone extra time.
- A booking either completes for all selected seats or none of them. Expired, missing, or other customers' holds are rejected.
- Seat changes are sent to connected browsers so customers see updates without refreshing.
