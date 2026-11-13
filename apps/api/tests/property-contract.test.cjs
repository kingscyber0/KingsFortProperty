const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('property endpoints authenticate and enforce operation permissions', () => {
  const source = read('apps/api/src/routes/properties.ts');
  assert.ok(source.includes('authenticate = requireAuth'));
  assert.ok(source.includes('propertiesRouter.use(authenticate)'));
  for (const permission of ['properties:read', 'properties:create', 'properties:update', 'properties:approve']) {
    assert.ok(source.includes("requirePermission('" + permission + "')"), permission + ' is enforced');
  }
});

test('property reads and writes derive company scope from the authenticated session', () => {
  const source = read('apps/api/src/routes/properties.ts');
  assert.ok(source.includes('companyId: req.auth!.companyId'));
  assert.ok(source.includes('createdById: req.auth!.userId'));
  assert.ok(!source.includes('req.body.companyId'));
  assert.ok(!source.includes('input.companyId'));
  assert.ok(source.includes('id: req.params.id as string, companyId: req.auth!.companyId'));
});

test('property changes are audited and record availability and approval history', () => {
  const source = read('apps/api/src/routes/properties.ts');
  for (const action of ['PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_AVAILABILITY_CHANGED', 'PROPERTY_APPROVAL_CHANGED']) {
    assert.ok(source.includes("action: '" + action + "'"), action + ' is audited');
  }
  assert.equal(source.split('tx.propertyStatusHistory.create').length - 1, 2);
});
