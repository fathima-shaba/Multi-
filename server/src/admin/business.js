import { Router } from 'express';
import { transaction } from '../db.js';
import { HttpError } from '../http.js';
import { addressId,fields,invalid } from '../auth/validation.js';
import { orderList } from '../commerce/orders.js';
import { auditAdmin } from './activity.js';
import { dashboard,salesAnalytics,productAnalytics,customerAnalytics } from './analytics.js';
import { dateRange,option,searchTerm,listOffset } from './reportFilters.js';
import { exportReport } from './reports.js';

const customerColumns='id,name,email,phone,active,created_at AS "createdAt",updated_at AS "updatedAt"';
const missingCustomer=()=>new HttpError(404,'CUSTOMER_NOT_FOUND','Customer account not found.');
const period=query=>option(query.period,['day','week','month'])||'day';

export function adminBusinessRoutes(pool) {
  const router=Router();
  router.get('/dashboard',async(_request,response)=>response.json(await dashboard(pool)));
  router.get('/analytics/sales',async(request,response)=>response.json(await salesAnalytics(pool,dateRange(request.query),period(request.query))));
  router.get('/analytics/products',async(request,response)=>response.json(await productAnalytics(pool,dateRange(request.query))));
  router.get('/analytics/customers',async(request,response)=>response.json(await customerAnalytics(pool,dateRange(request.query),period(request.query))));
  router.get('/customers',async(request,response)=>{
    const {q,status,offset}=request.query,start=listOffset(offset);
    const {rows}=await pool.query(`SELECT ${customerColumns},
        (SELECT count(*)::int FROM reporting_orders o WHERE o.user_id=u.id) AS "orderCount"
      FROM users u WHERE role='customer'
        AND ($1='' OR strpos(lower(concat_ws(' ',name,email)),lower($1))>0)
        AND ($2='' OR active=($2='Active'))
      ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $3`,[searchTerm(q),option(status,['Active','Inactive']),start]);
    response.json({customers:rows.slice(0,25),nextOffset:rows.length>25?start+25:null});
  });

  router.get('/customers/:id',async(request,response)=>{
    const id=addressId(request.params.id);
    const {rows:[customer]}=await pool.query(`SELECT ${customerColumns} FROM users WHERE id=$1 AND role='customer'`,[id]);
    if(!customer) throw missingCustomer();
    response.json({customer,...await orderList(pool,id,request.query)});
  });

  router.patch('/customers/:id/status',async(request,response)=>{
    const id=addressId(request.params.id), actor=response.locals.user.id;
    const {active}=fields(request.body,['active']);
    if(typeof active!=='boolean') invalid('Specify an active or inactive account status.');
    const customer=await transaction(pool,async client=>{
      const {rows:[before]}=await client.query(`SELECT ${customerColumns} FROM users WHERE id=$1 AND role='customer' FOR UPDATE`,[id]);
      if(!before) throw missingCustomer();
      if(before.active===active) return before;
      const {rows:[updated]}=await client.query(`UPDATE users SET active=$2,updated_at=now()
        WHERE id=$1 AND role='customer' RETURNING ${customerColumns}`,[id,active]);
      if(!active) await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
      await auditAdmin(client,actor,active?'customer.activated':'customer.deactivated','customer',id);
      return updated;
    });
    response.json({customer});
  });

  router.get('/activity',async(request,response)=>{
    const start=listOffset(request.query.offset),q=searchTerm(request.query.q);
    const {rows}=await pool.query(`SELECT id,actor_name AS "actorName",action,target_type AS "targetType",
        target_id AS "targetId",created_at AS "createdAt" FROM admin_activity
      WHERE ($1='' OR strpos(lower(concat_ws(' ',actor_name,action,target_type,target_id)),lower($1))>0)
      ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $2`,[q,start]);
    response.json({activity:rows.slice(0,25),nextOffset:rows.length>25?start+25:null});
  });

  for(const kind of ['orders','sales','products','inventory','payments']) {
    router.get('/reports/'+kind,async(request,response)=>{
      const csv=await exportReport(pool,kind,request.query);
      response.type('text/csv').attachment('multistore-'+kind+'.csv').send(csv);
    });
  }
  return router;
}
