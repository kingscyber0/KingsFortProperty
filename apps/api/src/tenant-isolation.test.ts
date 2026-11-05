import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve(process.cwd(), '../../prisma/schema.prisma'), 'utf8');
function model(name: string): string {
  const match = schema.match(new RegExp('model ' + name + ' \\{([\\s\\S]*?)\\n\\}'));
  assert.ok(match, `Prisma model ${name} exists`);
  return match[1];
}

test('tenant-owned parent records expose same-company composite keys', () => {
  for (const name of ['User', 'Property', 'Tenant']) {
    assert.match(model(name), /@@unique\(\[companyId,id\]\)/, `${name} has a composite company key`);
  }
});

test('property children cannot reference a property from another company', () => {
  for (const name of ['PropertyOwner', 'PropertyStatusHistory', 'Inspection']) {
    const body = model(name);
    assert.match(body, /companyId String/);
    assert.match(body, /fields:\[companyId,propertyId\], references:\[companyId,id\]/);
  }
});

test('rent payments cannot reference another company tenant', () => {
  const body = model('RentPayment');
  assert.match(body, /tenant Tenant @relation\(fields:\[companyId,tenantId\], references:\[companyId,id\]/);
  assert.match(body, /@@index\(\[companyId,tenantId\]\)/);
});

test('staff assignment relations use the record company key', () => {
  for (const [name, relation] of [['Property', 'PropertyCreator'], ['PropertyStatusHistory', 'StatusChangedBy'], ['Lead', 'LeadAssignee'], ['Inspection', 'InspectionAssignee']] as const) {
    assert.match(model(name), new RegExp('User\\?? @relation\\("' + relation + '"'));
    assert.match(model(name), /fields:\[companyId,[A-Za-z]+Id\], references:\[companyId,id\]/);
  }
});

test('audit actor references cannot cross company boundaries', () => {
  assert.match(model('AuditLog'), /user User\? @relation\(fields:\[companyId,userId\], references:\[companyId,id\]/);
});
