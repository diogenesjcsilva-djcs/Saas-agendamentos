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
