import { Router } from 'express';
import { HttpError } from '../http.js';
import { addressId, fields, invalid, phone, text } from './validation.js';

export const addressColumns = 'id, recipient, phone, address_line AS "addressLine", locality, city, state, pincode, country_code AS "countryCode"';
const columns = addressColumns;
const inputs = ['recipient', 'phone', 'addressLine', 'locality', 'city', 'state', 'pincode'];

export function addressValues(body, partial = false) {
  const input = fields(body, inputs);
  if (partial && !Object.keys(input).length) invalid('Provide address changes.');
  const read = (key, validate) => input[key] === undefined && partial ? null : validate(input[key]);
  const pin = value => {
    const result = text(value, 'PIN code', 6, 6);
    if (!/^\d{6}$/.test(result)) invalid('Enter a 6-digit PIN code.');
    return result;
  };
  return [
    read('recipient', value => text(value, 'Recipient', 2, 100)),
    read('phone', phone),
    read('addressLine', value => text(value, 'Street address', 3, 200)),
    read('locality', value => text(value ?? '', 'Locality', 0, 100)),
    read('city', value => text(value, 'City', 2, 100)),
    read('state', value => text(value, 'State', 2, 100)),
    read('pincode', pin),
  ];
}

function missing() {
  return new HttpError(404, 'ADDRESS_NOT_FOUND', 'Shipping address not found.');
}

export function addressRoutes(pool) {
  const router = Router();
  router.get('/', async (_request, response) => {
    const { rows } = await pool.query(`SELECT ${columns} FROM addresses WHERE user_id = $1 ORDER BY created_at, id`, [response.locals.user.id]);
    response.json({ addresses: rows });
  });
  router.post('/', async (request, response) => {
    const { rows: [address] } = await pool.query(`INSERT INTO addresses
      (user_id, recipient, phone, address_line, locality, city, state, pincode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${columns}`, [response.locals.user.id, ...addressValues(request.body)]);
    response.status(201).json({ address });
  });
  router.patch('/:id', async (request, response) => {
    const { rows: [address] } = await pool.query(`UPDATE addresses SET
      recipient = COALESCE($3, recipient), phone = COALESCE($4, phone), address_line = COALESCE($5, address_line),
      locality = COALESCE($6, locality), city = COALESCE($7, city), state = COALESCE($8, state),
      pincode = COALESCE($9, pincode), updated_at = now()
      WHERE user_id = $1 AND id = $2 RETURNING ${columns}`,
    [response.locals.user.id, addressId(request.params.id), ...addressValues(request.body, true)]);
    if (!address) throw missing();
    response.json({ address });
  });
  router.delete('/:id', async (request, response) => {
    const result = await pool.query('DELETE FROM addresses WHERE user_id = $1 AND id = $2', [response.locals.user.id, addressId(request.params.id)]);
    if (!result.rowCount) throw missing();
    response.sendStatus(204);
  });
  return router;
}
