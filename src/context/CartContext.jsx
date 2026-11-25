import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { accountRequest } from '../api/account';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user } = useAuth();
  const owner = user?.id;
  const [cartData, setCart] = useState(null);
  const [wishData, setWish] = useState(null);
  const [revision, setRevision] = useState(0);
  const [busyOwner, setBusy] = useState(null);
  const request = useRef(null);
  const epoch = useRef(0);
  const cart = cartData?.owner === owner ? cartData : null;
  const wish = wishData?.owner === owner ? wishData : null;

  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    const generation = epoch.current;
    const load = (path, save) => accountRequest(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted && generation === epoch.current) save({ owner, data });
    }).catch(error => {
      if (!controller.signal.aborted && generation === epoch.current) save({ owner, error: error.message });
    });
    load('/cart', setCart);
    load('/wishlist', setWish);
    return () => controller.abort();
  }, [owner, revision]);

  useEffect(() => {
    if (!owner) return;
    const onFocus = () => {
      if (!request.current) setRevision(value => value + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [owner]);

  function refresh() {
    epoch.current += 1;
    setCart(null);
    setWish(null);
    setRevision(value => value + 1);
  }

  async function mutate(path, method, body, kind) {
    if (!owner) throw new Error('Sign in to continue.');
    if (request.current?.owner === owner) throw new Error('Please wait for the current update.');
    const operation = { owner };
    epoch.current += 1;
    request.current = operation;
    setBusy(owner);
    try {
      const data = await accountRequest(path, { method, body });
      if (kind === 'move') {
        setCart({ owner, data: data.cart });
        setWish({ owner, data: { items: data.items } });
      } else if (kind === 'wishlist') setWish({ owner, data });
      else setCart({ owner, data });
      return data;
    } finally {
      if (request.current === operation) {
        request.current = null;
        setBusy(null);
      }
    }
  }

  function toggleWishlist(id) {
    const saved = wish?.data?.items.some(item => item.id === id);
    return saved
      ? mutate('/wishlist/items/' + encodeURIComponent(id), 'DELETE', undefined, 'wishlist')
      : mutate('/wishlist/items', 'POST', { productId: id }, 'wishlist');
  }

  return <CartContext.Provider value={{
    cartItems: cart?.data?.items || [], quote: cart?.data, cartLoading: Boolean(owner && !cart), cartError: cart?.error,
    wishlist: wish?.data?.items || [], wishlistLoading: Boolean(owner && !wish), wishlistError: wish?.error,
    busy: Boolean(owner && (busyOwner === owner || !cart || !wish)), refresh, toggleWishlist,
    addToCart: (product, quantity = 1) => mutate('/cart/items', 'POST', { productId: product.id, quantity }),
    updateQuantity: (id, quantity) => mutate('/cart/items/' + encodeURIComponent(id), 'PATCH', { quantity }),
    removeFromCart: id => mutate('/cart/items/' + encodeURIComponent(id), 'DELETE'),
    clearCart: () => mutate('/cart', 'DELETE'),
    removeWishlist: id => mutate('/wishlist/items/' + encodeURIComponent(id), 'DELETE', undefined, 'wishlist'),
    moveWishlist: id => mutate('/wishlist/items/' + encodeURIComponent(id) + '/move', 'POST', undefined, 'move'),
    getCartCount: () => cart?.data?.totals.quantity || 0,
  }}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
