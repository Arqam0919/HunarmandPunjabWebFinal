const STORAGE_KEY = 'cartcraft-demo-data';
const SHIPPING_FEE = 764;
const FREE_SHIPPING_THRESHOLD = 1714;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sampleAccounts = [
  {
    _id: 'demo-customer',
    name: 'Demo Customer',
    email: 'customer@cartcraft.demo',
    password: 'customer123',
    role: 'customer'
  },
  {
    _id: 'demo-admin',
    name: 'Demo Admin',
    email: 'admin@cartcraft.demo',
    password: 'admin123',
    role: 'admin'
  }
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialData() {
  return {
    users: sampleAccounts.map((user) => ({ ...user })),
    products: [
      { _id: 'sample-backpack', name: 'Canvas Backpack', description: 'Everyday carry with a padded laptop sleeve.', price: 850, stock: 12 },
      { _id: 'sample-mugs', name: 'Ceramic Mug Set', description: 'Two handmade stoneware mugs.', price: 480, stock: 20 },
      { _id: 'sample-lamp', name: 'Desk Lamp', description: 'Warm LED desk lamp with adjustable neck.', price: 1100, stock: 5 }
    ],
    carts: [],
    orders: []
  };
}

function writeData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      Array.isArray(saved?.users) &&
      Array.isArray(saved?.products) &&
      Array.isArray(saved?.carts) &&
      Array.isArray(saved?.orders)
    ) return saved;
  } catch {
    // Reset malformed sample data instead of blocking the demo.
  }
  const data = initialData();
  writeData(data);
  return data;
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
  const user = data.users.find((item) => item._id === userId);
  if (!user) return fail('Authentication required. Sign in again.', 401);
  return user;
}

function requireRole(user, role) {
  if (user.role !== role) fail(`${role} access is required.`, 403);
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

function authResult(user) {
  return { token: `demo-token-${user._id}`, user: publicUser(user) };
}

function cartFor(userId, data) {
  let cart = data.carts.find((item) => item.user === userId);
  if (!cart) {
    cart = { user: userId, items: [] };
    data.carts.push(cart);
  }
  return cart;
}

function cartResponse(cart, data) {
  return {
    items: cart.items.flatMap((line) => {
      const product = data.products.find((item) => item._id === line.productId);
      return product ? [{
        productId: product._id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        quantity: line.quantity,
        lineTotal: product.price * line.quantity
      }] : [];
    })
  };
}

function readIdempotencyKey(options) {
  const header = Object.entries(options.headers || {})
    .find(([name]) => name.toLowerCase() === 'idempotency-key');
  return header ? header[1] : '';
}

function handleAuth(path, options, data) {
  const body = parseBody(options);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (path === '/api/auth/register') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (
      !name || name.length > 80 ||
      email.length > 254 || !emailPattern.test(email) ||
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      new TextEncoder().encode(body.password).length > 72
    ) {
      return fail('Enter a name, valid email, and a password of 8-72 bytes.');
    }
    if (data.users.some((user) => user.email === email)) {
      return fail('An account with that email already exists.', 409);
    }
    const user = {
      _id: makeId(),
      name,
      email,
      password: body.password,
      role: 'customer'
    };
    data.users.push(user);
    writeData(data);
    return authResult(user);
  }

  const user = data.users.find((item) => item.email === email && item.password === body.password);
  if (!user) return fail('Email or password is incorrect.', 401);
  return authResult(user);
}

function handleProducts(method, options, data, user) {
  if (method === 'GET') return data.products.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (method !== 'POST') return fail('Method not allowed.', 405);
  requireRole(user, 'admin');
  const body = parseBody(options);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (
    !name || name.length > 120 || description.length > 500 ||
    !Number.isSafeInteger(body.price) || body.price < 0 ||
    !Number.isSafeInteger(body.stock) || body.stock < 0
  ) {
    return fail('Provide a name, whole-number price, and whole-number stock.');
  }
  const product = { _id: makeId(), name, description, price: body.price, stock: body.stock };
  data.products.push(product);
  writeData(data);
  return product;
}

function handleCart(path, method, options, data, user) {
  requireRole(user, 'customer');
  const cart = cartFor(user._id, data);
  if (path === '/api/cart' && method === 'GET') return cartResponse(cart, data);

  if (path === '/api/cart/items' && method === 'POST') {
    const body = parseBody(options);
    const product = data.products.find((item) => item._id === body.productId);
    if (!product) return fail('Product not found.', 404);
    if (!Number.isSafeInteger(body.quantity) || body.quantity < 1) {
      return fail('Quantity must be a whole number of at least 1.');
    }
    const line = cart.items.find((item) => item.productId === product._id);
    const quantity = (line?.quantity || 0) + body.quantity;
    if (quantity > product.stock) return fail(`Only ${product.stock} ${product.name} available.`);
    if (line) line.quantity = quantity;
    else cart.items.push({ productId: product._id, quantity });
    writeData(data);
    return cartResponse(cart, data);
  }

  const itemPath = path.match(/^\/api\/cart\/items\/([^/]+)$/);
  if (!itemPath) return fail('The requested demo API route was not found.', 404);
  const product = data.products.find((item) => item._id === itemPath[1]);
  const lineIndex = cart.items.findIndex((item) => item.productId === itemPath[1]);
  if (!product || lineIndex < 0) return fail('Cart item or product not found.', 404);

  if (method === 'PUT') {
    const quantity = parseBody(options).quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return fail('Quantity must be a whole number of at least 1.');
    }
    if (quantity > product.stock) return fail(`Only ${product.stock} ${product.name} available.`);
    cart.items[lineIndex].quantity = quantity;
  } else if (method === 'DELETE') {
    cart.items.splice(lineIndex, 1);
  } else {
    return fail('Method not allowed.', 405);
  }
  writeData(data);
  return cartResponse(cart, data);
}

function handleCheckout(options, data, user) {
  requireRole(user, 'customer');
  const idempotencyKey = readIdempotencyKey(options);
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return fail('Send an Idempotency-Key header between 8 and 128 safe characters.');
  }
  const existing = data.orders.find((order) => order.user === user._id && order.idempotencyKey === idempotencyKey);
  if (existing) return { order: existing, replayed: true };

  const cart = cartFor(user._id, data);
  if (!cart.items.length) return fail('Your cart is empty.');
  const orderItems = cart.items.map((line) => {
    const product = data.products.find((item) => item._id === line.productId);
    if (!product) return fail('A product in your cart is no longer available.', 409);
    if (product.stock < line.quantity) return fail(`${product.name} does not have enough stock.`, 409);
    return {
      product: product._id,
      name: product.name,
      quantity: line.quantity,
      unitPrice: product.price
    };
  });
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal)) return fail('The order amount is too large to calculate safely.');
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const order = {
    _id: makeId(),
    user: user._id,
    idempotencyKey,
    items: orderItems,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: 'placed',
    createdAt: new Date().toISOString()
  };

  for (const item of orderItems) {
    const product = data.products.find((entry) => entry._id === item.product);
    product.stock -= item.quantity;
  }
  cart.items = [];
  data.orders.push(order);
  writeData(data);
  return { order, replayed: false };
}

function handleOrders(path, method, data, user) {
  if (path === '/api/orders' && method === 'GET') {
    return data.orders
      .filter((order) => order.user === user._id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const orderPath = path.match(/^\/api\/orders\/([^/]+)(?:\/cancel)?$/);
  if (!orderPath) return fail('The requested demo API route was not found.', 404);
  const order = data.orders.find((item) => item._id === orderPath[1]);
  if (!order) return fail('Order not found.', 404);
  if (order.user !== user._id && user.role !== 'admin') return fail('You cannot view this order.', 403);

  if (path.endsWith('/cancel') && method === 'POST') {
    if (order.status === 'cancelled') return { order, restored: false };
    for (const item of order.items) {
      const product = data.products.find((entry) => entry._id === item.product);
      if (!product) return fail('A product in this order is no longer available for restocking.', 409);
    }
    for (const item of order.items) {
      data.products.find((entry) => entry._id === item.product).stock += item.quantity;
    }
    order.status = 'cancelled';
    writeData(data);
    return { order, restored: true };
  }
  if (method !== 'GET') return fail('Method not allowed.', 405);
  return order;
}

export async function mockRequest(path, options = {}) {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 80));
  const data = readData();
  const method = options.method || 'GET';
  let result;

  if (path === '/api/auth/register' || path === '/api/auth/login') {
    if (method !== 'POST') return fail('Method not allowed.', 405);
    result = handleAuth(path, options, data);
  } else if (path === '/api/products') {
    const user = method === 'GET' ? null : userForToken(options.token, data);
    result = handleProducts(method, options, data, user);
  } else {
    const user = userForToken(options.token, data);
    if (path === '/api/cart' || path.startsWith('/api/cart/items/')) {
      result = handleCart(path, method, options, data, user);
    } else if (path === '/api/cart/items') {
      result = handleCart(path, method, options, data, user);
    } else if (path === '/api/checkout' && method === 'POST') {
      result = handleCheckout(options, data, user);
    } else if (path === '/api/orders' || path.startsWith('/api/orders/')) {
      result = handleOrders(path, method, data, user);
    } else {
      return fail('The requested demo API route was not found.', 404);
    }
  }

  return JSON.parse(JSON.stringify(result));
}

export const demoAccounts = Object.freeze({
  customerEmail: 'customer@cartcraft.demo',
  customerPassword: 'customer123',
  adminEmail: 'admin@cartcraft.demo',
  adminPassword: 'admin123'
});
