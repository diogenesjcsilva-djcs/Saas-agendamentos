import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000/api';
let tenantA;
let tenantB;
let tokenA;
let tokenB;

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

async function createTenant(suffix) {
  const result = await request('/tenants', {
    method: 'POST',
    body: {
      name: `Integration Tenant ${suffix}`,
      slug: `integration-tenant-${suffix}-${Date.now()}`,
      description: 'Temporary tenant created by isolated CI tests',
      themeColor: 'indigo',
      ownerName: `Integration Owner ${suffix}`,
      email: `owner-${suffix}-${Date.now()}@example.test`,
      password: 'Integration-Test-Password-2026!',
    },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.ok(result.data.token);
  assert.ok(result.data.tenant.id);
  return result.data;
}

before(async () => {
  const a = await createTenant('alpha');
  const b = await createTenant('beta');
  tenantA = a.tenant;
  tenantB = b.tenant;
  tokenA = a.token;
  tokenB = b.token;
});

test('public API responds and returns security headers', async () => {
  const { response, data } = await request('/tenants');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('protected endpoint rejects missing and malformed JWTs', async () => {
  const missing = await request('/auth/me');
  assert.equal(missing.response.status, 401);
  const malformed = await request('/auth/me', { token: 'not-a-valid-jwt' });
  assert.ok([403, 401].includes(malformed.response.status));
});

test('tenant onboarding issues a valid provider identity scoped to its tenant', async () => {
  const { response, data } = await request('/auth/me', { token: tokenA });
  assert.equal(response.status, 200);
  assert.equal(data.user.role, 'provider');
  assert.equal(data.user.tenantId, tenantA.id);
  assert.ok(data.user.providerId);
});

test('login accepts the correct password and rejects an incorrect password', async () => {
  const email = (await request('/auth/me', { token: tokenA })).data.user.email;
  const good = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'Integration-Test-Password-2026!' },
  });
  assert.equal(good.response.status, 200);
  assert.ok(good.data.token);
  const bad = await request('/auth/login', {
    method: 'POST',
    body: { email, password: 'incorrect-password' },
  });
  assert.equal(bad.response.status, 401);
});

test('public registration creates a client, never a provider', async () => {
  const email = `client-${Date.now()}@example.test`;
  const registered = await request('/auth/register', {
    method: 'POST',
    body: { email, name: 'Integration Client', password: 'Client-Integration-Password-2026!' },
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.data.user.role, 'client');
  assert.equal(registered.data.user.providerId, null);
  const me = await request('/auth/me', { token: registered.data.token });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.role, 'client');
});

test('services filter by provider and tenant together', async () => {
  const mismatch = await request(`/services?providerId=${(await request('/auth/me', { token: tokenA })).data.user.providerId}&tenantId=${tenantB.id}`);
  assert.equal(mismatch.response.status, 200);
  assert.deepEqual(mismatch.data, []);
});

test('provider cannot edit another tenant provider service', async () => {
  const meA = (await request('/auth/me', { token: tokenA })).data.user;
  const meB = (await request('/auth/me', { token: tokenB })).data.user;
  const service = await request('/services', {
    method: 'POST',
    token: tokenA,
    body: { name: 'Tenant A private service', description: 'test', durationMinutes: 30, bufferMinutes: 0, price: 10 },
  });
  assert.equal(service.response.status, 201, JSON.stringify(service.data));
  assert.equal(service.data.providerId, meA.providerId);
  const crossTenantEdit = await request(`/services/${service.data.id}`, {
    method: 'PUT',
    token: tokenB,
    body: { name: 'Unauthorized edit' },
  });
  assert.equal(crossTenantEdit.response.status, 404);
  assert.notEqual(meA.tenantId, meB.tenantId);
});

test('provider cannot change another provider availability rules', async () => {
  const meA = (await request('/auth/me', { token: tokenA })).data.user;
  const meB = (await request('/auth/me', { token: tokenB })).data.user;
  const result = await request('/availability-rules', {
    method: 'PUT',
    token: tokenA,
    body: { providerId: meB.providerId, rules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] },
  });
  assert.equal(result.response.status, 403);
  assert.notEqual(meA.providerId, meB.providerId);
});

test('social login cannot trust client-supplied identity fields', async () => {
  const result = await request('/auth/social-login', {
    method: 'POST',
    body: { email: 'victim@example.test', name: 'Spoofed User' },
  });
  assert.equal(result.response.status, 501);
});


test('booking creation validates service-provider ownership and rejects overlap', async () => {
  const meA = (await request('/auth/me', { token: tokenA })).data.user;
  const meB = (await request('/auth/me', { token: tokenB })).data.user;
  const createdService = await request('/services', {
    method: 'POST',
    token: tokenA,
    body: { name: 'Booking integration service', description: 'test', durationMinutes: 30, bufferMinutes: 0, price: 20 },
  });
  assert.equal(createdService.response.status, 201, JSON.stringify(createdService.data));
  const startsAt = '2032-06-14T10:00:00.000Z';
  const bookingPayload = {
    providerId: meA.providerId,
    serviceId: createdService.data.id,
    startsAt,
    clientName: 'Booking Test Client',
    clientEmail: `booking-${Date.now()}@example.test`,
    clientPhone: '+5511999999999',
    notes: 'created by isolated CI',
  };
  const wrongOwner = await request('/bookings', {
    method: 'POST',
    body: { ...bookingPayload, providerId: meB.providerId },
  });
  assert.equal(wrongOwner.response.status, 400);

  const first = await request('/bookings', { method: 'POST', body: bookingPayload });
  assert.equal(first.response.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.status, 'confirmed');
  assert.equal(first.data.providerId, meA.providerId);

  const overlap = await request('/bookings', {
    method: 'POST',
    body: { ...bookingPayload, clientEmail: `overlap-${Date.now()}@example.test` },
  });
  assert.equal(overlap.response.status, 409);
});

test('booking cancellation is restricted to the owning client or provider', async () => {
  const meA = (await request('/auth/me', { token: tokenA })).data.user;
  const meB = (await request('/auth/me', { token: tokenB })).data.user;
  const service = await request('/services', {
    method: 'POST',
    token: tokenA,
    body: { name: 'Cancellation integration service', description: 'test', durationMinutes: 30, bufferMinutes: 0, price: 20 },
  });
  assert.equal(service.response.status, 201, JSON.stringify(service.data));
  const email = `cancel-owner-${Date.now()}@example.test`;
  const booking = await request('/bookings', {
    method: 'POST',
    body: {
      providerId: meA.providerId,
      serviceId: service.data.id,
      startsAt: '2032-06-14T12:00:00.000Z',
      clientName: 'Cancellation Test Client',
      clientEmail: email,
      clientPhone: '+5511888888888',
    },
  });
  assert.equal(booking.response.status, 201, JSON.stringify(booking.data));

  const otherProvider = await request(`/bookings/${booking.data.id}`, {
    method: 'PATCH',
    token: tokenB,
    body: { status: 'cancelled' },
  });
  assert.equal(otherProvider.response.status, 403);

  const owner = await request('/auth/register', {
    method: 'POST',
    body: { email, name: 'Cancellation Test Client', password: 'Client-Integration-Password-2026!' },
  });
  assert.equal(owner.response.status, 201, JSON.stringify(owner.data));
  const cancel = await request(`/bookings/${booking.data.id}`, {
    method: 'PATCH',
    token: owner.data.token,
    body: { status: 'cancelled' },
  });
  assert.equal(cancel.response.status, 200, JSON.stringify(cancel.data));
  assert.equal(cancel.data.status, 'cancelled');

  const reopen = await request(`/bookings/${booking.data.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: { status: 'confirmed' },
  });
  assert.equal(reopen.response.status, 409);
  assert.notEqual(meA.providerId, meB.providerId);
});
