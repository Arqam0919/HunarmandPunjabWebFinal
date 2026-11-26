const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculateTotals, priceCartItems } = require('../src/lib/checkoutRules');

const products = [
  { _id: 'backpack-1', name: 'Canvas Backpack', price: 500, stock: 5 },
  { _id: 'mug-set-1', name: 'Ceramic Mug Set', price: 900, stock: 1 }
];

test('checkout prices sample cart lines from product records, not client-supplied prices', () => {
  const cart = [
    { product: 'backpack-1', quantity: 2, price: 1 },
    { product: 'mug-set-1', quantity: 1, price: 1 }
  ];

  const priced = priceCartItems(cart, products);

  assert.equal(priced.subtotal, 1900);
  assert.deepEqual(priced.items.map((item) => item.unitPrice), [500, 900]);
  assert.deepEqual(calculateTotals(priced.subtotal), { subtotal: 1900, shipping: 0, total: 1900 });
});

test('shipping is 764 PKR below 1,714 and free at the threshold', () => {
  assert.deepEqual(calculateTotals(1713), { subtotal: 1713, shipping: 764, total: 2477 });
  assert.deepEqual(calculateTotals(1714), { subtotal: 1714, shipping: 0, total: 1714 });
});

test('checkout rejects a missing product and unsafe order amounts', () => {
  assert.throws(
    () => priceCartItems([{ product: 'missing-product', quantity: 1 }], products),
    (error) => error.status === 409
  );
  assert.throws(
    () => priceCartItems([{ product: 'backpack-1', quantity: Number.MAX_SAFE_INTEGER }], products),
    (error) => error.status === 400
  );
});
