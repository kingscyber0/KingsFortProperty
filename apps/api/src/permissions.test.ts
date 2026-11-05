import test from 'node:test';
import assert from 'node:assert/strict';
import { canInviteRole, ROLE_PERMISSIONS } from '@kingsfort/shared';

test('company administrator has full operational permissions',()=>{
 assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN.includes('users:manage'));
 assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN.includes('properties:approve'));
 assert.ok(ROLE_PERMISSIONS.SUPER_ADMIN.includes('audit:read'));
});
test('accountant cannot approve property listings or manage staff',()=>{
 assert.ok(!ROLE_PERMISSIONS.ACCOUNTANT.includes('properties:approve'));
 assert.ok(!ROLE_PERMISSIONS.ACCOUNTANT.includes('users:manage'));
 assert.ok(ROLE_PERMISSIONS.ACCOUNTANT.includes('payments:record'));
});
test('viewer is read-only',()=>{
 const writePermissions=ROLE_PERMISSIONS.VIEWER.filter(p=>/:(create|update|approve|suspend|manage|assign|invite|record)$/.test(p));
 assert.deepEqual(writePermissions,[]);
});
test('property agent can register property and inspections but cannot approve listings',()=>{
 assert.ok(ROLE_PERMISSIONS.PROPERTY_AGENT.includes('properties:create'));
 assert.ok(ROLE_PERMISSIONS.PROPERTY_AGENT.includes('inspections:create'));
 assert.ok(!ROLE_PERMISSIONS.PROPERTY_AGENT.includes('properties:approve'));
});
test('only a company administrator can invite elevated roles',()=>{
 for(const invitedRole of ['SUPER_ADMIN','MANAGER','HR'] as const){
  assert.ok(canInviteRole('SUPER_ADMIN',invitedRole));
  assert.ok(!canInviteRole('MANAGER',invitedRole));
  assert.ok(!canInviteRole('HR',invitedRole));
 }
});
test('staff inviters can invite only non-elevated roles',()=>{
 for(const inviterRole of ['MANAGER','HR'] as const){
  for(const invitedRole of ['ACCOUNTANT','PROPERTY_AGENT','VIEWER'] as const){
   assert.ok(canInviteRole(inviterRole,invitedRole));
  }
 }
});
test('roles without invitation permission cannot invite any role',()=>{
 for(const inviterRole of ['ACCOUNTANT','PROPERTY_AGENT','VIEWER'] as const){
  for(const invitedRole of ['SUPER_ADMIN','MANAGER','HR','ACCOUNTANT','PROPERTY_AGENT','VIEWER'] as const){
   assert.equal(canInviteRole(inviterRole,invitedRole),false);
  }
 }
});
