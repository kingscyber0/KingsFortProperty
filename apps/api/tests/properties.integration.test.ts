import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createPropertiesRouter } from '../src/routes/properties';

const rows: any[] = [
  { id: 'property-a', companyId: 'company-a', propertyCode: 'KF-A', name: 'A property', propertyType: 'Flat', location: 'Lagos', fullAddress: '1 A Street, Lagos', transactionType: 'RENT', price: '500000.00', availability: 'AVAILABLE', approval: 'PENDING', owners: [], createdBy: { id: 'user-a', name: 'Company A Admin' }, createdById: 'user-a', createdAt: new Date(), updatedAt: new Date() },
  { id: 'property-b', companyId: 'company-b', propertyCode: 'KF-B', name: 'B private property', propertyType: 'House', location: 'Abuja', fullAddress: '2 B Street, Abuja', transactionType: 'SALE', price: '90000000.00', availability: 'AVAILABLE', approval: 'PENDING', owners: [], createdBy: { id: 'user-b', name: 'Company B Admin' }, createdById: 'user-b', createdAt: new Date(), updatedAt: new Date() },
];

test('Company A cannot list, read, or edit Company B properties over HTTP', async context => {
  const byCompany = (companyId: string) => rows.filter(row => row.companyId === companyId);
  const fakeDb: any = {
    property: {
      findMany: async ({ where }: any) => byCompany(where.companyId),
      count: async ({ where }: any) => byCompany(where.companyId).length,
      findFirst: async ({ where }: any) => rows.find(row => row.id === where.id && row.companyId === where.companyId) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = rows.find(item => item.id === where.id && item.companyId === where.companyId);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    propertyOwner: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
    auditLog: { create: async () => ({ id: 'test-audit' }) },
    $transaction: async (operation: any) => Array.isArray(operation) ? Promise.all(operation) : operation(fakeDb),
  };
  const authenticate = (req: Request, _res: Response, next: NextFunction) => {
    req.auth = { userId: 'user-a', companyId: 'company-a', email: 'admin@a.test', role: 'SUPER_ADMIN', sessionVersion: 0 };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use('/api/workspace', createPropertiesRouter(fakeDb, authenticate));
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api/workspace/properties';

  const list = await fetch(base);
  assert.equal(list.status, 200);
  const payload = await list.json() as { properties: Array<{ id: string }> };
  assert.deepEqual(payload.properties.map(property => property.id), ['property-a']);

  const foreignRead = await fetch(base + '/property-b');
  assert.equal(foreignRead.status, 404);

  const foreignEdit = await fetch(base + '/property-b', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Changed from Company A' }) });
  assert.equal(foreignEdit.status, 404);
  assert.equal(rows.find(row => row.id === 'property-b')?.name, 'B private property');
});
