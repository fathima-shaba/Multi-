import { useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { accountRequest } from '../../api/account';
import { AdminModal,AdminPager,RequestStatus,useAdminData } from './catalogTools';
import { businessDate,reportMoney } from './businessUi';

export default function ManageCustomers() {
  const [params,setParams]=useSearchParams();
  const id=params.get('customer');
  const [filters,setFilters]=useState({q:'',status:''});
  const [offset,setOffset]=useState(0);
  const [orderOffset,setOrderOffset]=useState(0);
  const [revision,setRevision]=useState(0);
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const listing=useAdminData('/customers?'+new URLSearchParams({...filters,offset}),revision);
  const details=useAdminData(id?'/customers/'+encodeURIComponent(id)+'?offset='+orderOffset:null,revision);
  const customer=details.data?.customer;
  const reload=()=>setRevision(value=>value+1);

  function open(customerId) {
    setOrderOffset(0);setConfirm(false);setError('');setNotice('');
    setParams(customerId?{customer:customerId}:{});
  }
  function filter(event) {
    setOffset(0);setFilters({...filters,[event.target.name]:event.target.value});
  }
  async function changeStatus() {
    setBusy(true);setError('');
    const active=!customer.active;
    try {
      await accountRequest('/admin/customers/'+customer.id+'/status',{method:'PATCH',body:{active}});
      setNotice(active?'Customer activated.':'Customer deactivated. Their sessions were revoked.');
      setConfirm(false);reload();
    } catch(failure) {setError(failure.message);}
    finally {setBusy(false);}
  }

  return <section>
    <h1 className="page-title">Manage Customers</h1>
    <div className="admin-controls">
      <label>Search name or email<input className="input" name="q" value={filters.q} maxLength={254} onChange={filter} /></label>
      <label>Account status<select className="input" name="status" value={filters.status} onChange={filter}>
        <option value="">All accounts</option><option>Active</option><option>Inactive</option>
      </select></label>
    </div>
    <RequestStatus {...listing} retry={reload} />
    {listing.data&&<>
      <div className="card admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Customer</th><th>Registered</th><th>Status</th><th>Orders</th><th>Actions</th></tr></thead>
        <tbody>{listing.data.customers.map(row=><tr key={row.id}><td>{row.name}<br />{row.email}</td><td>{businessDate(row.createdAt)}</td>
          <td><span className={'badge '+(row.active?'badge-success':'badge-danger')}>{row.active?'Active':'Inactive'}</span></td>
          <td>{row.orderCount}</td><td><button className="btn btn-outline" onClick={()=>open(row.id)}>View Customer</button></td>
        </tr>)}{!listing.data.customers.length&&<tr><td colSpan={5}>No matching customers.</td></tr>}</tbody>
      </table></div>
      <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
    </>}
    {id&&<AdminModal title="Customer Details" cancel={()=>open(null)} busy={busy}>
      {notice&&<p role="status">{notice}</p>}
      <RequestStatus {...details} retry={reload} />
      {customer&&<>
        <h3>{customer.name}</h3><p>{customer.email}</p><p>{customer.phone||'No phone on file'}</p>
        <p>Registered {businessDate(customer.createdAt)} · {customer.active?'Active':'Inactive'}</p>
        <h3>Order History</h3>
        {!details.data.orders.length?<p>No orders on this page.</p>:<ul className="business-recent">
          {details.data.orders.map(order=><li key={order.id}><Link to={'/admin/orders?q='+encodeURIComponent(order.orderNumber)}>{order.orderNumber}</Link>
            <small>{businessDate(order.createdAt)} · {order.status} · {reportMoney(order.totalPaise)}</small></li>)}
        </ul>}
        {(orderOffset>0||details.data.nextOffset!==null)&&<AdminPager offset={orderOffset} nextOffset={details.data.nextOffset} setOffset={setOrderOffset} />}
        {confirm&&<p>{customer.active?'Deactivate this account and revoke its sessions?':'Reactivate this customer account?'}</p>}
        {error&&<p role="alert">{error}</p>}
        <div className="admin-controls">
          {confirm?<><button className="btn btn-primary" disabled={busy} onClick={changeStatus}>Confirm {customer.active?'Deactivation':'Activation'}</button>
            <button className="btn btn-outline" disabled={busy} onClick={()=>{setConfirm(false);setError('');}}>Cancel</button></>:
            <button className="btn btn-primary" onClick={()=>setConfirm(true)}>{customer.active?'Deactivate Customer':'Activate Customer'}</button>}
        </div>
      </>}
      <button className="btn btn-outline" disabled={busy} onClick={()=>open(null)}>Close</button>
    </AdminModal>}
  </section>;
}
