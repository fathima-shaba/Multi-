import { createContext, useContext, useState, useEffect } from 'react';

const ShopContext = createContext();

const initialProducts = [
  {
    id: '1',
    name: 'Wireless Noise-Cancelling Headphones',
    description: 'Premium over-ear headphones with active noise cancellation and 30-hour battery life.',
    price: 299.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
    stock: 15,
    rating: 4.8,
    reviews: [
      { id: 'r1', userId: 'user1', userName: 'Alice', rating: 5, text: 'Amazing sound quality!' },
      { id: 'r2', userId: 'user2', userName: 'Bob', rating: 4, text: 'Very comfortable, but a bit pricey.' }
    ]
  },
  {
    id: '2',
    name: 'Minimalist Mechanical Keyboard',
    description: 'Tenkeyless mechanical keyboard with tactile switches and RGB backlighting.',
    price: 129.50,
    category: 'Computers',
    image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800',
    stock: 8,
    rating: 4.5,
    reviews: []
  },
  {
    id: '3',
    name: 'Smart Fitness Watch',
    description: 'Track your health, sleep, and workouts with this sleek waterproof smartwatch.',
    price: 199.00,
    category: 'Wearables',
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&q=80&w=800',
    stock: 25,
    rating: 4.2,
    reviews: []
  },
  {
    id: '4',
    name: 'Ergonomic Office Chair',
    description: 'Comfortable mesh chair with lumbar support and adjustable armrests.',
    price: 249.99,
    category: 'Furniture',
    image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&q=80&w=800',
    stock: 5,
    rating: 4.7,
    reviews: []
  }
];

export function ShopProvider({ children }) {
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : initialProducts;
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [categories, setCategories] = useState(['All', 'Electronics', 'Computers', 'Wearables', 'Furniture']);

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
