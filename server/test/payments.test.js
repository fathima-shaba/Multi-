import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after,before,test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';
import { createRazorpayGateway } from '../src/payments/gateway.js';
import { expireReservations } from '../src/payments/reservations.js';
import { mockRazorpay } from './mock-razorpay.js';

const pool=createPool(readConfig().databaseUrl), gateway=mockRazorpay();
const origin='http://localhost:5173';
const ids=[], fixtureProducts=[], eventIds=[];
const originalStock=new Map();
const address={recipient:'Test Customer',phone:'9123456780',addressLine:'12 Sample Street',city:'Pune',state:'Maharashtra',pincode:'411001'};
let server,base,first,second,admin;

async function http(path,{method='GET',cookie,body,expected=200,headers={}}={}){
  const response=await fetch(base+path,{method,headers:{
    ...(method==='GET'?{}:{Origin:origin,'X-MultiStore-Request':'1'}),
    ...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers,
  },body:typeof body==='string'?body:body===undefined?undefined:JSON.stringify(body)});
  const data=response.status===204?null:await response.json();
  if(expected!==null) assert.equal(response.status,expected,data?.error?.message);
  return {data,status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const get=(path,cookie,expected=200)=>http(path,{cookie,expected});
const write=(method,path,cookie,body,expected=200)=>http(path,{method,cookie,body,expected});
const add=(cookie,productId,quantity=1,expected=201)=>write('POST','/cart/items',cookie,{productId,quantity},expected);
const clear=cookie=>write('DELETE','/cart',cookie);
const create=(cookie,body,expected=201)=>write('POST','/payments/razorpay/order',cookie,body,expected);
const resume=(cookie,id,expected=200)=>write('POST','/payments/razorpay/'+id+'/resume',cookie,undefined,expected);
const verify=(cookie,orderId,callback,expected=200)=>write('POST','/payments/razorpay/verify',cookie,{orderId,...callback},expected);
const cancel=(cookie,id)=>write('POST','/orders/'+id+'/cancel',cookie);
const stock=async id=>(await pool.query('SELECT stock,reserved_stock FROM products WHERE id=$1',[id])).rows[0];

async function session(role){
  const email=role+'-'+randomUUID()+'@example.test',password=randomUUID();
  const {rows:[user]}=await pool.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
    [email,'Payment Test User',await hashPassword(password),role]);
  ids.push(user.id);
  return (await write('POST','/auth/login',undefined,{email,password})).cookie;
}
const intent=cart=>({address,quoteVersion:cart.quoteVersion,idempotencyKey:randomUUID()});
async function webhook(observed,type,eventId=randomUUID(),expected=204,badSignature=false){
  if(!eventIds.includes(eventId)) eventIds.push(eventId);
  const body=JSON.stringify({event:type,payload:{payment:{entity:{id:observed.id}}}});
  return http('/payments/razorpay/webhook',{method:'POST',body,expected,headers:{
    'x-razorpay-event-id':eventId,'x-razorpay-signature':badSignature?'0'.repeat(64):gateway.signWebhook(body),
  }});
}
async function fixture(units){
  const id='phase6-'+randomUUID();
  await pool.query("INSERT INTO products(id,name,description,category_id,price_paise,stock) VALUES($1,'Phase 6 fixture','Temporary','electronics',68600,$2)",[id,units]);
  fixtureProducts.push(id);
  return id;
}
before(async()=>{
  server=createApp({pool,origins:[origin],gateway}).listen(0,'127.0.0.1');
  await once(server,'listening');base='http://127.0.0.1:'+server.address().port+'/api';
  first=await session('customer');second=await session('customer');admin=await session('admin');
  for (const id of ['1','7','295']) originalStock.set(id,await stock(id));
});
after(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  try{
    if (eventIds.length) await pool.query('DELETE FROM payment_webhook_events WHERE event_id=ANY($1::text[])',[eventIds]);
    if (ids.length) {
      const filter=' WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::uuid[]))';
      for(const table of ['inventory_transactions','order_status_events','payments','order_items'])
        await pool.query('DELETE FROM '+table+filter,[ids]);
      await pool.query('DELETE FROM orders WHERE user_id=ANY($1::uuid[])',[ids]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
    }
    if (fixtureProducts.length) await pool.query('DELETE FROM products WHERE id=ANY($1::text[])',[fixtureProducts]);
    for(const [id,value] of originalStock) await pool.query('UPDATE products SET stock=$2,reserved_stock=$3 WHERE id=$1',[id,value.stock,value.reserved_stock]);
  } finally { await pool.end(); }
});

test('missing and live-mode credentials disable online payment without breaking COD',async()=>{
  assert.equal(createRazorpayGateway({}),null);
  assert.equal(createRazorpayGateway({RAZORPAY_KEY_ID:'rzp_live_dummy',RAZORPAY_KEY_SECRET:'fixture',RAZORPAY_WEBHOOK_SECRET:'fixture'}),null);
  const offline=createApp({pool,origins:[origin]}).listen(0,'127.0.0.1');
  await once(offline,'listening');
  const original=base; base='http://127.0.0.1:'+offline.address().port+'/api';
  try{
    assert.deepEqual((await get('/payments/razorpay/config',first)).data,{available:false});
    await create(first,{},503);
    const cart=(await add(first,'1')).data;
    const cod=await write('POST','/checkout',first,intent(cart),201);
    assert.equal((await get('/orders/'+cod.data.orderId+'/payment',first)).data.payment.provider,'demo_cod');
    await cancel(first,cod.data.orderId);
  } finally {base=original;await new Promise(resolve=>offline.close(resolve));}
});

test('mocked ₹16,863: reservation, ownership, no duplicate gateway order, signature and capture',async()=>{
  const cart=(await add(first,'1')).data;
  const body=intent(cart);
  await create(first,{...body,amount:1},400);
  const calls=gateway.created;
  const responses=await Promise.all([create(first,body,null),create(first,body,null)]);
  assert.equal(gateway.created,calls+1);
  const session=responses.find(item=>item.status===201).data;
  assert.equal(session.checkout.amount,1686300);assert.equal(session.checkout.currency,'INR');
  assert.ok(!JSON.stringify(session).includes(gateway.keySecret));
  const otherwise=await create(first,body,200);assert.equal(otherwise.data.checkout.order_id,session.checkout.order_id);
  await create(first,{...body,idempotencyKey:randomUUID()},409);
  await write('POST','/checkout',first,{...body,idempotencyKey:randomUUID()},409);
  await get('/orders/'+session.orderId+'/payment',second,404);
  await resume(second,session.orderId,404);
  assert.deepEqual(await stock('1'),{stock:originalStock.get('1').stock,reserved_stock:1});
  await write('PATCH','/admin/orders/'+session.orderId+'/status',admin,{status:'Processing'},409);
  const id=session.checkout.order_id;
  const forged=gateway.observe(id,'captured',{amount:1});
  await verify(first,session.orderId,{...gateway.callback(id,forged.id),razorpay_signature:'0'.repeat(64)},400);
  await verify(first,session.orderId,gateway.callback(id,forged.id),409);
  const wrongCurrency=gateway.observe(id,'captured',{currency:'USD'});
  await verify(first,session.orderId,gateway.callback(id,wrongCurrency.id),409);
  const authorized=gateway.observe(id,'authorized');
  const signature=gateway.callback(id,authorized.id);
  assert.equal((await verify(first,session.orderId,signature)).data.payment.status,'Authorized');
  assert.equal((await get('/cart',first)).data.items.length,1);
  assert.equal((await get('/orders/'+session.orderId,first)).data.order.finalizedAt,null);
  const captured=gateway.observe(id,'captured',{id:authorized.id});
  await webhook(captured,'payment.captured',randomUUID(),400,true);
  const event=randomUUID();
  await Promise.all([webhook(captured,'payment.captured',event),verify(first,session.orderId,signature)]);
  await webhook(captured,'payment.captured',event);
  await webhook(gateway.observe(id,'failed'),'payment.failed');
  const receipt=(await get('/orders/'+session.orderId,first)).data.order;
  assert.equal(receipt.paymentStatus,'Captured');assert.equal(receipt.status,'Processing');
  assert.equal((await get('/cart',first)).data.items.length,0);
  assert.equal(receipt.totalPaise,1686300);
  assert.deepEqual(await stock('1'),{stock:originalStock.get('1').stock-1,reserved_stock:0});
  const ledger=await pool.query('SELECT delta FROM inventory_transactions WHERE order_id=$1',[session.orderId]);
  assert.deepEqual(ledger.rows,[{delta:-1}]);
  await get('/admin/payments',undefined,401);
  await get('/admin/payments',first,403);
  const listing=await get('/admin/payments?status=Captured&q='+captured.id,admin);
  assert.equal(listing.data.payments[0].providerPaymentId,captured.id);
  await write('PATCH','/admin/orders/'+session.orderId+'/status',admin,{status:'Cancelled'});
  const {payment}= (await get('/orders/'+session.orderId+'/payment',first)).data;
  assert.equal(payment.status,'RefundRequired');
  await write('POST','/admin/payments/'+payment.id+'/reconcile',admin,{});
  assert.equal((await get('/orders/'+session.orderId+'/payment',first)).data.payment.status,'RefundRequired');
  const refund=gateway.observe(id,'refunded',{id:captured.id,refund_status:'full',amount_refunded:1686300});
  await webhook(refund,'refund.processed');
  assert.equal((await get('/orders/'+session.orderId+'/payment',first)).data.payment.status,'Refunded');
  assert.deepEqual(await stock('1'),originalStock.get('1'));
});

test('mocked ₹686: failure, safe resume, cancellation and late capture reconciliation',async()=>{
  await add(first,'7',2);
  const cart=(await add(first,'295')).data;
  const session=(await create(first,intent(cart))).data;
  assert.equal(session.checkout.amount,68600);
  const id=session.checkout.order_id;
  await webhook(gateway.observe(id,'failed'),'payment.failed');
  assert.equal((await get('/orders/'+session.orderId+'/payment',first)).data.payment.status,'Failed');
  assert.equal((await resume(first,session.orderId)).data.checkout.order_id,id);
  await cancel(first,session.orderId);
  await resume(first,session.orderId,409);
  assert.deepEqual(await stock('7'),originalStock.get('7'));
  await webhook(gateway.observe(id,'captured'),'payment.captured');
  const result=(await get('/orders/'+session.orderId+'/payment',first)).data.payment;
  assert.equal(result.status,'ReconciliationRequired');
  assert.equal(result.finalizedAt,null);
  assert.equal((await get('/cart',first)).data.items.length,2);
  assert.deepEqual(await stock('7'),originalStock.get('7'));
  await clear(first);
});

test('concurrent reservations, expiration and ambiguous gateway creation do not oversell or duplicate',async()=>{
  const productId=await fixture(1);
  const a=intent((await add(first,productId)).data), b=intent((await add(second,productId)).data);
  const results=await Promise.all([create(first,a,null),create(second,b,null)]);
  assert.deepEqual(results.map(item=>item.status).sort(),[201,409]);
  assert.deepEqual(await stock(productId),{stock:1,reserved_stock:1});
  const winner=results[0].status===201?first:second;
  const session=results.find(item=>item.status===201).data;
  await pool.query("UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",[session.orderId]);
  await expireReservations(pool);
  assert.deepEqual(await stock(productId),{stock:1,reserved_stock:0});
  assert.equal((await get('/orders/'+session.orderId+'/payment',winner)).data.payment.status,'Expired');

  gateway.failCreate=true;
  const start=intent((await get('/cart',winner)).data);
  const count=gateway.created;
  try {
    await create(winner,start,503);
    await create(winner,start,409);
  } finally { gateway.failCreate=false; }
  assert.equal(gateway.created,count+1);
  const pending=(await get('/orders',winner)).data.orders.find(order=>order.paymentStatus==='CreationUnknown');
  assert.ok(pending);
  // A valid event can recover the provider link by the verified receipt.
  const orphan=[...gateway.orders.values()].find(order=>order.receipt===pending.orderNumber);
  await webhook(gateway.observe(orphan.id,'failed'),'payment.failed');
  assert.equal((await resume(winner,pending.id)).data.checkout.order_id,orphan.id);
  await cancel(winner,pending.id);
  assert.deepEqual(await stock(productId),{stock:1,reserved_stock:0});
  await clear(first);await clear(second);
});

test('a database failure while finalizing online payment preserves the hold and supports retry',async()=>{
  const productId=await fixture(2);
  const cart=(await add(first,productId)).data;
  const session=(await create(first,intent(cart))).data;
  const id=session.checkout.order_id;
  const observed=gateway.observe(id,'captured');
  const signed=gateway.callback(id,observed.id);
  await pool.query(`CREATE FUNCTION phase6_test_fail_capture() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status='Captured' THEN RAISE EXCEPTION 'Test capture rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER phase6_test_capture_failure BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION phase6_test_fail_capture()`);
  try{
    await verify(first,session.orderId,signed,500);
    assert.deepEqual(await stock(productId),{stock:2,reserved_stock:1});
    assert.equal((await get('/cart',first)).data.items.length,1);
    assert.equal((await get('/orders/'+session.orderId+'/payment',first)).data.payment.finalizedAt,null);
    assert.deepEqual((await pool.query('SELECT delta FROM inventory_transactions WHERE order_id=$1',[session.orderId])).rows,[]);
  } finally {
    await pool.query('DROP TRIGGER phase6_test_capture_failure ON payments; DROP FUNCTION phase6_test_fail_capture()');
  }
  assert.equal((await verify(first,session.orderId,signed)).data.payment.status,'Captured');
  assert.deepEqual(await stock(productId),{stock:1,reserved_stock:0});
  await write('PATCH','/admin/orders/'+session.orderId+'/status',admin,{status:'Cancelled'});
  assert.deepEqual(await stock(productId),{stock:2,reserved_stock:0});
});
