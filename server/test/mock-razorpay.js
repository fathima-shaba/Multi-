import { createHmac,randomBytes } from 'node:crypto';

export function mockRazorpay() {
  const orders=new Map(), payments=new Map();
  const keySecret=randomBytes(24).toString('hex'), webhookSecret=randomBytes(24).toString('hex');
  let created=0;
  const sign=(body,secret)=>createHmac('sha256',secret).update(body).digest('hex');
  return {
    keyId:'rzp_test_mockfixture',keySecret,webhookSecret,orders,payments,
    get created(){return created;},
    failCreate:false,
    async createOrder(data){
      created++;
      const id='order_Mock'+randomBytes(8).toString('hex');
      const order={...data,id};
      orders.set(id,order);
      await new Promise(resolve=>setTimeout(resolve,50));
      if (this.failCreate) throw new Error('Simulated ambiguous gateway response');
      return order;
    },
    async fetchOrder(id){return orders.get(id);},
    async fetchPayment(id){return payments.get(id);},
    async fetchOrderPayments(id){return {items:[...payments.values()].filter(payment=>payment.order_id===id)};},
    observe(orderId,status,changes={}){
      const order=orders.get(orderId);
      if(!order) throw new Error('Unknown fixture order');
      const id=changes.id||'pay_Mock'+randomBytes(8).toString('hex');
      const observed={id,order_id:orderId,amount:order.amount,currency:'INR',status,
        captured:status==='captured',method:'upi',amount_refunded:0,created_at:Date.now(),...changes};
      payments.set(id,observed);
      return observed;
    },
    callback(orderId,paymentId){
      return {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:sign(orderId+'|'+paymentId,keySecret)};
    },
    signWebhook(raw){return sign(raw,webhookSecret);},
  };
}
