async function getCatalog(path, signal) {
  const response = await fetch('/api' + path, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The catalog API is unavailable.');
  }
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'Could not load the catalog.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function toStoreProduct(product) {
  return {
    ...product,
    // The Phase 1 storefront expects rupees; PostgreSQL and the API use integer paise.
    price: product.pricePaise / 100,
    originalPrice: product.originalPricePaise == null ? undefined : product.originalPricePaise / 100,
  };
}

export async function loadProducts({ q = '', category = '' }, signal) {
  const params = new URLSearchParams({ limit: '100' });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  const products = [];
  let offset = 0;
  while (offset !== null) {
    params.set('offset', offset);
    const page = await getCatalog('/products?' + params, signal);
    products.push(...page.products.map(toStoreProduct));
    offset = page.nextOffset;
  }
  return products;
}

export async function loadCatalog(signal) {
  const categoriesRequest = getCatalog('/categories', signal);
  const [{ categories }, products] = await Promise.all([categoriesRequest, loadProducts({}, signal)]);
  return { categories: categories.map(category => category.name), categoryDetails: categories, products };
}

export async function loadProduct(id, signal) {
  const { product } = await getCatalog('/products/' + encodeURIComponent(id), signal);
  return toStoreProduct(product);
}
