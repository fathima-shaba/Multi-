import { Router } from 'express';
import { transaction } from '../db.js';
import { HttpError } from '../http.js';
import { addressId, fields, invalid } from '../auth/validation.js';
import { lockAccount, productColumns, productId, quantity, readCart, readWishlist, writeCartItem } from './cart.js';
import { changeStatus, checkout, orderDetails, orderList, transitions } from './orders.js';
import { expireReservations } from '../payments/reservations.js';

export function commerceRoutes(pool, requireUser) {
  const router = Router();
  router.use(['/cart','/wishlist','/checkout','/orders'],requireUser);
  const mutate = (response, operation) => transaction(pool, async client => {
    const id = response.locals.user.id;
    await lockAccount(client,id);
    return operation(client,id);
  });
  router.get('/cart', async (_request,response) => response.json(await readCart(pool,response.locals.user.id)));
  router.post('/cart/items', async (request,response) => {
    const input = fields(request.body,['productId','quantity']);
    const cart = await mutate(response,async (client,id) => {
      await writeCartItem(client,id,productId(input.productId),quantity(input.quantity),true);
      return readCart(client,id);
    });
    response.status(201).json(cart);
  });
  router.patch('/cart/items/:id', async (request,response) => {
    const input = fields(request.body,['quantity']);
    const cart = await mutate(response,async (client,id) => {
      await writeCartItem(client,id,productId(request.params.id),quantity(input.quantity));
      return readCart(client,id);
    });
    response.json(cart);
  });
  router.delete(['/cart','/cart/items/:id'], async (request,response) => {
    const product = request.params.id === undefined ? null : productId(request.params.id);
    const cart = await mutate(response,async (client,id) => {
      await client.query('DELETE FROM cart_items WHERE user_id=$1 AND ($2::text IS NULL OR product_id=$2)',[id,product]);
      return readCart(client,id);
    });
    response.json(cart);
  });

  router.get('/wishlist', async (_request,response) => response.json({items:await readWishlist(pool,response.locals.user.id)}));
  router.post('/wishlist/items', async (request,response) => {
    const id = productId(fields(request.body,['productId']).productId);
    const items = await mutate(response,async (client,userId) => {
      const { rows:[product] } = await client.query(`SELECT ${productColumns} FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1`,[id]);
      if (!product?.available) throw new HttpError(404,'PRODUCT_NOT_FOUND','Product not found.');
      await client.query('INSERT INTO wishlist_items(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,id]);
      return readWishlist(client,userId);
    });
    response.status(201).json({items});
  });
  router.delete('/wishlist/items/:id', async (request,response) => {
    const id = productId(request.params.id);
    const items = await mutate(response,async (client,userId) => {
      await client.query('DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2',[userId,id]);
      return readWishlist(client,userId);
    });
    response.json({items});
  });
  router.post('/wishlist/items/:id/move', async (request,response) => {
    const product = productId(request.params.id);
    const result = await mutate(response,async (client,userId) => {
      const saved = await client.query('SELECT 1 FROM wishlist_items WHERE user_id=$1 AND product_id=$2',[userId,product]);
      if (!saved.rowCount) throw new HttpError(404,'WISHLIST_ITEM_NOT_FOUND','Saved product not found.');
      await writeCartItem(client,userId,product,1,true);
      await client.query('DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2',[userId,product]);
      return {items:await readWishlist(client,userId),cart:await readCart(client,userId)};
    });
    response.json(result);
  });

  router.post('/checkout', async (request,response) => {
    await expireReservations(pool,response.locals.user.id);
    const { orderId, replayed } = await transaction(pool,client=>checkout(client,response.locals.user.id,request.body));
    response.status(replayed ? 200 : 201).json({orderId});
  });
  router.get('/orders',async (request,response)=>{
    await expireReservations(pool,response.locals.user.id);
    response.json(await orderList(pool,response.locals.user.id,request.query));
  });
  router.get('/orders/:id',async (request,response)=>{
    await expireReservations(pool,response.locals.user.id);
    response.json({order:await orderDetails(pool,addressId(request.params.id),response.locals.user.id)});
  });
  router.post('/orders/:id/cancel',async (request,response)=>{
    const id = addressId(request.params.id);
    const actor = response.locals.user.id;
    await transaction(pool,client=>changeStatus(client,id,'Cancelled',actor,false));
    response.json({order:await orderDetails(pool,id,actor)});
  });
  return router;
}

export function adminOrderRoutes(pool) {
  const router = Router();
  router.get('/orders',async (request,response)=>response.json(await orderList(pool,null,request.query)));
  router.get('/orders/summary', async (_request,response) => {
    const { rows: [summary] } = await pool.query(`SELECT
      (SELECT count(*)::int FROM orders) AS "orderCount",
      COALESCE((SELECT sum(amount_paise) FROM payments WHERE status='Captured'),0)::text AS "collectedPaise"`);
    response.json(summary);
  });
  router.get('/orders/:id',async (request,response)=>response.json({order:await orderDetails(pool,addressId(request.params.id))}));
  router.patch('/orders/:id/status',async (request,response)=>{
    const id = addressId(request.params.id);
    const {status} = fields(request.body,['status']);
    if (typeof status !== 'string' || !Object.hasOwn(transitions,status)) invalid('Invalid order status.');
    await transaction(pool,client=>changeStatus(client,id,status,response.locals.user.id,true));
    response.json({order:await orderDetails(pool,id)});
  });
  return router;
}
