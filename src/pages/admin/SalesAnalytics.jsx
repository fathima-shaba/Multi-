import { useState } from 'react';
import { Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { DateRangeForm,initialRange,reportMoney } from './businessUi';
import { RequestStatus,useAdminData } from './catalogTools';

const colors=['#2874f0','#16864a','#ef7f29'];
const modeNames={demo_cod:'Demo COD',razorpay:'Razorpay Test Mode'};

function Trend({title,data,lines,money=false,empty}) {
  return <section className="card business-chart"><h2>{title}</h2>
    {empty?<p>No results for these dates.</p>:<div className="business-chart-size"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data} margin={{top:10,right:12,left:0,bottom:8}} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={26} tick={{fontSize:11}} />
        <YAxis allowDecimals={money} tick={{fontSize:11}} width={money?62:38} />
        <Tooltip formatter={(value,name,entry)=>money?[reportMoney(entry.payload[entry.dataKey+'Paise']),name]:[value,name]} />
        <Legend />{lines.map(([key,label],index)=><Line key={key} type="monotone" dataKey={key} name={label} stroke={colors[index]} strokeWidth={2} dot={data.length<15} />)}
      </LineChart>
    </ResponsiveContainer></div>}
  </section>;
}

function Rankings({title,data,keyName}) {
  return <section className="card business-chart"><h2>{title}</h2>
    {!data.length?<p>No results for these dates.</p>:<div className="business-chart-size"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} layout="vertical" margin={{left:4,right:18}} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={105} tick={{fontSize:10}} tickFormatter={name=>name.length>17?name.slice(0,16)+'…':name} />
        <Tooltip /><Bar dataKey={keyName} name={keyName==='units'?'Units':'Orders'} fill={colors[0]} />
      </BarChart>
    </ResponsiveContainer></div>}
  </section>;
}

export default function SalesAnalytics() {
  const [range,setRange]=useState(initialRange);
  const [revision,setRevision]=useState(0);
  const suffix='?'+new URLSearchParams(range);
  const sales=useAdminData('/analytics/sales'+suffix,revision);
  const products=useAdminData('/analytics/products'+suffix,revision);
  const customers=useAdminData('/analytics/customers'+suffix,revision);
  const retry=()=>setRevision(value=>value+1);
  const series=sales.data?.series.map(row=>({...row,demoCod:Number(row.demoCodPaise)/100,verifiedTest:Number(row.verifiedTestPaise)/100}))||[];
  return <section>
    <h1 className="page-title">Sales Analytics</h1>
    <p>Dates use India time. Test captures and demo COD totals are separate. Product rankings use delivered orders.</p>
    <DateRangeForm range={range} setRange={setRange} group />
    <div className="business-grid">
      <RequestStatus {...sales} retry={retry} />
      {sales.data&&<>
        <Trend title="Order Trends" data={series} lines={ [['orders','Placed'],['completed','Delivered']] } empty={!series.some(row=>row.orders)} />
        <Trend title="Revenue Trends (INR)" data={series} lines={ [['verifiedTest','Verified test captures'],['demoCod','Demo COD']] } money empty={!series.some(row=>row.verifiedTest||row.demoCod)} />
        <Rankings title="Order Status Distribution" data={sales.data.statuses} keyName="count" />
        <Rankings title="Payment Method Distribution" data={sales.data.methods.map(item=>({...item,name:modeNames[item.name]||item.name}))} keyName="count" />
      </>}
      <RequestStatus {...products} retry={retry} />
      {products.data&&<><Rankings title="Best-Selling Products" data={products.data.products} keyName="units" />
        <Rankings title="Popular Categories" data={products.data.categories} keyName="units" /></>}
      <RequestStatus {...customers} retry={retry} />
      {customers.data&&<Trend title="Customer Registrations" data={customers.data.series} lines={ [['count','Registrations']] } empty={!customers.data.series.some(row=>row.count)} />}
    </div>
  </section>;
}
