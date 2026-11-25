import { Router } from 'express';
import { HttpError } from './http.js';

const columns = `
  p.id, c.name AS category, c.id AS "categoryId", p.name, p.description, p.brand,
  p.price_paise AS "pricePaise", p.original_price_paise AS "originalPricePaise",
  p.discount_percent AS discount, p.stock-p.reserved_stock AS stock, p.created_at AS "createdAt",
  p.catalog_metadata AS metadata,
  feedback.rating, feedback."reviewCount",
  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position LIMIT 1) AS image,
  COALESCE((SELECT json_agg(url ORDER BY position) FROM product_images WHERE product_id=p.id), '[]') AS images
`;
const reviewAggregate = `LEFT JOIN LATERAL (
    SELECT round(avg(rating),2)::float AS rating,count(*)::int AS "reviewCount"
    FROM published_product_reviews WHERE product_id=p.id
  ) feedback ON true`;

function readText(query, name, maxLength) {
  const raw = query[name];
  if (raw === undefined) return '';
  if (typeof raw !== 'string' || raw.length > maxLength || raw.includes('\0')) {
    throw new HttpError(400, 'INVALID_QUERY', name + ' must be a string up to ' + maxLength + ' characters.');
  }
  return raw.trim();
}

function readInteger(query, name, defaultValue, min, max) {
  const raw = query[name];
  if (raw === undefined) return defaultValue;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new HttpError(400, 'INVALID_QUERY', name + ' must be an integer from ' + min + ' to ' + max + '.');
  }
  return Number(raw);
}

function serialize({ metadata, ...product }) {
  return { ...metadata, ...product };
}

export function catalogRoutes(pool) {
  const router = Router();
  router.get('/categories', async (_request, response) => {
    const { rows } = await pool.query('SELECT id, name, description FROM categories WHERE active ORDER BY display_order, id');
    response.json({ categories: rows });
  });

  router.get('/products', async (request, response) => {
    const q = readText(request.query, 'q', 120);
    const category = readText(request.query, 'category', 100);
    const limit = readInteger(request.query, 'limit', 50, 1, 100);
    const offset = readInteger(request.query, 'offset', 0, 0, 100000);
    const { rows } = await pool.query(`
      SELECT ${columns}
      FROM products p JOIN categories c ON c.id = p.category_id ${reviewAggregate}
      WHERE p.active AND c.active
        AND ($1 = '' OR strpos(lower(concat_ws(' ', p.name, p.brand, p.description)), lower($1)) > 0)
        AND ($2 = '' OR c.id = lower($2) OR lower(c.name) = lower($2))
      ORDER BY p.display_order, p.id LIMIT $3 OFFSET $4
    `, [q, category, limit + 1, offset]);
    const hasMore = rows.length > limit;
    response.json({ products: rows.slice(0, limit).map(serialize), nextOffset: hasMore ? offset + limit : null });
  });

  router.get('/products/:id', async (request, response) => {
    const { id } = request.params;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new HttpError(400, 'INVALID_PRODUCT_ID', 'Invalid product ID.');
    const { rows } = await pool.query(`
      SELECT ${columns}
      FROM products p JOIN categories c ON c.id = p.category_id ${reviewAggregate}
      WHERE p.active AND c.active AND p.id = $1
    `, [id]);
    if (!rows.length) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    response.json({ product: serialize(rows[0]) });
  });
  return router;
}
