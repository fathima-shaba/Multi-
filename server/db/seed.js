import { categories, initialProducts } from '../../src/data/mockData.js';
import { readConfig } from '../src/config.js';
import { createPool, transaction } from '../src/db.js';

function paise(value) {
  const [whole, fraction = ''] = String(value).split('.');
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) throw new Error('Invalid catalog price');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount > 2147483647n) throw new Error('Catalog price exceeds supported range');
  return amount.toString();
}

const pool = createPool(readConfig().databaseUrl);
try {
  const inserted = await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(5321901)');
    const categoryIds = new Map(categories.map((name, index) => [
      name, { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), index },
    ]));
    for (const [name, { id, index }] of categoryIds) {
      await client.query('INSERT INTO categories(id, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, name, index]);
    }
    let count = 0;
    for (const [index, product] of initialProducts.entries()) {
      const { id, name, category, description, brand, price, originalPrice, discount, stock, image, rating,
        reviewCount, sellerId, sellerName, sellerRating, deliveryInfo, returnPolicy, warranty, bankOffers } = product;
      const metadata = { rating, reviewCount, sellerId, sellerName, sellerRating, deliveryInfo, returnPolicy, warranty, bankOffers };
      const result = await client.query(`INSERT INTO products
        (id, category_id, name, description, brand, price_paise, original_price_paise, discount_percent, stock, display_order, catalog_metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [id, categoryIds.get(category).id, name, description, brand, paise(price), originalPrice == null ? null : paise(originalPrice), discount, stock, index, metadata]);
      if (result.rowCount && image) {
        await client.query('INSERT INTO product_images(product_id, url) VALUES ($1, $2)', [id, image]);
      }
      count += result.rowCount;
    }
    return count;
  });
  console.log('Catalog seed complete: ' + inserted + ' new products, ' + categories.length + ' seed categories.');
} catch (error) {
  console.error('Catalog seed failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
