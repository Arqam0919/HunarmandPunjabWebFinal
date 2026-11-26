import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { demoAccounts } from './mockApi.js';

const SHIPPING_FEE = 764;
const FREE_SHIPPING_THRESHOLD = 1714;

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('cartcraft-session') || 'null');
  } catch {
    return null;
  }
}

function money(amount) {
  return `${amount.toLocaleString()} PKR`;
}

function AuthForm({ onSignedIn, showError }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function fillDemoAccount(account) {
    setMode('login');
    setEmail(account.email);
    setPassword(account.password);
    showError('');
  }

  async function submit(event) {
    event.preventDefault();
    showError('');
    setBusy(true);
    const body = mode === 'login' ? { email, password } : { name, email, password };
    try {
      const result = await api(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      onSignedIn(result);
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <a className="brand" href="/" aria-label="CartCraft home"><span className="brand-mark">C</span>CartCraft</a>
      <section className="auth-card">
        <p className="eyebrow">A thoughtful little shop</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h1>
        <p className="muted">Sign in to keep your cart and orders in one place.</p>
        <form className="stack-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Your name
              <input name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email address
            <input name="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>
          <button className="button button-primary full-width" type="submit" disabled={busy}>
            {busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API !== 'false' && (
          <div className="demo-accounts">
            <p className="eyebrow">Quick demo sign-in</p>
            <div className="demo-account-row">
              <p>Customer <code>{demoAccounts.customerEmail}</code></p>
              <button type="button" className="demo-fill" onClick={() => fillDemoAccount({ email: demoAccounts.customerEmail, password: demoAccounts.customerPassword })}>Use</button>
            </div>
            <div className="demo-account-row">
              <p>Admin <code>{demoAccounts.adminEmail}</code></p>
              <button type="button" className="demo-fill" onClick={() => fillDemoAccount({ email: demoAccounts.adminEmail, password: demoAccounts.adminPassword })}>Use</button>
            </div>
            <small>Demo data stays in this browser. Don't use a real password here.</small>
          </div>
        )}
        <p className="switch-mode">
          {mode === 'login' ? 'New to CartCraft?' : 'Already have an account?'}{' '}
          <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  );
}

function ProductCard({ product, onAdd, isCustomer }) {
  return (
    <article className="product-card">
      <div className="product-art" aria-hidden="true">
        <span>{product.name.slice(0, 1).toUpperCase()}</span>
      </div>
      <div className="product-details">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <span className="price">{money(product.price)}</span>
        </div>
        <p className="muted">{product.description || 'A useful find, chosen with care.'}</p>
        <div className="product-footer">
          <span className={product.stock > 0 ? 'stock' : 'stock out'}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
          {isCustomer && (
            <button className="button button-outline" onClick={() => onAdd(product)} disabled={product.stock < 1}>
              Add to cart <span aria-hidden="true">+</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CartPage({ cart, onQuantity, onRemove, onCheckout, busy, canRetry }) {
  const subtotal = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  if (cart.items.length === 0) {
    return (
      <section className="empty-state">
        <span className="empty-icon">♡</span>
        <h2>Your cart is taking a breather.</h2>
        <p className="muted">Find something you love and it will be waiting here.</p>
      </section>
    );
  }

  return (
    <div className="cart-layout">
      <section className="cart-lines">
        {cart.items.map((item) => (
          <article className="cart-line" key={item.productId}>
            <div className="line-art">{item.name.slice(0, 1).toUpperCase()}</div>
            <div className="line-info">
              <h3>{item.name}</h3>
              <span className="muted">{money(item.price)} each</span>
            </div>
            <label className="quantity-control">
              <span className="sr-only">Quantity for {item.name}</span>
              <input
                type="number"
                min="1"
                max={item.stock}
                value={item.quantity}
                onChange={(event) => onQuantity(item, Number(event.target.value))}
              />
            </label>
            <strong className="line-total">{money(item.lineTotal)}</strong>
            <button className="remove-button" onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}>×</button>
          </article>
        ))}
      </section>
      <aside className="summary-card">
        <p className="eyebrow">The numbers</p>
        <h2>Order summary</h2>
        <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <div className="summary-row"><span>Shipping</span><strong>{shipping === 0 ? 'Free' : money(shipping)}</strong></div>
        <p className="shipping-note">
          {shipping === 0
            ? 'You unlocked free shipping. Nice.'
            : `${money(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.`}
        </p>
        <div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div>
        <button className="button button-primary full-width" onClick={onCheckout} disabled={busy}>
          {busy ? 'Placing your order…' : canRetry ? 'Retry checkout' : 'Checkout'}
        </button>
        <p className="secure-note">Prices and stock are confirmed securely at checkout.</p>
      </aside>
    </div>
  );
}

function OrdersPage({ orders, onCancel, cancelling }) {
  if (orders.length === 0) {
    return (
      <section className="empty-state">
        <span className="empty-icon">↗</span>
        <h2>No orders just yet.</h2>
        <p className="muted">Your next good find is only a click away.</p>
      </section>
    );
  }
  return (
    <section className="orders-list">
      {orders.map((order) => (
        <article className="order-card" key={order._id}>
          <div className="order-top">
            <div>
              <p className="eyebrow">Order {order._id.slice(-8).toUpperCase()}</p>
              <h3>{new Date(order.createdAt).toLocaleString()}</h3>
            </div>
            <span className={`status-pill ${order.status}`}>{order.status}</span>
          </div>
          <div className="order-items">
            {order.items.map((item) => (
              <div className="order-item" key={`${item.product}-${item.name}`}>
                <span>{item.name} <span className="muted">× {item.quantity}</span></span>
                <span>{money(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="order-bottom">
            <span className="muted">Subtotal {money(order.subtotal)} · Shipping {order.shipping === 0 ? 'Free' : money(order.shipping)}</span>
            <strong>{money(order.total)}</strong>
          </div>
          {order.status === 'placed' && (
            <button className="text-button cancel-order" onClick={() => onCancel(order)} disabled={cancelling}>
              Cancel order
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

function AdminProductForm({ token, onCreated, showError }) {
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    showError('');
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api('/api/products', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: values.get('name'),
          description: values.get('description'),
          price: Number(values.get('price')),
          stock: Number(values.get('stock'))
        })
      });
      form.reset();
      await onCreated();
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div>
        <p className="eyebrow">For the shopkeeper</p>
        <h2>Add a product</h2>
      </div>
      <label>Name<input name="name" required maxLength={120} /></label>
      <label>Description<input name="description" maxLength={500} /></label>
      <label>Price (PKR)<input name="price" type="number" min="0" step="1" required /></label>
      <label>Stock<input name="stock" type="number" min="0" step="1" required /></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
    </form>
  );
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [page, setPage] = useState('products');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [] });
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const checkoutKey = useRef(null);
  const checkoutLock = useRef(false);
  const isCustomer = session?.user?.role === 'customer';

  const refresh = useCallback(async () => {
    if (!session?.token) return;
    try {
      const [nextProducts, nextCart, nextOrders] = await Promise.all([
        api('/api/products'),
        isCustomer ? api('/api/cart', { token: session.token }) : Promise.resolve({ items: [] }),
        api('/api/orders', { token: session.token })
      ]);
      setProducts(nextProducts);
      setCart(nextCart);
      setOrders(nextOrders);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [session, isCustomer]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function signIn(result) {
    const nextSession = { token: result.token, user: result.user };
    localStorage.setItem('cartcraft-session', JSON.stringify(nextSession));
    setSession(nextSession);
    setError('');
  }

  function signOut() {
    localStorage.removeItem('cartcraft-session');
    setSession(null);
    setProducts([]);
    setCart({ items: [] });
    setOrders([]);
    setPage('products');
    checkoutKey.current = null;
  }

  async function addToCart(product) {
    setError('');
    try {
      setCart(await api('/api/cart/items', {
        token: session.token,
        method: 'POST',
        body: JSON.stringify({ productId: product._id, quantity: 1 })
      }));
      setNotice(`${product.name} added to your cart.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeQuantity(item, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.stock) return;
    setError('');
    try {
      setCart(await api(`/api/cart/items/${item.productId}`, {
        token: session.token,
        method: 'PUT',
        body: JSON.stringify({ quantity })
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeItem(item) {
    setError('');
    try {
      setCart(await api(`/api/cart/items/${item.productId}`, {
        token: session.token,
        method: 'DELETE'
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function checkout() {
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    if (!checkoutKey.current) checkoutKey.current = crypto.randomUUID();
    try {
      const result = await api('/api/checkout', {
        token: session.token,
        method: 'POST',
        headers: { 'Idempotency-Key': checkoutKey.current },
        body: JSON.stringify({})
      });
      checkoutKey.current = null;
      setNotice(`Order ${result.order._id.slice(-8).toUpperCase()} is in. Thanks for shopping small.`);
      await refresh();
      setPage('orders');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      checkoutLock.current = false;
      setBusy(false);
    }
  }

  async function cancelOrder(order) {
    setCancelling(true);
    setError('');
    try {
      await api(`/api/orders/${order._id}/cancel`, { token: session.token, method: 'POST' });
      setNotice('Your order was cancelled and the items returned to stock.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCancelling(false);
    }
  }

  if (!session?.token || !session?.user) {
    return <AuthForm onSignedIn={signIn} showError={(message) => { setError(message); setNotice(''); }} />;
  }

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setPage('products'); }}>
          <span className="brand-mark">C</span>CartCraft
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={page === 'products' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('products')}>Shop</button>
          {isCustomer && (
            <button className={page === 'cart' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('cart')}>
              Cart <span className="cart-count">{cartCount}</span>
            </button>
          )}
          <button className={page === 'orders' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('orders')}>Orders</button>
        </nav>
        <div className="account-menu">
          <span className="welcome">Hi, {session.user.name.split(' ')[0]}</span>
          <button className="sign-out" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="page-content">
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
        {page === 'products' && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">Good things, picked for you</p>
                <h1>Small joys.<br /><em>Thoughtfully found.</em></h1>
                <p className="hero-copy">Useful, lovely pieces for the everyday. Take a look around.</p>
              </div>
              <div className="hero-stamp" aria-hidden="true"><span>MADE FOR<br />EVERY DAY</span><b>✳</b></div>
            </section>
            {session.user.role === 'admin' && (
              <AdminProductForm token={session.token} onCreated={refresh} showError={setError} />
            )}
            <section className="catalog">
              <div className="section-heading">
                <div><p className="eyebrow">The collection</p><h2>Find your next favourite</h2></div>
                <span className="muted">{products.length} {products.length === 1 ? 'piece' : 'pieces'}</span>
              </div>
              {products.length === 0
                ? <p className="muted">No products yet. Sign in as an admin to add the first one.</p>
                : <div className="product-grid">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} isCustomer={isCustomer} onAdd={addToCart} />
                  ))}
                </div>}
            </section>
          </>
        )}
        {page === 'cart' && isCustomer && (
          <>
            <section className="page-heading"><p className="eyebrow">Nearly yours</p><h1>Your cart</h1></section>
            <CartPage
              cart={cart}
              onQuantity={changeQuantity}
              onRemove={removeItem}
              onCheckout={checkout}
              busy={busy}
              canRetry={Boolean(checkoutKey.current)}
            />
          </>
        )}
        {page === 'orders' && (
          <>
            <section className="page-heading"><p className="eyebrow">A little history</p><h1>Your orders</h1></section>
            <OrdersPage orders={orders} onCancel={cancelOrder} cancelling={cancelling} />
          </>
        )}
      </main>
      <footer className="footer">
        <span>CartCraft</span><span>Carefully chosen. Happily yours.</span>
      </footer>
    </div>
  );
}
