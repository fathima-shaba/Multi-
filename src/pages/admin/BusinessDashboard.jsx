import { Activity,Boxes,IndianRupee,ShoppingCart,Star,Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RequestStatus,useAdminData } from './catalogTools';
import { businessDate,reportMoney } from './businessUi';
import { useState } from 'react';

const cards=[
  ['customers','Registered customers',Users],['products','Total products',Boxes],['categories','Total categories',Boxes],
  ['orders','Total placed orders',ShoppingCart],['completed','Completed orders',ShoppingCart],
  ['pending','Pending orders',ShoppingCart],['cancelled','Cancelled orders',ShoppingCart],
  ['awaitingPayment','Awaiting online payment',Activity],
  ['verifiedTestPaise','Verified Razorpay Test Mode captures',IndianRupee,reportMoney],
  ['demoCodPaise','Demo COD order totals',IndianRupee,reportMoney],
  ['unpaidOnlinePaise','Unpaid online order totals',IndianRupee,reportMoney],
  ['lowStock','Low-stock products',Boxes],['outOfStock','Out-of-stock products',Boxes],
  ['reviews','Published reviews',Star],['rating','Average customer rating',Star,value=>value===null?'Unrated':Number(value).toFixed(1)+' / 5'],
];

export default function BusinessDashboard() {
  const [revision,setRevision]=useState(0);
  const report=useAdminData('/dashboard',revision),data=report.data;
  return <section className="admin-dashboard">
    <h1 className="page-title">Dashboard Overview</h1>
    <p>Verified test captures and simulated COD totals are shown separately. Live payment collection is disabled.</p>
    <RequestStatus {...report} retry={()=>setRevision(value=>value+1)} />
    {data&&<>
      <div className="business-stat-grid">
        {cards.map(([key,label,Icon,format])=><article className="stat-card card" key={key} data-metric={key}>
          <div className="stat-icon bg-primary-light"><Icon size={23} /></div>
          <div><h3>{label}</h3><p className="stat-value">{format?format(data.stats[key]):data.stats[key].toLocaleString('en-IN')}</p></div>
        </article>)}
      </div>
      <div className="business-grid">
        <section className="card recent-orders admin-table-wrap"><h3>Recent Orders</h3>
          {data.recentOrders.length?<table className="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{data.recentOrders.map(order=><tr key={order.id}><td><Link to={'/admin/orders?q='+encodeURIComponent(order.orderNumber)}>{order.orderNumber}</Link></td>
              <td>{businessDate(order.createdAt)}</td><td>{reportMoney(order.totalPaise)}</td><td>{order.status}</td></tr>)}</tbody></table>:<p>No placed orders yet.</p>}
        </section>
        <section className="card recent-orders"><h3>Recent Customer Registrations</h3>
          {data.recentCustomers.length?<ul className="business-recent">{data.recentCustomers.map(customer=><li key={customer.id}>
            <Link to={'/admin/customers?customer='+customer.id}>{customer.name}</Link>
            <small>{businessDate(customer.createdAt)} · {customer.active?'Active':'Inactive'}</small>
          </li>)}</ul>:<p>No customers registered yet.</p>}
        </section>
        <section className="card recent-orders"><h3>Recent Inventory Activity</h3>
          {data.recentInventory.length?<ul className="business-recent">{data.recentInventory.map(item=><li key={item.id}>
            <span>{item.productName}</span><small>{item.delta>0?'+':''}{item.delta} units · {businessDate(item.createdAt)}</small>
          </li>)}</ul>:<p>No stock movements yet.</p>}
        </section>
      </div>
    </>}
  </section>;
}
