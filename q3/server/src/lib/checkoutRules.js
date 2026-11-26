const SHIPPING_FEE = 764;
const FREE_SHIPPING_THRESHOLD = 1714;

function priceCartItems(cartItems, products) {
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  let subtotal = 0;
  const items = cartItems.map((line) => {
    const product = productById.get(line.product.toString());
    if (!product) {
      const error = new Error('A product in your cart is no longer available.');
      error.status = 409;
      throw error;
    }

    const lineTotal = product.price * line.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal + lineTotal)) {
      const error = new Error('The order amount is too large to calculate safely.');
      error.status = 400;
      throw error;
    }
    subtotal += lineTotal;
    return {
      product: product._id,
      name: product.name,
      quantity: line.quantity,
      unitPrice: product.price
    };
  });
  return { items, subtotal };
}

function calculateTotals(subtotal) {
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal, shipping, total: subtotal + shipping };
}

module.exports = { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, calculateTotals, priceCartItems };
