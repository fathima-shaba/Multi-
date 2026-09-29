import { createContext, useContext, useState, useEffect } from 'react';
import { initialProducts, categories as initialCategories, sellers } from '../data/mockData';

const ShopContext = createContext();

export function ShopProvider({ children }) {
  const [products, setProducts] = useState(() => {
    localStorage.setItem('products', JSON.stringify(initialProducts));
    return initialProducts;
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [categories, setCategories] = useState(initialCategories);


  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  // Product Management
  const addProduct = (product) => {
    setProducts([...products, { ...product, id: Date.now().toString(), reviews: [], rating: 0 }]);
  };

  const updateProduct = (id, updatedData) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...updatedData } : p));
  };

  const deleteProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
  };

  // Order Management & Inventory Updates
  const placeOrder = (userId, cartItems, total, shippingDetails) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      userId,
      items: cartItems,
      total,
      shippingDetails,
      date: new Date().toISOString(),
      status: 'Processing' // Processing, Shipped, Delivered, Cancelled
    };
    
    setOrders([newOrder, ...orders]);
    
    // Decrease inventory
    const updatedProducts = products.map(product => {
      const cartItem = cartItems.find(item => item.id === product.id);
      if (cartItem) {
        return { ...product, stock: product.stock - cartItem.quantity };
      }
      return product;
    });
    setProducts(updatedProducts);
    
    return newOrder.id;
  };

  const updateOrderStatus = (orderId, status) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
  };

  // Review & Rating
  const addReview = (productId, review) => {
    setProducts(products.map(p => {
      if (p.id === productId) {
        const newReviews = [...p.reviews, { ...review, id: `rev-${Date.now()}` }];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        return { ...p, reviews: newReviews, rating: avgRating };
      }
      return p;
    }));
  };

  return (
    <ShopContext.Provider value={{
      products, categories, orders, 
      addProduct, updateProduct, deleteProduct,
      placeOrder, updateOrderStatus,
      addReview
    }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}
