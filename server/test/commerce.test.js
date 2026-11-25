import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

const pool = createPool(readConfig().databaseUrl);
const origin = 'http://localhost:5173';
const suffix = randomUUID().slice(0,8);
const userIds = [];
const fixtureProducts = [];
const originalStock = new Map();
const credentials = new Map();
const shipping = { recipient:'Test Shopper', phone:'9123456780', addressLine:'12 Sample Street', city:'Pune', state:'Maharashtra', pincode:'411001' };
let server, base, first, second, admin;

async function hit(path, { method='GET', status=200, cookie, body, csrf=true }={}) {
  const response = await fetch(base+path,{ method, headers:{
    ...(method==='GET'||!csrf ? {} : { Origin:origin,'X-MultiStore-Request':'1' }),
    ...(cookie ? { Cookie:cookie } : {}),
    ...(body === undefined ? {} : { 'Content-Type':'application/json' }),
  }, body:body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status===204 ? null : await response.json();
  if (status !== null) assert.equal(response.status,status,data?.error?.message);
  return { data, status:response.status, cookie:response.headers.get('set-cookie')?.split(';')[0] };
}
const get = (path, cookie, status=200) => hit(path,{cookie,status});
const write = (method,path,cookie,body,status=200) => hit(path,{method,cookie,body,status});
const add = (cookie,id,quantity=1,status=201) => write('POST','/cart/items',cookie,{productId:id,quantity},status);
const stock = async id => (await pool.query('SELECT stock FROM products WHERE id=$1',[id])).rows[0].stock;
const checkoutBody = quote => ({ address:shipping, quoteVersion:quote.quoteVersion,idempotencyKey:randomUUID() });
const checkout = (cookie,body,status=201) => write('POST','/checkout',cookie,body,status);
const clear = cookie => write('DELETE','/cart',cookie);
const detail = (cookie,id) => get('/orders/'+id,cookie);
const change = (id,status,expected=200) => write('PATCH','/admin/orders/'+id+'/status',admin,{status},expected);

async function account(role) {
  const email=role+'-'+randomUUID()+'@example.test', password=randomUUID();
  const {rows:[user]} = await pool.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
    [email,'Commerce Test '+suffix,await hashPassword(password),role]);
  userIds.push(user.id);
  const cookie = (await write('POST','/auth/login',undefined,{email,password})).cookie;
  credentials.set(cookie,{email,password});
  return cookie;
}

async function product(label, units, paise=77777) {
  const id='phase5-'+label+'-'+suffix;
  await pool.query("INSERT INTO products(id,name,description,category_id,price_paise,stock) VALUES($1,$2,'Isolated test fixture','electronics',$3,$4)",[id,id,paise,units]);
  fixtureProducts.push(id);
  return id;
}

before(async()=>{
  server=createApp({pool,origins:[origin]}).listen(0,'127.0.0.1');
  await once(server,'listening');
  base='http://127.0.0.1:'+server.address().port+'/api';
  first=await account('customer'); second=await account('customer'); admin=await account('admin');
  for (const id of ['1','7','295']) originalStock.set(id,await stock(id));
});
after(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  try {
    if (userIds.length) {
      const filter=' WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::uuid[]))';
      for (const table of ['inventory_transactions','order_status_events','payments','order_items'])
        await pool.query('DELETE FROM '+table+filter,[userIds]);
      await pool.query('DELETE FROM orders WHERE user_id=ANY($1::uuid[])',[userIds]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[userIds]);
    }
    if (fixtureProducts.length) await pool.query('DELETE FROM products WHERE id=ANY($1::text[])',[fixtureProducts]);
    for (const [id,units] of originalStock) await pool.query('UPDATE products SET stock=$2 WHERE id=$1',[id,units]);
  } finally { await pool.end(); }
});

test('account-scoped cart and wishlist reject unsafe writes and preserve server totals',async()=>{
  await get('/cart',undefined,401);
  await get('/admin/orders',undefined,401);
  await get('/admin/orders',first,403);
  await hit('/cart/items',{method:'POST',cookie:first,body:{productId:'1',quantity:1},csrf:false,status:403});
  await add(first,'1',0,400);
  await add(first,'1',originalStock.get('1')+1,409);
  await write('POST','/cart/items',first,{productId:'1',quantity:1,pricePaise:1},400);
  await add(first,'7');
  const secondLine=await add(first,'295');
  assert.equal(secondLine.data.totals.totalPaise,47700);
  const updated=await write('PATCH','/cart/items/7',first,{quantity:2});
  assert.deepEqual(updated.data.totals,{quantity:3,mrpPaise:224100,subtotalPaise:68600,discountPaise:155500,deliveryPaise:0,totalPaise:68600});
  assert.equal((await get('/cart',first)).data.totals.totalPaise,68600);
  assert.equal((await get('/cart',second)).data.items.length,0);
  await write('PATCH','/cart/items/7',second,{quantity:1},404);
  await write('DELETE','/cart/items/7',second);
  assert.equal((await get('/cart',first)).data.items.length,2);
  await write('DELETE','/cart/items/295',first);
  assert.equal((await get('/cart',first)).data.items.length,1);
  await clear(first);
  const saved=await write('POST','/wishlist/items',first,{productId:'1'},201);
  const duplicate=await write('POST','/wishlist/items',first,{productId:'1'},201);
  assert.equal(saved.data.items.length,1); assert.equal(duplicate.data.items.length,1);
  await add(first,'7');
  const secondDevice=(await write('POST','/auth/login',undefined,credentials.get(first))).cookie;
  assert.equal((await get('/wishlist',secondDevice)).data.items[0].id,'1');
  assert.equal((await get('/cart',secondDevice)).data.items[0].id,'7');
  await clear(secondDevice);
  assert.deepEqual((await get('/wishlist',second)).data.items,[]);
  const moved=await write('POST','/wishlist/items/1/move',first);
  assert.equal(moved.data.cart.totals.totalPaise,1686300);
  assert.deepEqual(moved.data.items,[]);
  const archived=await product('archived',0);
  await write('POST','/wishlist/items',first,{productId:archived},201);
  await write('POST','/wishlist/items/'+archived+'/move',first,undefined,409);
  await pool.query('UPDATE products SET active=false WHERE id=$1',[archived]);
  assert.equal((await get('/wishlist',first)).data.items[0].available,false);
  await write('POST','/wishlist/items/'+archived+'/move',first,undefined,409);
  await write('DELETE','/wishlist/items/'+archived,first);
});

test('checkout snapshots ₹16,863 and ₹686, rejects quote manipulation and honors status transitions',async()=>{
  const single=(await get('/cart',first)).data;
  const body=checkoutBody(single);
  await checkout(first,{...body,totalPaise:1},400);
  await checkout(first,{...body,quoteVersion:'0'.repeat(64)},409);
  const saved=(await write('POST','/addresses',first,shipping,201)).data.address.id;
  await checkout(second,{addressId:saved,quoteVersion:(await add(second,'1')).data.quoteVersion,idempotencyKey:randomUUID()},404);
  await clear(second);
  const savedRequest={addressId:saved,quoteVersion:single.quoteVersion,idempotencyKey:body.idempotencyKey};
  const duplicates=await Promise.all([checkout(first,savedRequest,null),checkout(first,savedRequest,null)]);
  assert.deepEqual(duplicates.map(result=>result.status).sort(),[200,201]);
  const {orderId}=duplicates[0].data;
  assert.equal(duplicates[1].data.orderId,orderId);
  await checkout(first,body,409);
  assert.equal(await stock('1'),originalStock.get('1')-1);
  assert.equal((await get('/cart',first)).data.items.length,0);
  const order=(await detail(first,orderId)).data.order;
  assert.equal(order.totalPaise,1686300);
  assert.equal(order.shippingAddress.pincode,'411001');
  await get('/orders/'+orderId,second,404);
  await write('POST','/orders/'+orderId+'/cancel',second,undefined,404);
  await change(orderId,'Delivered',409);
  await change(orderId,'Processing');
  await change(orderId,'Shipped');
  await write('POST','/orders/'+orderId+'/cancel',first,undefined,409);
  await change(orderId,'Delivered');
  const delivered=(await get('/admin/orders/'+orderId,admin)).data.order;
  assert.deepEqual(delivered.timeline.map(event=>event.status),['Pending','Processing','Shipped','Delivered']);
  assert.equal(delivered.timeline[1].actorId,userIds[2]);
  assert.equal(delivered.paymentStatus,'Pending');
  assert.equal((await get('/admin/orders?q='+encodeURIComponent(delivered.customer.email)+'&status=Delivered',admin)).data.orders[0].id,orderId);
  await add(first,'7',2); const multi=(await add(first,'295')).data;
  const multiple=(await checkout(first,checkoutBody(multi))).data.orderId;
  const receipt=(await detail(first,multiple)).data.order;
  assert.equal(receipt.totalPaise,68600); assert.equal(receipt.items.length,2);
  assert.equal((await get('/orders',first)).data.orders.length,2);
});

test('simultaneous checkout cannot oversell and simultaneous cancellation restores inventory once',async()=>{
  const id=await product('last-unit',1);
  const a=await add(first,id), b=await add(second,id);
  const firstBody=checkoutBody(a.data), secondBody=checkoutBody(b.data);
  const outcomes=await Promise.all([checkout(first,firstBody,null),checkout(second,secondBody,null)]);
  assert.deepEqual(outcomes.map(x=>x.status).sort(),[201,409]);
  assert.equal(await stock(id),0);
  const winnerIndex=outcomes.findIndex(x=>x.status===201);
  const winner=winnerIndex===0?first:second;
  const orderId=outcomes[winnerIndex].data.orderId;
  const replayed=await checkout(winner,winnerIndex===0?firstBody:secondBody,200);
  assert.equal(replayed.data.orderId,orderId);
  await pool.query("UPDATE products SET name='Renamed fixture',price_paise=99999,active=false WHERE id=$1",[id]);
  const archived=(await detail(winner,orderId)).data.order;
  assert.equal(archived.items[0].name,id);
  assert.equal(archived.items[0].pricePaise,77777);
  await Promise.all([write('POST','/orders/'+orderId+'/cancel',winner),change(orderId,'Cancelled')]);
  assert.equal(await stock(id),1);
  const {rows}=await pool.query('SELECT delta FROM inventory_transactions WHERE order_id=$1 ORDER BY created_at',[orderId]);
  assert.deepEqual(rows.map(row=>row.delta),[-1,1]);
  const cancelled=(await detail(winner,orderId)).data.order;
  assert.equal(cancelled.paymentStatus,'Cancelled');
  assert.deepEqual(cancelled.timeline.map(event=>event.status),['Pending','Cancelled']);
  await clear(first); await clear(second);
});

test('a failure after stock deduction rolls back order, stock, ledger and cart changes',async()=>{
  const id=await product('rollback',2,88888);
  const {data}=await add(first,id);
  await pool.query('UPDATE products SET price_paise=88889 WHERE id=$1',[id]);
  assert.equal((await checkout(first,checkoutBody(data),409)).data.error.code,'QUOTE_CHANGED');
  await pool.query('UPDATE products SET price_paise=88888 WHERE id=$1',[id]);
  const orderCount=(await get('/orders',first)).data.orders.length;
  await pool.query(`CREATE FUNCTION phase5_test_fail_payment() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.amount_paise=88888 THEN RAISE EXCEPTION 'Test rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER phase5_test_payments_failure BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION phase5_test_fail_payment()`);
  try {
    await checkout(first,checkoutBody(data),500);
    assert.equal(await stock(id),2);
    assert.equal((await get('/cart',first)).data.items[0].id,id);
    assert.equal((await get('/orders',first)).data.orders.length,orderCount);
    const {rows:[row]}=await pool.query(`SELECT (SELECT count(*)::int FROM order_items WHERE product_id=$1) AS items,
      (SELECT count(*)::int FROM inventory_transactions WHERE product_id=$1) AS movements`,[id]);
    assert.deepEqual(row,{items:0,movements:0});
  } finally {
    await pool.query('DROP TRIGGER phase5_test_payments_failure ON payments; DROP FUNCTION phase5_test_fail_payment()');
  }
});
