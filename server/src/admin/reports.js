import { salesSeries } from './analytics.js';
import { dateRange,dateWindow,option,orderStatuses,paymentStatuses } from './reportFilters.js';
import { HttpError } from '../http.js';

export function csvCell(value) {
  let text=String(value??'');
  if(typeof value==='string'&&(/^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text)||/^[\t\r\n]/.test(text))) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

const sources={
  orders:{
    statuses:orderStatuses,headers:['Order number','Created','Status','Method','Total paise'],
    query:`SELECT order_number,to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS') AS created,status,payment_method,total_paise
      FROM reporting_orders WHERE ${dateWindow('created_at')} AND ($3='' OR status=$3) ORDER BY created_at DESC,id DESC`,
  },
  products:{
    statuses:['Active','Inactive'],headers:['Product ID','Product','Category','Status','Price paise','Available stock'],
    query:`SELECT p.id,p.name,c.name AS category,CASE WHEN p.active AND c.active THEN 'Active' ELSE 'Inactive' END AS status,
        p.price_paise,p.stock-p.reserved_stock AS available FROM products p JOIN categories c ON c.id=p.category_id
      WHERE ${dateWindow('p.created_at')} AND ($3='' OR (CASE WHEN p.active AND c.active THEN 'Active' ELSE 'Inactive' END)=$3)
      ORDER BY p.created_at DESC,p.id DESC`,
  },
  inventory:{
    statuses:['Added','Removed'],headers:['Product ID','Product','Movement date','Units changed','Current on hand','Current reserved'],
    query:`SELECT p.id,p.name,to_char(t.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS') AS movement,
        t.delta,p.stock,p.reserved_stock FROM inventory_transactions t JOIN products p ON p.id=t.product_id
      WHERE ${dateWindow('t.created_at')} AND ($3='' OR ($3='Added' AND t.delta>0) OR ($3='Removed' AND t.delta<0))
      ORDER BY t.created_at DESC,t.id DESC`,
  },
  payments:{
    statuses:paymentStatuses,headers:['Payment ID','Order number','Created','Provider','Method','Status','Amount paise','Currency'],
    query:`SELECT p.id,o.order_number,to_char(p.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS') AS created,
        p.provider,p.method,p.status,p.amount_paise,p.currency FROM payments p JOIN orders o ON o.id=p.order_id
      WHERE ${dateWindow('p.created_at')} AND ($3='' OR p.status=$3) ORDER BY p.created_at DESC,p.id DESC`,
  },
};

export async function exportReport(pool,kind,query) {
  const range=dateRange(query);
  let rows,headers;
  if(kind==='sales') {
    rows=await salesSeries(pool,range,option(query.period,['day','week','month'])||'day');
    headers=['Period start','Placed orders','Delivered orders','Demo COD paise','Verified test capture paise'];
  } else {
    const source=sources[kind];
    if(!source) throw new HttpError(404,'REPORT_NOT_FOUND','Report not found.');
    headers=source.headers;
    const result=await pool.query(source.query+' LIMIT 10001',[...range,option(query.status,source.statuses)]);
    rows=result.rows;
    if(rows.length>10000) throw new HttpError(422,'REPORT_TOO_LARGE','Narrow the report date range or status filter.');
  }
  return '\uFEFF'+[headers,...rows.map(row=>Object.values(row))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
