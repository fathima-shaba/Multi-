import { createContext, useContext, useState, useEffect } from 'react';
import { loadCatalog } from '../api/catalog';

const ShopContext = createContext();

export function ShopProvider({ children }) {
  const [catalog, setCatalog] = useState({ products: [], categories: [], categoryDetails: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const products = catalog.products;

  useEffect(() => {
    const controller = new AbortController();
    loadCatalog(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setCatalog(result);
      setCatalogError('');
      setCatalogLoading(false);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setCatalogError('Could not load the catalog. Please try again.');
      setCatalogLoading(false);
    });
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => {
    const refresh = () => setCatalogAttempt(attempt => attempt + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const retryCatalog = () => {
    setCatalogError('');
    setCatalogLoading(true);
    setCatalogAttempt(attempt => attempt + 1);
  };

  return (
    <ShopContext.Provider value={{
      products, categories: catalog.categories, categoryDetails: catalog.categoryDetails,
      catalogLoading, catalogError, retryCatalog, catalogAttempt
    }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}
