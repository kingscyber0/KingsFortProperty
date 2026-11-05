const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('elevated invitations are restricted to Super Admins', () => {
  const source = read('packages/shared/src/index.ts');
  assert.match(source, /ELEVATED_INVITATION_ROLES[^\n]*SUPER_ADMIN[^\n]*MANAGER[^\n]*HR/);
  assert.match(source, /if \(ELEVATED_INVITATION_ROLES\.has\(invitedRole\)\) return inviterRole === 'SUPER_ADMIN'/);
  assert.match(read('apps/api/src/routes/workspace.ts'), /canInviteRole\(req\.auth!\.role,input\.role\)/);
});

test('invitation acceptance is public, rate limited, and claimed once in its account transaction', () => {
  const server = read('apps/api/src/server.ts');
  const publicRouter = read('apps/api/src/routes/invitationAcceptance.ts');
  const workspace = read('apps/api/src/routes/workspace.ts');
  assert.match(server, /app\.use\('\/api\/workspace',invitationAcceptanceRouter\)/);
  assert.doesNotMatch(workspace, /invitations\/accept/);
  assert.match(publicRouter, /rateLimit\(/);
  assert.match(publicRouter, /prisma\.\$transaction\(async tx/);
  assert.match(publicRouter, /tx\.invitation\.updateMany\([\s\S]*acceptedAt: null[\s\S]*expiresAt: \{ gt: now \}/);
  assert.match(publicRouter, /if \(claimed\.count !== 1\) return null/);
  assert.match(publicRouter, /created: true, company: invite\.company, user/);
});

test('access tokens have short lifetimes and resolve current account role from the database', () => {
  const route = read('apps/api/src/routes/auth.ts');
  const middleware = read('apps/api/src/middleware/auth.ts');
  assert.match(route, /expiresIn:'15m'/);
  assert.match(route, /algorithm:'HS256'/);
  assert.match(route, /sessionVersion:user\.sessionVersion/);
  assert.match(middleware, /algorithms:\['HS256'\],issuer:'kingsfortproperty',audience:'kingsfortproperty-api'/);
  assert.match(middleware, /where:\{id:claims\.sub,companyId:claims\.companyId,active:true\}/);
  assert.match(middleware, /user\.sessionVersion !== claims\.sessionVersion/);
  assert.match(middleware, /role:user\.role as StaffRole/);
  assert.match(route, /authRouter\.post\('\/logout',requireAuth/);
  assert.match(route, /sessionVersion:\{increment:1\}/);
  assert.match(route, /action:'SESSION_REVOKED'/);
});

test('existing workspace reads and writes derive tenant scope from the session', () => {
  const workspace = read('apps/api/src/routes/workspace.ts');
  assert.match(workspace, /workspaceRouter\.use\(requireAuth\)/);
  assert.match(workspace, /where:\{companyId:req\.auth!\.companyId\}/);
  assert.match(workspace, /where:\{id:req\.auth!\.companyId\}/);
  assert.match(workspace, /where:\{id:req\.auth!\.userId,companyId:req\.auth!\.companyId\}/);
  const auth = read('apps/api/src/routes/auth.ts');
  assert.match(auth, /id:req\.auth!\.userId,companyId:req\.auth!\.companyId,active:true/);
});

test('company settings are permission checked, validated, tenant scoped, and audited', () => {
  const workspace = read('apps/api/src/routes/workspace.ts');
  assert.match(workspace, /get\('\/company',requirePermission\('company:read'\)/);
  assert.match(workspace, /patch\('\/company',requirePermission\('company:update'\)/);
  assert.match(workspace, /\.strict\(\)\.refine\(value=>Object\.keys\(value\)\.length>0/);
  assert.match(workspace, /where:\{id:req\.auth!\.companyId\},data,select:/);
  assert.match(workspace, /action:'COMPANY_SETTINGS_UPDATED'/);
});

test('dependent records use same-company composite foreign keys', () => {
  const schema = read('prisma/schema.prisma');
  const getModel = name => schema.match(new RegExp('model ' + name + ' \\{([\\s\\S]*?)\\n\\}'))?.[1];
  for (const modelName of ['User', 'Property', 'Tenant']) {
    const body = getModel(modelName);
    assert.ok(body, modelName + ' model exists');
    assert.match(body, /@@unique\(\[companyId,id\]\)/, modelName + ' has a same-company key');
  }
  assert.match(getModel('User'), /sessionVersion Int @default\(0\)/);
  assert.match(schema, /property Property @relation\(fields:\[companyId,propertyId\], references:\[companyId,id\]/);
  assert.match(schema, /tenant Tenant @relation\(fields:\[companyId,tenantId\], references:\[companyId,id\]/);
  assert.match(schema, /user User\? @relation\(fields:\[companyId,userId\], references:\[companyId,id\]/);
});
