import { useState } from 'react';
import { DateRangeForm,initialRange } from './businessUi';

const reportTypes={
  orders:['Orders',['Pending','Processing','Shipped','Delivered','Cancelled']],
  sales:['Sales',[]],
  products:['Products',['Active','Inactive']],
  inventory:['Inventory movements',['Added','Removed']],
  payments:['Payment records',['Creating','CreationUnknown','Pending','Authorized','Captured','Failed','Expired','Cancelled','RefundRequired','ReconciliationRequired','Refunded']],
};

export default function BusinessReports() {
  const [range,setRange]=useState(initialRange);
  const [kind,setKind]=useState('orders');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(null);
  const [period,setPeriod]=useState('day');

  async function download() {
    setBusy(true);setNotice(null);
    try {
      const params=new URLSearchParams({from:range.from,to:range.to,status,period});
      const response=await fetch('/api/admin/reports/'+kind+'?'+params,{credentials:'same-origin'});
      if(!response.ok) {
        const body=await response.json().catch(()=>null);
        throw new Error(body?.error?.message||'Could not generate the report.');
      }
      if(!response.headers.get('content-type')?.includes('text/csv')) throw new Error('The CSV report was unavailable.');
      const url=URL.createObjectURL(await response.blob());
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='multistore-'+kind+'.csv';anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice({text:'CSV download started.'});
    } catch(error) {setNotice({error:true,text:error.message});}
    finally {setBusy(false);}
  }

  return <section>
    <h1 className="page-title">Sales Reports & CSV Exports</h1>
    <div className="card recent-orders">
      <p>Exports use India time and amounts in paise. Customer contact details and authentication data are excluded.</p>
      <DateRangeForm range={range} setRange={value=>{setRange(value);setNotice(null);}} />
      <p>Applied date range: {range.from} to {range.to}</p>
      <div className="admin-controls">
        <label>Report<select className="input" value={kind} onChange={event=>{setKind(event.target.value);setStatus('');setNotice(null);}}>
          {Object.entries(reportTypes).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        {kind==='sales'?<label>Group by<select className="input" value={period} onChange={event=>setPeriod(event.target.value)}>
          <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
        </select></label>:<label>Status<select className="input" value={status} onChange={event=>setStatus(event.target.value)}>
          <option value="">All statuses</option>{reportTypes[kind][1].map(value=><option key={value}>{value}</option>)}
        </select></label>}
        <button className="btn btn-primary" disabled={busy} onClick={download}>{busy?'Generating…':'Download CSV'}</button>
      </div>
      {notice&&<p role={notice.error?'alert':'status'}>{notice.text}</p>}
    </div>
  </section>;
}
