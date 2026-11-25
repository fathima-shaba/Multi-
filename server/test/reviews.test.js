import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after,before,test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

const pool=createPool(readConfig().databaseUrl);
const origin='http://localhost:5173';
const ids=[], fixtureProducts=[];
const beforeStock=new Map();
const shipping={recipient:'Review Test',phone:'9123456780',addressLine:'12 Fixture Lane',city:'Pune',state:'Maharashtra',pincode:'411001'};
let server,base,first,second,unpaid,admin,reviewId,otherReview,delivered;

async function request(path,{method='GET',cookie,body,status=200,csrf=true}={}) {
  const response=await fetch(base+path,{method,headers:{
    ...(method==='GET'||!csrf?{}:{Origin:origin,'X-MultiStore-Request':'1'}),...(cookie?{Cookie:cookie}:{}),
    ...(body?{'Content-Type':'application/json'}:{})},body:body&&JSON.stringify(body)});
  const data=response.status===204?null:await response.json();
  if (status!==null) assert.equal(response.status,status,data?.error?.message);
  return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const get=(path,cookie,status=200)=>request(path,{cookie,status});
const write=(method,path,cookie,body,status=200)=>request(path,{method,cookie,body,status});
const post=(product,cookie,rating,body,status=201)=>write('POST','/products/'+product+'/reviews',cookie,{rating,body},status);
const summary=async product=>(await get('/products/'+product+'/review-summary')).data.summary;

async function session(name,role='customer') {
  const email=randomUUID()+'@example.test',password=randomUUID();
  const {rows:[user]}=await pool.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
    [email,name,await hashPassword(password),role]);
  ids.push(user.id);
  const login=await write('POST','/auth/login',undefined,{email,password});
  return {id:user.id,email,cookie:login.cookie};
}

async function cod(user,product,delivery=false) {
  const cart=(await write('POST','/cart/items',user.cookie,{productId:product,quantity:1},201)).data;
  const {orderId}=(await write('POST','/checkout',user.cookie,{address:shipping,quoteVersion:cart.quoteVersion,idempotencyKey:randomUUID()},201)).data;
  if (delivery) {
    for(const status of ['Processing','Shipped','Delivered']) await write('PATCH','/admin/orders/'+orderId+'/status',admin.cookie,{status});
  }
  return orderId;
}

async function onlineFixture(user,product,status) {
  const {rows:[order]}=await pool.query(`INSERT INTO orders(user_id,order_number,status,subtotal_paise,delivery_paise,
    total_paise,shipping_snapshot,payment_method,finalized_at)
    VALUES($1,$2,'Delivered',100,0,100,'{}','razorpay',now()) RETURNING id`,[user.id,'FIXTURE-'+randomUUID()]);
  await pool.query(`INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_paise)
    VALUES($1,$2,'Synthetic test item',1,100)`,[order.id,product]);
  await pool.query("INSERT INTO payments(order_id,provider,status,amount_paise) VALUES($1,'razorpay',$2,100)",[order.id,status]);
  return order.id;
}

before(async()=>{
  // This suite provisions multiple buyers on one loopback IP.
  server=createApp({pool,origins:[origin],sessionOptions:{rateLimit:30}}).listen(0,'127.0.0.1');
  await once(server,'listening');base='http://127.0.0.1:'+server.address().port+'/api';
  first=await session('Verified Reviewer');
  second=await session('private-name@example.test');
  unpaid=await session('Unpaid Test Buyer');
  admin=await session('Review Moderator','admin');
  for(const key of ['1','7','295']) beforeStock.set(key,(await pool.query('SELECT stock FROM products WHERE id=$1',[key])).rows[0].stock);
});

after(async()=>{
  if (server) await new Promise(resolve=>server.close(resolve));
  try {
    if (ids.length) {
      await pool.query('DELETE FROM review_moderation_events WHERE review_id IN (SELECT id FROM reviews WHERE user_id=ANY($1::uuid[]))',[ids]);
      await pool.query('DELETE FROM reviews WHERE user_id=ANY($1::uuid[])',[ids]);
      for(const table of ['inventory_transactions','order_status_events','payments','order_items'])
        await pool.query('DELETE FROM '+table+' WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::uuid[]))',[ids]);
      await pool.query('DELETE FROM orders WHERE user_id=ANY($1::uuid[])',[ids]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
    }
    if (fixtureProducts.length) await pool.query('DELETE FROM products WHERE id=ANY($1::text[])',[fixtureProducts]);
    for(const [key,stock] of beforeStock) await pool.query('UPDATE products SET stock=$2 WHERE id=$1',[key,stock]);
  } finally {await pool.end();}
});

test('reviews reject guests, non-purchasers, cancelled orders, unpaid online orders and invalid content',async()=>{
  assert.deepEqual(await summary('1'),{count:0,average:null,distribution:{1:0,2:0,3:0,4:0,5:0}});
  assert.equal((await get('/products/1')).data.product.rating,null);
  await post('1',undefined,5,'Unauthenticated fixture',401);
  await post('1',first.cookie,5,'Unpurchased fixture',403);
  await post('1',admin.cookie,5,'Administrator fixture',403);
  await post('1',first.cookie,6,'Invalid rating',400);
  await post('1',first.cookie,4.5,'Invalid rating',400);
  await post('1',first.cookie,5,' '.repeat(8),400);
  await post('1',first.cookie,5,'x'.repeat(2001),400);
  await request('/products/1/reviews',{method:'POST',cookie:first.cookie,csrf:false,body:{rating:5,body:'Missing CSRF'},status:403});
  const cancelled=await cod(first,'7');
  await write('POST','/orders/'+cancelled+'/cancel',first.cookie);
  await post('7',first.cookie,5,'Cancelled fixture',403);
  await onlineFixture(unpaid,'295','Pending');
  await post('295',unpaid.cookie,5,'Unpaid fixture',403);
  assert.equal((await get('/products/295/review-eligibility',unpaid.cookie)).data.eligible,false);
});

test('delivered buyers receive verified eligibility, ownership and exact distribution',async()=>{
  delivered=await cod(first,'1',true);
  await cod(second,'1',true);
  const eligibility=(await get('/products/1/review-eligibility',first.cookie)).data;
  assert.equal(eligibility.canSubmit,true);
  assert.equal((await get('/users/me/reviews',first.cookie)).data.eligible[0].productId,'1');
  const replies=await Promise.all([post('1',first.cookie,5,'Verified fixture review',null),post('1',first.cookie,5,'Verified fixture review',null)]);
  assert.deepEqual(replies.map(reply=>reply.status).sort(),[201,409]);
  reviewId=replies.find(reply=>reply.status===201).data.review.id;
  otherReview=(await post('1',second.cookie,1,'<b>Stored as plain review text</b>')).data.review.id;
  await write('PATCH','/reviews/'+reviewId,second.cookie,{rating:2,body:'Cross-owner attempt'},404);
  await write('DELETE','/reviews/'+reviewId,second.cookie,undefined,404);
  const {rows:[item]}=await pool.query('SELECT id FROM order_items WHERE order_id=$1',[delivered]);
  await assert.rejects(pool.query(`INSERT INTO reviews(user_id,product_id,order_item_id,rating,body)
    VALUES($1,'1',$2,4,'Wrong buyer')`,[unpaid.id,item.id]),{constraint:'reviews_verified_purchase'});
  assert.deepEqual(await summary('1'),{count:2,average:3,distribution:{1:1,2:0,3:0,4:0,5:1}});
  const low=(await get('/products/1/reviews?sort=lowest')).data.reviews;
  assert.equal(low[0].id,otherReview);
  assert.equal(low[0].body,'<b>Stored as plain review text</b>');
  assert.equal(low[0].displayName,'MultiStore customer');
  assert.equal(low[0].verifiedPurchase,true);
  assert.ok(!JSON.stringify(low).includes(second.email));
  assert.ok(low.every(review=>!Object.hasOwn(review,'userId')));
  assert.equal((await get('/products/1/reviews?sort=highest')).data.reviews[0].id,reviewId);
  await write('PATCH','/reviews/'+reviewId,first.cookie,{rating:4,body:'Edited verified fixture'});
  assert.equal((await summary('1')).average,2.5);
  assert.equal((await get('/users/me/reviews',first.cookie)).data.reviews[0].body,'Edited verified fixture');
});

test('moderation is audited, filters are accurate, hidden and removed reviews do not affect ratings',async()=>{
  await get('/admin/reviews',undefined,401);
  await get('/admin/reviews',first.cookie,403);
  const path='/admin/reviews/'+reviewId+'/status';
  await write('PATCH',path,admin.cookie,{status:'Hidden',reason:'Fixture audit reason',rating:1},400);
  await write('PATCH','/reviews/'+reviewId,admin.cookie,{rating:1,body:'Administrator cannot edit customer text'},404);
  await write('PATCH',path,admin.cookie,{status:'Hidden',reason:'Fixture audit reason'},204);
  assert.equal((await summary('1')).average,1);
  const matches=(await get('/admin/reviews?q=Verified&status=Hidden&rating=4',admin.cookie)).data.reviews;
  assert.equal(matches[0].id,reviewId);
  assert.equal(matches[0].moderationReason,'Fixture audit reason');
  assert.ok(matches[0].moderatedAt);
  assert.equal((await get('/products/1')).data.product.reviewCount,1);
  await write('PATCH',path,admin.cookie,{status:'Published',reason:'Fixture restored'},204);
  assert.equal((await summary('1')).count,2);
  await write('PATCH',path,admin.cookie,{status:'Removed',reason:'Fixture removal test'},204);
  await write('PATCH',path,admin.cookie,{status:'Published',reason:'Terminal status test'},409);
  await write('DELETE','/reviews/'+reviewId,first.cookie,undefined,204);
  await post('1',first.cookie,5,'Moderation bypass attempt',409);
  await write('DELETE','/reviews/'+otherReview,second.cookie,undefined,204);
  assert.equal((await summary('1')).count,0);
  assert.equal((await get('/products/1')).data.product.rating,null);
  assert.deepEqual((await pool.query('SELECT status FROM review_moderation_events WHERE review_id=$1 ORDER BY id',[reviewId])).rows,
    [{status:'Hidden'},{status:'Published'},{status:'Removed'}]);
});

test('captured online purchase eligibility ends on refund and pagination is stable',async()=>{
  const id='phase7-'+randomUUID();
  await pool.query("INSERT INTO products(id,name,description,category_id,price_paise,stock) VALUES($1,'Synthetic Review Fixture','Test fixture','electronics',100,0)",[id]);
  fixtureProducts.push(id);
  const voters=[];
  for(let i=0;i<6;i++) {
    const voter=await session('Fixture Voter '+i);
    const order=await onlineFixture(voter,id,'Captured');
    voters.push(order);
    await post(id,voter.cookie,(i%5)+1,'Explicit test-only fixture '+i);
  }
  const page=(await get('/products/'+id+'/reviews?sort=highest')).data;
  const last=(await get('/products/'+id+'/reviews?sort=highest&offset='+page.nextOffset)).data;
  assert.equal(page.reviews.length,5);
  assert.equal(last.reviews.length,1);
  assert.equal(last.nextOffset,null);
  assert.equal(new Set([...page.reviews,...last.reviews].map(review=>review.id)).size,6);
  await pool.query("UPDATE payments SET status='Refunded' WHERE order_id=$1",[voters[0]]);
  const stats=await summary(id);
  assert.equal(stats.count,5);
  assert.equal(stats.distribution[1],1);
});
