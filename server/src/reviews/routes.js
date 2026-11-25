import { Router } from 'express';
import { HttpError } from '../http.js';
import { transaction } from '../db.js';
import { addressId, fields, invalid, text } from '../auth/validation.js';
import { lockAccount, productId } from '../commerce/cart.js';
import { auditAdmin } from '../admin/activity.js';

const productMissing = () => new HttpError(404,'PRODUCT_NOT_FOUND','Product not found.');
const reviewMissing = () => new HttpError(404,'REVIEW_NOT_FOUND','Review not found.');
const purchaseRequired = () => new HttpError(403,'VERIFIED_PURCHASE_REQUIRED','A delivered, eligible purchase is required to review this product.');
const duplicate = () => new HttpError(409,'REVIEW_EXISTS','You already have a review for this product.');
const statusNames = ['Published','Hidden','Removed'];

function stars(value) {
  if (!Number.isInteger(value)||value<1||value>5) invalid('Rating must be a whole number from 1 to 5.');
  return value;
}

function reviewBody(value) {
  // Accept tabs and line breaks while rejecting other control characters.
  // oxlint-disable-next-line eslint/no-control-regex
  if (typeof value!=='string'||/[\x00-\x08\x0B-\x1F\x7F]/.test(value.replaceAll('\r\n','\n'))) invalid('Enter valid review text.');
  const cleaned=value.trim();
  if (!cleaned||cleaned.length>2000) invalid('Review text must contain 1–2000 characters.');
  return cleaned;
}

function offset(value='0') {
  if (typeof value!=='string'||!/^\d{1,6}$/.test(value)||Number(value)>100000) invalid('Invalid page offset.');
  return Number(value);
}

async function requireProduct(client,id) {
  const result=await client.query(`SELECT 1 FROM products p JOIN categories c ON c.id=p.category_id
    WHERE p.id=$1 AND p.active AND c.active`,[id]);
  if (!result.rowCount) throw productMissing();
}

async function eligibleItem(client,id,userId) {
  const {rows:[item]}=await client.query(`SELECT order_item_id FROM eligible_review_purchases
    WHERE product_id=$1 AND user_id=$2 ORDER BY order_date DESC,order_item_id LIMIT 1`,[id,userId]);
  return item?.order_item_id;
}

function paged(rows,start,limit) {
  return {reviews:rows.slice(0,limit),nextOffset:rows.length>limit?start+limit:null};
}

const ownColumns = `r.id,r.product_id AS "productId",p.name AS "productName",(p.active AND c.active) AS "productAvailable",
  r.rating,r.body,r.moderation_status AS status,r.moderation_reason AS "moderationReason",
  r.created_at AS "createdAt",r.updated_at AS "updatedAt",r.moderated_at AS "moderatedAt",
  EXISTS(SELECT 1 FROM eligible_review_purchases e WHERE e.order_item_id=r.order_item_id AND e.user_id=r.user_id) AS "verifiedPurchase"`;
const ownFrom = 'FROM reviews r JOIN products p ON p.id=r.product_id JOIN categories c ON c.id=p.category_id';

export function publicReviewRoutes(pool) {
  const router=Router();
  router.get('/products/:id/review-summary',async(request,response)=>{
    const id=productId(request.params.id);
    await requireProduct(pool,id);
    const {rows:[summary]}=await pool.query(`SELECT count(*)::int AS count,round(avg(rating),2)::float AS average,
      json_build_object('1',count(*) FILTER(WHERE rating=1),'2',count(*) FILTER(WHERE rating=2),
        '3',count(*) FILTER(WHERE rating=3),'4',count(*) FILTER(WHERE rating=4),'5',count(*) FILTER(WHERE rating=5)) AS distribution
      FROM published_product_reviews WHERE product_id=$1`,[id]);
    response.set('Cache-Control','no-store');
    response.json({summary});
  });

  router.get('/products/:id/reviews',async(request,response)=>{
    const id=productId(request.params.id),start=offset(request.query.offset);
    const sort=request.query.sort??'newest';
    const orders={newest:'r.created_at DESC,r.id DESC',highest:'r.rating DESC,r.created_at DESC,r.id DESC',lowest:'r.rating ASC,r.created_at DESC,r.id DESC'};
    if (typeof sort!=='string'||!Object.hasOwn(orders,sort)) invalid('Invalid review sort.');
    await requireProduct(pool,id);
    const {rows}=await pool.query(`SELECT r.id,r.rating,r.body,r.created_at AS "createdAt",r.updated_at AS "updatedAt",
      CASE WHEN strpos(u.name,'@')>0 THEN 'MultiStore customer' ELSE split_part(trim(u.name),' ',1) END AS "displayName",
      true AS "verifiedPurchase" FROM published_product_reviews r JOIN users u ON u.id=r.user_id
      WHERE r.product_id=$1 ORDER BY ${orders[sort]} LIMIT 6 OFFSET $2`,[id,start]);
    response.json(paged(rows,start,5));
  });
  return router;
}

export function customerReviewRoutes(pool,requireUser) {
  const router=Router();
  router.get('/products/:id/review-eligibility',requireUser,async(request,response)=>{
    const id=productId(request.params.id),user=response.locals.user;
    await requireProduct(pool,id);
    const {rows:[existing]}=await pool.query(`SELECT ${ownColumns},r.deleted_at
      ${ownFrom} WHERE r.product_id=$1 AND r.user_id=$2`,[id,user.id]);
    const eligible=user.role==='customer'&&Boolean(await eligibleItem(pool,id,user.id));
    const moderated=Boolean(existing?.deleted_at&&existing.status!=='Published');
    let review=null;
    if (existing && !existing.deleted_at) {
      const {deleted_at:_deleted,...visible}=existing;
      review=visible;
    }
    response.json({eligible,canSubmit:eligible&&!review&&!moderated,moderated,review});
  });

  router.post('/products/:id/reviews',requireUser,async(request,response)=>{
    const user=response.locals.user,id=productId(request.params.id);
    const input=fields(request.body,['rating','body']),rating=stars(input.rating),body=reviewBody(input.body);
    if (user.role!=='customer') throw purchaseRequired();
    try {
      const review=await transaction(pool,async client=>{
        await lockAccount(client,user.id);
        await requireProduct(client,id);
        const item=await eligibleItem(client,id,user.id);
        if (!item) throw purchaseRequired();
        const {rows:[created]}=await client.query(`INSERT INTO reviews(user_id,product_id,order_item_id,rating,body)
          VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(product_id,user_id) DO UPDATE SET order_item_id=EXCLUDED.order_item_id,rating=EXCLUDED.rating,
            body=EXCLUDED.body,deleted_at=NULL,created_at=now(),updated_at=now()
          WHERE reviews.deleted_at IS NOT NULL AND reviews.moderation_status='Published'
          RETURNING id`,[user.id,id,item,rating,body]);
        if (!created) throw duplicate();
        return created;
      });
      response.status(201).json({review});
    } catch(error) {
      if (error.constraint==='reviews_verified_purchase') throw purchaseRequired();
      throw error;
    }
  });

  router.patch('/reviews/:id',requireUser,async(request,response)=>{
    const id=addressId(request.params.id);
    const input=fields(request.body,['rating','body']),rating=stars(input.rating),body=reviewBody(input.body);
    try {
      await transaction(pool,async client=>{
        const {rows:[review]}=await client.query('SELECT moderation_status,product_id FROM reviews WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
          [id,response.locals.user.id]);
        if (!review) throw reviewMissing();
        if (review.moderation_status==='Removed') throw new HttpError(409,'REVIEW_REMOVED','A removed review cannot be edited.');
        const item=await eligibleItem(client,review.product_id,response.locals.user.id);
        if (!item) throw purchaseRequired();
        await client.query('UPDATE reviews SET rating=$2,body=$3,order_item_id=$4,updated_at=now() WHERE id=$1',[id,rating,body,item]);
      });
    } catch(error) {
      if (error.constraint==='reviews_verified_purchase') throw purchaseRequired();
      throw error;
    }
    response.json({review:{id}});
  });

  router.delete('/reviews/:id',requireUser,async(request,response)=>{
    const result=await pool.query('UPDATE reviews SET deleted_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
      [addressId(request.params.id),response.locals.user.id]);
    if (!result.rowCount) throw reviewMissing();
    response.sendStatus(204);
  });

  router.get('/users/me/reviews',requireUser,async(request,response)=>{
    const userId=response.locals.user.id,start=offset(request.query.offset),eligibleOffset=offset(request.query.eligibleOffset);
    const [{rows:reviews},{rows:eligible}]=await Promise.all([
      pool.query(`SELECT ${ownColumns} ${ownFrom} WHERE r.user_id=$1 AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC,r.id DESC LIMIT 11 OFFSET $2`,[userId,start]),
      pool.query(`SELECT DISTINCT ON (e.product_id) e.product_id AS "productId",p.name AS "productName",e.order_id AS "orderId"
        FROM eligible_review_purchases e JOIN products p ON p.id=e.product_id JOIN categories c ON c.id=p.category_id
        WHERE e.user_id=$1 AND p.active AND c.active AND NOT EXISTS (
          SELECT 1 FROM reviews r WHERE r.product_id=e.product_id AND r.user_id=e.user_id
            AND (r.deleted_at IS NULL OR r.moderation_status<>'Published'))
        ORDER BY e.product_id,e.order_date DESC,e.order_id LIMIT 11 OFFSET $2`,[userId,eligibleOffset]),
    ]);
    response.json({...paged(reviews,start,10),eligible:eligible.slice(0,10),nextEligibleOffset:eligible.length>10?eligibleOffset+10:null});
  });
  return router;
}

export function adminReviewRoutes(pool) {
  const router=Router();
  router.get('/reviews',async(request,response)=>{
    const {q='',rating='',status=''}=request.query,start=offset(request.query.offset);
    if (typeof q!=='string'||q.length>120||q.includes('\0')||typeof rating!=='string'||!/^([1-5])?$/.test(rating)||
      typeof status!=='string'||(status&&!statusNames.includes(status)&&status!=='Deleted')) invalid('Invalid review filter.');
    const {rows}=await pool.query(`SELECT ${ownColumns},u.name AS "customerName",
      r.deleted_at AS "deletedAt",m.name AS "moderatorName"
      ${ownFrom} JOIN users u ON u.id=r.user_id LEFT JOIN users m ON m.id=r.moderated_by
      WHERE ($1='' OR strpos(lower(concat_ws(' ',p.name,u.name)),lower($1))>0)
        AND ($2::int IS NULL OR r.rating=$2)
        AND ($3='' OR (CASE WHEN r.deleted_at IS NULL THEN r.moderation_status ELSE 'Deleted' END)=$3)
      ORDER BY r.created_at DESC,r.id DESC LIMIT 26 OFFSET $4`,[q.trim(),rating?Number(rating):null,status,start]);
    response.json(paged(rows.map(review=>review.deletedAt?{...review,body:null,status:'Deleted'}:review),start,25));
  });

  router.patch('/reviews/:id/status',async(request,response)=>{
    const id=addressId(request.params.id),actor=response.locals.user.id;
    const input=fields(request.body,['status','reason']),reason=text(input.reason,'Reason',3,500);
    if (!statusNames.includes(input.status)) invalid('Invalid moderation status.');
    await transaction(pool,async client=>{
      const {rows:[review]}=await client.query('SELECT moderation_status FROM reviews WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]);
      if (!review) throw reviewMissing();
      const previous=review.moderation_status;
      if (previous===input.status) return;
      if (previous==='Removed') throw new HttpError(409,'REVIEW_REMOVED','A removed review cannot be restored.');
      await client.query('UPDATE reviews SET moderation_status=$2,moderation_reason=$3,moderated_at=now(),moderated_by=$4 WHERE id=$1',
        [id,input.status,reason,actor]);
      await client.query('INSERT INTO review_moderation_events(review_id,actor_user_id,previous_status,status,reason) VALUES($1,$2,$3,$4,$5)',
        [id,actor,previous,input.status,reason]);
      await auditAdmin(client,actor,'review.'+input.status.toLowerCase(),'review',id);
    });
    response.sendStatus(204);
  });
  return router;
}
