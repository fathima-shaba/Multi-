import { useState } from 'react';

export function reportMoney(value) {
  const paise=BigInt(value??0);
  const whole=paise/100n,remainder=paise%100n;
  return '₹'+whole.toLocaleString('en-IN')+(remainder?'.'+String(remainder).padStart(2,'0'):'');
}

export function businessDate(value) {
  return new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
}

export function DateRangeForm({range,setRange,group=false}) {
  const [draft,setDraft]=useState(range);
  return <form className="admin-controls" onSubmit={event=>{event.preventDefault();setRange(draft);}}>
    <label>From<input type="date" className="input" value={draft.from} required onChange={event=>setDraft({...draft,from:event.target.value})} /></label>
    <label>To<input type="date" className="input" value={draft.to} min={draft.from} required onChange={event=>setDraft({...draft,to:event.target.value})} /></label>
    {group&&<label>Group by<select className="input" value={draft.period} onChange={event=>setDraft({...draft,period:event.target.value})}>
      <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
    </select></label>}
    <button className="btn btn-primary">Apply Dates</button>
  </form>;
}

export function initialRange() {
  const to=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'}).format(new Date());
  return {to,from:new Date(Date.parse(to+'T00:00:00Z')-29*86400000).toISOString().slice(0,10),period:'day'};
}
