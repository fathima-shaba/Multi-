import { accountRequest } from './account';

let checkoutScript;
function loadCheckout() {
  if (typeof window.Razorpay==='function') return Promise.resolve(window.Razorpay);
  if (!checkoutScript) {
    checkoutScript=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://checkout.razorpay.com/v1/checkout.js';
      script.async=true;
      const failed=()=>{
        clearTimeout(timeout);
        script.remove();
        checkoutScript=null;
        reject(new Error('Could not load Razorpay Checkout. Please try again.'));
      };
      const timeout=setTimeout(failed,12000);
      script.onerror=failed;
      script.onload=()=>{
        if (typeof window.Razorpay!=='function') return failed();
        clearTimeout(timeout);
        resolve(window.Razorpay);
      };
      document.head.append(script);
    });
  }
  return checkoutScript;
}

export async function payWithRazorpay(session,onVerifying) {
  const Razorpay=await loadCheckout();
  const response=await new Promise((resolve,reject)=>{
    const dismiss=()=>reject(Object.assign(new Error('Payment window closed. Retry or cancel the reservation from Order History.'),{code:'DISMISSED'}));
    const checkout=new Razorpay({
      ...session.checkout,
      name:'MultiStore',
      description:'Test Mode · No real payment',
      theme:{color:'#2874f0'},
      handler:resolve,
      modal:{ondismiss:dismiss},
    });
    checkout.on('payment.failed',()=>{
      reject(Object.assign(new Error('The test payment failed. You can retry before the stock reservation expires.'),{code:'PAYMENT_FAILED'}));
      checkout.close();
    });
    checkout.open();
  });
  onVerifying?.();
  return accountRequest('/payments/razorpay/verify',{method:'POST',body:{
    orderId:session.orderId,
    razorpay_order_id:response.razorpay_order_id,
    razorpay_payment_id:response.razorpay_payment_id,
    razorpay_signature:response.razorpay_signature,
  }});
}
