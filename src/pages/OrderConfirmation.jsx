import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { accountRequest } from '../api/account';
import { formatPaise, useCommerceQuery } from '../api/commerce';
import OrderDetails from '../components/OrderDetails';
import CatalogState from '../components/CatalogState';
import { useShop } from '../context/ShopContext';
import { useCart } from '../context/CartContext';
import { payWithRazorpay } from '../api/razorpay';
import './Checkout.css';
import './Profile.css';

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const path = '/orders/' + encodeURIComponent(orderId);
  const result = useCommerceQuery(path);
  const paymentDetails = useCommerceQuery(result.data?.order ? path+'/payment' : null);
  const { retryCatalog } = useShop();
  const { refresh } = useCart();
  const [pendingCancel, setPendingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function cancel() {
    setNotice(null);
    setBusy(true);
    try {
      await accountRequest(path + '/cancel', { method: 'POST' });
      setPendingCancel(false);
      setNotice({ text: 'Order cancelled.' });
      result.retry();
      paymentDetails.retry();
      refresh();
      retryCatalog();
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function checkPayment(resume) {
    setNotice(null);
    setBusy(true);
    try {
      if (resume) {
        const session=await accountRequest('/payments/razorpay/'+orderId+'/resume',{method:'POST'});
        await payWithRazorpay(session,()=>setNotice({text:'Verifying payment with Razorpay…'}));
      } else {
        await accountRequest(path+'/payment/check',{method:'POST'});
      }
      setNotice({text:'Payment status updated.'});
      result.retry();
      paymentDetails.retry();
      refresh();
      retryCatalog();
    } catch(error) {
      setNotice({text:error.message,error:true});
    } finally {
      setBusy(false);
    }
  }

  if (result.loading || (result.error && result.status !== 404)) {
    return <CatalogState loading={result.loading} error={result.error} retry={result.retry} label="Loading your order…" />;
  }
  const order = result.data?.order;
  const payment=paymentDetails.data?.payment;
  const awaiting=order?.paymentMethod==='razorpay'&&!order.finalizedAt&&order.status!=='Cancelled';
  return (
    <div className="checkout-page container success-view">
      <div className="success-card card">
        {order ? (
          <>
            {order.status !== 'Cancelled' && !awaiting && <CheckCircle size={64} className="success-icon" />}
            <h2>{order.status === 'Cancelled' ? 'Order cancelled' : awaiting ? 'Awaiting verified payment' : 'Order placed for ' + formatPaise(order.totalPaise) + '!'}</h2>
            <p>Order <strong>#{order.orderNumber}</strong> · {order.status}</p>
            <div className="account-actions">
              <a className="btn btn-primary" href="#order-tracking">Track Order</a>
              <Link className="btn btn-outline" to="/orders">Order History</Link>
            </div>
          </>
        ) : (
          <>
            <h2>Order not found</h2>
            <Link className="btn btn-primary" to="/orders">Order History</Link>
          </>
        )}
      </div>
      {order && <section className="orders-section card order-receipt" aria-label="Order details">
        <OrderDetails order={order} />
        {order.paymentMethod==='razorpay' && <section>
          <h3>Payment details</h3>
          {paymentDetails.loading && <p role="status">Loading payment details…</p>}
          {paymentDetails.error && <p role="alert">{paymentDetails.error} <button className="btn btn-outline" onClick={paymentDetails.retry}>Try Again</button></p>}
          {payment && <>
            <p>Razorpay Test Mode · {formatPaise(payment.amountPaise)} · {payment.status}</p>
            {payment.providerPaymentId && <p>Transaction: {payment.providerPaymentId}</p>}
            {payment.method && <p>Method: {payment.method}</p>}
            {payment.verifiedAt && <p>Verified: {new Date(payment.verifiedAt).toLocaleString('en-IN')}</p>}
            {awaiting && payment.expiresAt && <p>Stock held until {new Date(payment.expiresAt).toLocaleString('en-IN')}.</p>}
            {payment.failureReason && <p>{payment.failureReason}</p>}
            <div className="account-actions">
              {awaiting && payment.providerOrderId && payment.status!=='Authorized' && <button className="btn btn-primary" disabled={busy} onClick={()=>checkPayment(true)}>Resume Test Payment</button>}
              {payment.providerOrderId && <button className="btn btn-outline" disabled={busy} onClick={()=>checkPayment(false)}>Check Payment Status</button>}
            </div>
          </>}
        </section>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
        {order.canCancel && <div className="account-actions">
          {pendingCancel ? <>
            <button className="btn btn-primary" disabled={busy} onClick={cancel}>Confirm Cancellation</button>
            <button className="btn btn-outline" disabled={busy} onClick={() => setPendingCancel(false)}>Keep Order</button>
          </> : <button className="btn btn-outline" disabled={busy} onClick={() => setPendingCancel(true)}>Cancel Order</button>}
        </div>}
      </section>}
    </div>
  );
}
