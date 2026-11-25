import { invalid } from '../auth/validation.js';

export const orderStatuses=['Pending','Processing','Shipped','Delivered','Cancelled'];
export const paymentStatuses=['Creating','CreationUnknown','Pending','Authorized','Captured','Failed','Expired','Cancelled','RefundRequired','ReconciliationRequired','Refunded'];
export const localZone='Asia/Kolkata';
export const dateWindow=column=>`${column}>=($1::date::timestamp AT TIME ZONE '${localZone}')
  AND ${column}<(($2::date+1)::timestamp AT TIME ZONE '${localZone}')`;

const oneDay=86400000;
const todaysDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:localZone}).format(new Date());

function dateValue(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000')) invalid('Use dates in YYYY-MM-DD format.');
  const timestamp=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==value) invalid('Select a valid calendar date.');
  return timestamp;
}

export function dateRange(query) {
  const to=query.to??todaysDate();
  const end=dateValue(to);
  const from=query.from??new Date(end-29*oneDay).toISOString().slice(0,10);
  const start=dateValue(from);
  if(start>end||end-start>365*oneDay) invalid('Select a date range of up to 366 days.');
  return [from,to];
}

export function listOffset(value='0') {
  if(typeof value!=='string'||!/^\d{1,6}$/.test(value)||Number(value)>100000) invalid('Invalid page offset.');
  return Number(value);
}

export function searchTerm(value='') {
  if(typeof value!=='string'||value.length>254||value.includes('\0')) invalid('Invalid search text.');
  return value.trim();
}

export function option(value='',allowed) {
  if(typeof value!=='string'||(value!==''&&!allowed.includes(value))) invalid('Invalid filter.');
  return value;
}
