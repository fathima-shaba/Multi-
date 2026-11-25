import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { transaction } from '../db.js';
import { HttpError } from '../http.js';
import { fields, invalid, text } from '../auth/validation.js';
import { changeStock, missingProduct } from './inventory.js';
import { auditAdmin } from './activity.js';

const productColumns = `p.id, p.name, p.description, p.brand, p.category_id AS "categoryId", c.name AS category,
  c.active AS "categoryActive", p.price_paise AS "pricePaise", p.original_price_paise AS "originalPricePaise",
  p.active, p.stock,p.reserved_stock AS "reservedStock",p.stock-p.reserved_stock AS "availableStock", COALESCE((SELECT json_agg(url ORDER BY position)
    FROM product_images WHERE product_id = p.id), '[]') AS images`;
const maxInteger = 2147483647;
const missingCategory = () => new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
const conflict = message => new HttpError(409, 'CATALOG_CONFLICT', message);

function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) invalid('Invalid identifier.');
  return value;
}

function integer(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum || value > maxInteger) invalid(label + ' is outside the supported integer range.');
  return value;
}

function active(value) {
  if (typeof value !== 'boolean') invalid('Availability must be true or false.');
  return value;
}

function imageUrls(value) {
  if (!Array.isArray(value) || value.length > 6) invalid('Provide up to six distinct image URLs.');
  const urls = value.map(raw => {
    const url = text(raw, 'Image URL', 8, 1500);
    const parsed = URL.parse(url);
    if (!parsed || !/^https?:\/\//.test(url) || parsed.username || parsed.password ||
      !['http:', 'https:'].includes(parsed.protocol)) invalid('Use an HTTP or HTTPS image URL without credentials.');
    return url;
  });
  if (new Set(urls).size !== urls.length) invalid('Image URLs must be distinct.');
  return urls;
}

function getFilters(query) {
  const q = query.q === undefined ? '' : text(query.q, 'Search', 0, 120);
  const category = query.category === undefined || query.category === '' ? '' : id(query.category);
  const status = query.status ?? 'all';
  if (!['all', 'available', 'unavailable', 'low', 'out'].includes(status)) invalid('Invalid status filter.');
  const offset = query.offset ?? '0';
  if (typeof offset !== 'string' || !/^\d{1,6}$/.test(offset) || Number(offset) > 100000) invalid('Invalid page offset.');
  return [q, category, status, Number(offset)];
}

async function productsPage(client, query) {
  const params = getFilters(query);
  const { rows } = await client.query(`SELECT ${productColumns} FROM products p JOIN categories c ON c.id=p.category_id
    WHERE ($1='' OR strpos(lower(concat_ws(' ', p.id, p.name, p.brand, p.description)), lower($1)) > 0)
      AND ($2='' OR p.category_id=$2)
      AND ($3='all' OR ($3='available' AND p.active AND c.active)
        OR ($3='unavailable' AND NOT (p.active AND c.active))
        OR ($3='low' AND p.stock-p.reserved_stock BETWEEN 1 AND 5) OR ($3='out' AND p.stock=p.reserved_stock))
    ORDER BY p.display_order DESC, p.id LIMIT 26 OFFSET $4`, params);
  return { products: rows.slice(0, 25), nextOffset: rows.length > 25 ? params[3] + 25 : null };
}

async function getProduct(client, productId) {
  const { rows: [product] } = await client.query(`SELECT ${productColumns} FROM products p
    JOIN categories c ON c.id=p.category_id WHERE p.id=$1`, [productId]);
  return product;
}

async function saveProduct(client, productId, input, actorId) {
  const creating = !productId;
  if (!creating) {
    const { rowCount } = await client.query('SELECT 1 FROM products WHERE id=$1 FOR UPDATE', [productId]);
    if (!rowCount) throw missingProduct();
  }
  const existing = creating ? null : await getProduct(client, productId);
  const stock = input.stock === undefined ? undefined : integer(input.stock, 'Stock');
  const product = {
    name: input.name === undefined && existing ? existing.name : text(input.name, 'Name', 1, 200),
    description: input.description === undefined && existing ? existing.description : text(input.description, 'Description', 1, 4000),
    brand: input.brand === undefined ? existing?.brand ?? '' : text(input.brand, 'Brand', 0, 100),
    categoryId: input.categoryId === undefined && existing ? existing.categoryId : id(input.categoryId),
    price: input.pricePaise === undefined && existing ? existing.pricePaise : integer(input.pricePaise, 'Price'),
    originalPrice: input.originalPricePaise === undefined ? existing?.originalPricePaise ?? null :
      input.originalPricePaise === null ? null : integer(input.originalPricePaise, 'Regular price'),
    active: input.active === undefined ? existing?.active ?? true : active(input.active),
  };
  const images = input.images === undefined ? null : imageUrls(input.images);
  if (product.originalPrice !== null && product.originalPrice < product.price) invalid('Regular price must be at least the selling price.');
  const discount = product.originalPrice > product.price
    ? Number((BigInt(product.originalPrice - product.price) * 100n + BigInt(product.originalPrice) / 2n) / BigInt(product.originalPrice)) : 0;
  const { rows: [category] } = await client.query('SELECT active, archived_at FROM categories WHERE id=$1 FOR UPDATE', [product.categoryId]);
  if (!category) throw missingCategory();
  if (category.archived_at && (product.active || product.categoryId !== existing?.categoryId)) {
    throw conflict('Choose a category that has not been removed.');
  }

  const key = productId ?? randomUUID();
  const values = [key, product.name, product.description, product.brand, product.categoryId,
    product.price, product.originalPrice, discount, product.active];
  if (creating) {
    await client.query(`INSERT INTO products(id,name,description,brand,category_id,price_paise,
      original_price_paise,discount_percent,active,display_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT COALESCE(max(display_order),0)+1 FROM products))`, values);
  } else {
    await client.query(`UPDATE products SET name=$2, description=$3, brand=$4, category_id=$5, price_paise=$6,
      original_price_paise=$7, discount_percent=$8, active=$9, updated_at=now() WHERE id=$1`, values);
  }
  if (images !== null) {
    await client.query('DELETE FROM product_images WHERE product_id=$1', [key]);
    for (const [position, url] of images.entries()) {
      await client.query('INSERT INTO product_images(product_id,url,position) VALUES ($1,$2,$3)', [key, url, position]);
    }
  }
  if (stock !== undefined) {
    await changeStock(client, {
      productId: key, quantity: stock, actorId,
      reason: creating ? 'Initial stock' : text(input.stockReason, 'Stock adjustment reason', 3, 250),
    });
    if (stock !== (existing?.stock ?? 0)) await auditAdmin(client,actorId,'stock.adjusted','product',key);
  }
  await auditAdmin(client,actorId,creating?'product.created':'product.updated','product',key);
  return getProduct(client, key);
}

const productFields = ['name', 'description', 'brand', 'categoryId', 'pricePaise', 'originalPricePaise', 'active', 'images', 'stock', 'stockReason'];

export function adminCatalogRoutes(pool) {
  const router = Router();
  router.get('/products', async (request, response) => response.json(await productsPage(pool, request.query)));
  router.post('/products', async (request, response) => {
    const input = fields(request.body, productFields);
    const product = await transaction(pool, client => saveProduct(client, null, input, response.locals.user.id));
    response.status(201).json({ product });
  });
  router.patch('/products/:id', async (request, response) => {
    const input = fields(request.body, productFields);
    if (!Object.keys(input).length) invalid('Provide product changes.');
    const product = await transaction(pool, client => saveProduct(client, id(request.params.id), input, response.locals.user.id));
    response.json({ product });
  });
  router.delete('/products/:id', async (request, response) => {
    const key=id(request.params.id);
    await transaction(pool,async client=>{
      const result = await client.query('UPDATE products SET active=false, updated_at=now() WHERE id=$1', [key]);
      if (!result.rowCount) throw missingProduct();
      await auditAdmin(client,response.locals.user.id,'product.archived','product',key);
    });
    response.sendStatus(204);
  });

  router.get('/categories', async (_request, response) => {
    const { rows } = await pool.query(`SELECT c.id,c.name,c.description,c.active,
      count(p.id)::int AS "productCount", count(p.id) FILTER (WHERE p.active)::int AS "activeProductCount"
      FROM categories c LEFT JOIN products p ON p.category_id=c.id WHERE c.archived_at IS NULL
      GROUP BY c.id ORDER BY c.display_order,c.id`);
    response.json({ categories: rows });
  });
  router.post('/categories', async (request, response) => {
    const input = fields(request.body, ['name','description','active']);
    const name = text(input.name, 'Name', 1, 100);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
    const key = slug || randomUUID();
    const description = input.description === undefined ? '' : text(input.description, 'Description', 0, 1000);
    try {
      const category=await transaction(pool,async client=>{
        const { rows: [record] } = await client.query(`INSERT INTO categories(id,name,description,active,display_order)
        VALUES ($1,$2,$3,$4,(SELECT COALESCE(max(display_order),0)+1 FROM categories))
        RETURNING id,name,description,active`, [key, name, description, input.active === undefined ? true : active(input.active)]);
        await auditAdmin(client,response.locals.user.id,'category.created','category',record.id);
        return record;
      });
      response.status(201).json({ category });
    } catch (error) {
      if (error.code === '23505') throw conflict('A category already uses this name or URL identifier.');
      throw error;
    }
  });
  router.patch('/categories/:id', async (request, response) => {
    const input = fields(request.body, ['name','description','active']);
    if (!Object.keys(input).length) invalid('Provide category changes.');
    try {
      const category=await transaction(pool,async client=>{
        const { rows: [record] } = await client.query(`UPDATE categories SET name=COALESCE($2,name),
        description=COALESCE($3,description),active=COALESCE($4,active),updated_at=now()
        WHERE id=$1 AND archived_at IS NULL RETURNING id,name,description,active`,
      [id(request.params.id), input.name === undefined ? null : text(input.name, 'Name', 1, 100),
        input.description === undefined ? null : text(input.description, 'Description', 0, 1000),
        input.active === undefined ? null : active(input.active)]);
        if (!record) throw missingCategory();
        await auditAdmin(client,response.locals.user.id,'category.updated','category',record.id);
        return record;
      });
      response.json({ category });
    } catch (error) {
      if (error.code === '23505') throw conflict('A category already uses this name.');
      throw error;
    }
  });
  router.delete('/categories/:id', async (request, response) => {
    const key = id(request.params.id);
    await transaction(pool, async client => {
      const category = await client.query('SELECT 1 FROM categories WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [key]);
      if (!category.rowCount) throw missingCategory();
      const products = await client.query('SELECT 1 FROM products WHERE category_id=$1 AND active LIMIT 1', [key]);
      if (products.rowCount) throw conflict('Archive or reassign the active products before removing this category.');
      await client.query('UPDATE categories SET active=false, archived_at=now(), updated_at=now() WHERE id=$1', [key]);
      await auditAdmin(client,response.locals.user.id,'category.archived','category',key);
    });
    response.sendStatus(204);
  });

  router.get('/inventory', async (request, response) => {
    const [items, count] = await Promise.all([
      productsPage(pool, request.query),
      pool.query(`SELECT count(*) FILTER (WHERE stock-reserved_stock BETWEEN 1 AND 5)::int AS low,
        count(*) FILTER (WHERE stock=reserved_stock)::int AS "outOfStock" FROM products WHERE active`),
    ]);
    response.json({ ...items, summary: count.rows[0] });
  });
  router.post('/inventory/adjustments', async (request, response) => {
    const input = fields(request.body, ['productId', 'delta', 'reason']);
    const delta = integer(input.delta, 'Adjustment', -maxInteger);
    if (!delta) invalid('Adjustment cannot be zero.');
    const key=id(input.productId),actorId=response.locals.user.id;
    const stock = await transaction(pool,async client=>{
      const value=await changeStock(client,{productId:key,delta,reason:text(input.reason,'Reason',3,250),actorId});
      await auditAdmin(client,actorId,'stock.adjusted','product',key);
      return value;
    });
    response.json({ stock });
  });
  router.get('/inventory/transactions', async (request, response) => {
    const productId = request.query.productId === undefined ? null : id(request.query.productId);
    const { rows } = await pool.query(`SELECT t.id, t.product_id AS "productId", p.name AS "productName",
      t.delta,t.reason,t.created_at AS "createdAt",t.actor_user_id AS "actorId",u.name AS "actorName"
      FROM inventory_transactions t JOIN products p ON p.id=t.product_id LEFT JOIN users u ON u.id=t.actor_user_id
      WHERE ($1::text IS NULL OR p.id=$1) ORDER BY t.created_at DESC,t.id DESC LIMIT 100`, [productId]);
    response.json({ transactions: rows });
  });
  return router;
}
