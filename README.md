# SeatLock

SeatLock is a React, Express, MongoDB and Socket.IO event-seat booking app. The hold duration is **774 seconds** (60 + N, using N = 714 from the numeric suffix of the supplied roll number).

## Requirements

- Node.js 18 or newer
- MongoDB running as a replica set (transactions are required for safe multi-document hold/booking changes)

For a local single-node MongoDB replica set, start MongoDB with `--replSet rs0`, then run `mongosh` and execute `rs.initiate()`. MongoDB Atlas replica-set clusters also work.

## Setup

1. In `server/`, copy `.env.example` to `.env`. Set a strong `JWT_SECRET`, MongoDB URI, and organizer credentials.
2. Install and start the API:

   ```powershell
   cd server
   npm install
   npm run seed:organizer
   npm run dev
   ```

3. In a second terminal, install and start React:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`. Register customer accounts from the sign-in screen. Sign in as the configured organizer to create an event and seat grid.

## Concurrency test

Create an event and ensure its target seat is Available. Register at least two customers using the same password (8+ characters), then run the test from `server/` in PowerShell:

```powershell
$env:TEST_EVENT_ID = "<event id>"
$env:TEST_SEAT_ID = "<available seat id>"
$env:TEST_CUSTOMER_EMAILS = "first@example.com,second@example.com"
$env:TEST_CUSTOMER_PASSWORD = "<shared customer password>"
npm run test:concurrency
```

The script sends simultaneous hold requests and passes only when exactly one request succeeds. Reset/recreate the test seat to Available before running it again.

## Correctness notes

- A seat is claimed with a conditional MongoDB update that only matches Available seats or expired holds. The four-seat cap is enforced by an atomic per-user counter in the same transaction.
- Hold expiry is stored in MongoDB. A worker releases due holds and broadcasts changes; startup also processes expired holds, so a server restart does not extend them.
- Booking changes every selected hold and the hold counter in one transaction. If a hold is expired, missing, or belongs to someone else, the booking is rejected without booking any of the requested seats.
- Organizers are provisioned with the seed script; public registration always creates Customer accounts.
