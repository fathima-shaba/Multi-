import { useState } from 'react';
import { AdminPager,RequestStatus,useAdminData } from './catalogTools';
import { businessDate } from './businessUi';

export default function AdminActivity() {
  const [query,setQuery]=useState('');
  const [offset,setOffset]=useState(0);
  const [revision,setRevision]=useState(0);
  const result=useAdminData('/activity?'+new URLSearchParams({q:query,offset}),revision);
  return <section>
    <h1 className="page-title">Administrator Activity</h1>
    <div className="admin-controls"><label>Search actor, action or record<input className="input" value={query} maxLength={254}
      onChange={event=>{setQuery(event.target.value);setOffset(0);}} /></label></div>
    <RequestStatus {...result} retry={()=>setRevision(value=>value+1)} />
    {result.data&&<>
      <div className="card admin-table-wrap"><table className="admin-table"><thead><tr><th>Administrator</th><th>Action</th><th>Record</th><th>Time</th></tr></thead>
        <tbody>{result.data.activity.map(entry=><tr key={entry.id}><td>{entry.actorName}</td><td>{entry.action}</td>
          <td>{entry.targetType}<br />{entry.targetId}</td><td>{businessDate(entry.createdAt)}</td></tr>)}
          {!result.data.activity.length&&<tr><td colSpan={4}>No matching activity.</td></tr>}</tbody>
      </table></div>
      <AdminPager offset={offset} nextOffset={result.data.nextOffset} setOffset={setOffset} />
    </>}
  </section>;
}
