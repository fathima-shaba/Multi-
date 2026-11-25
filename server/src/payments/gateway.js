import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../http.js';

export const unavailable = () => new HttpError(503,'RAZORPAY_UNAVAILABLE','Razorpay Test Mode is unavailable. Demo Cash on Delivery is still available.');

export function createRazorpayGateway(env = process.env) {
  const { RAZORPAY_KEY_ID:keyId, RAZORPAY_KEY_SECRET:keySecret, RAZORPAY_WEBHOOK_SECRET:webhookSecret } = env;
  if (!/^rzp_test_[a-zA-Z0-9]+$/.test(keyId || '') || !keySecret || !webhookSecret) return null;
  const sdk = new Razorpay({ key_id:keyId,key_secret:keySecret });
  return {
    keyId, keySecret, webhookSecret,
    createOrder: data => sdk.orders.create(data),
    fetchOrder: id => sdk.orders.fetch(id),
    fetchPayment: id => sdk.payments.fetch(id),
    fetchOrderPayments: id => sdk.orders.fetchPayments(id),
  };
}

export function signatureMatches(payload, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(createHmac('sha256',secret).update(payload).digest(),Buffer.from(signature,'hex'));
}

export async function gatewayCall(operation) {
  let timeout;
  try {
    return await Promise.race([
      operation(),
      new Promise((_,reject)=>{ timeout=setTimeout(()=>reject(unavailable()),10000); }),
    ]);
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timeout);
  }
}
