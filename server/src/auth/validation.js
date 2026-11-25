import { HttpError } from '../http.js';

export function invalid(message) {
  throw new HttpError(400, 'INVALID_INPUT', message);
}

export function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
    invalid('The request contains invalid fields.');
  }
  return body;
}

export function text(value, label, min, max) {
  // Reject control characters in human-readable account and address fields.
  // oxlint-disable-next-line eslint/no-control-regex
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) invalid(label + ' is invalid.');
  const result = value.trim();
  if (result.length < min || result.length > max) invalid(label + ' must be ' + min + '–' + max + ' characters.');
  return result;
}

export function email(value) {
  const normalized = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalized)) invalid('Enter a valid email address.');
  return normalized;
}

export function phone(value) {
  if (typeof value !== 'string' || !/^[0-9]{10}$/.test(value.trim())) invalid('Enter a 10-digit phone number.');
  return value.trim();
}

export function password(value, minimum = 12) {
  if (typeof value !== 'string' || value.length < minimum || value.length > 128 || value.includes('\0')) {
    invalid('Password must be ' + minimum + '–128 characters.');
  }
  return value;
}

export function addressId(value) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) invalid('Invalid address ID.');
  return value;
}
