# CartCraft

CartCraft is a small React and Express shop for the Q3 checkout paper. Products, customer carts, and orders live in MongoDB. The browser can show a price, but only the server reads prices and stock when it places an order.

## What is included

- Customer registration and sign-in with JWT, plus an admin-only product form.
- A server-side cart that stores product IDs and quantities; prices come from the product collection.
- Checkout with the personal shipping rule for roll number **714**: shipping is **764 PKR**, free from a **1,714 PKR** subtotal.
- MongoDB transactions for stock changes, order creation, and emptying the cart as one operation.
- An `Idempotency-Key` per checkout attempt. A retry returns the saved order instead of charging stock twice.
- Owner-only order details, admin order access, and transactional cancellation that returns stock once.
- A responsive product, cart, and orders interface. If checkout times out, retrying keeps the same key.
- Sample products and separate seeded admin/customer accounts for a quick local walkthrough.

## Run it locally

Use Node.js 20 or newer. MongoDB must run as a **replica set** because checkout and cancellation use transactions. A local MongoDB installation can be started as a single-node replica set:

```powershell
New-Item -ItemType Directory -Force C:\data\db
mongod --replSet rs0 --dbpath C:\data\db
```

In another terminal, initialize it once:

```powershell
mongosh
```

```javascript
rs.initiate()
```

Then configure and start the API:

```powershell
cd q3\server
Copy-Item .env.example .env
```

Set `JWT_SECRET` to a private random value of at least 32 characters, and change the seed account passwords in `.env`. Keep `.env` private. Seed the admin, demo customer, and sample products, then run the server:

```powershell
npm install
npm run seed
npm run dev
```

In a second terminal, start the React app:

```powershell
cd q3\client
npm install
npm run dev
```

Open <http://localhost:5174>. Sign in with the seeded customer account to shop, or the seeded admin account to create products. The API listens on port 4001.

## Test the checkout rules

The automated tests use small in-memory product and cart arrays, so they run without starting MongoDB:

```powershell
cd q3\server
npm install
npm test
```

They check that the server uses product-record prices instead of request prices, the exact shipping boundary, and safe handling of missing products and oversized totals. The running app still uses MongoDB transactions for stock changes, checkout, and cancellation; those routes require a replica set.

## A few choices, and why

Prices and stock are read from MongoDB inside the checkout transaction, so changing a request body cannot change an order total. Each stock deduction also uses a conditional update that requires enough stock; if a later item fails, the transaction rolls back every earlier deduction and leaves the cart untouched. A unique index on the customer and idempotency key makes retries safe even when the first response is lost. Cancellation updates the order status and restores all items in the same transaction, so a repeated cancel sees the cancelled status and does not add stock again. The browser calculates shipping only to help customers understand the estimate; the server applies the same 764/1,714 rule when it creates the order. The demo seeder and test data are there to make it easy to run the project locally; public registration always creates a customer, while the admin account is created only by the seed script.
