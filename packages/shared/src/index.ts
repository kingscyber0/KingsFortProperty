export const APP_NAME = 'KingsFortProperty';
export const SUPPORTED_ROLES = ['SUPER_ADMIN','MANAGER','HR','ACCOUNTANT','PROPERTY_AGENT','VIEWER'] as const;
export type StaffRole = typeof SUPPORTED_ROLES[number];
const ELEVATED_INVITATION_ROLES: ReadonlySet<StaffRole> = new Set(['SUPER_ADMIN','MANAGER','HR']);
/** Prevent invitation rights from becoming a path to grant elevated workspace access. */
export function canInviteRole(inviterRole: StaffRole, invitedRole: StaffRole): boolean {
  if (ELEVATED_INVITATION_ROLES.has(invitedRole)) return inviterRole === 'SUPER_ADMIN';
  return inviterRole === 'SUPER_ADMIN' || inviterRole === 'MANAGER' || inviterRole === 'HR';
}
export const ROLE_LABELS: Record<StaffRole,string> = {
  SUPER_ADMIN: 'Company Administrator', MANAGER: 'Manager', HR: 'HR',
  ACCOUNTANT: 'Accountant', PROPERTY_AGENT: 'Property Agent', VIEWER: 'Viewer'
};
export const PERMISSIONS = {
  company: ['company:read','company:update','users:read','users:invite','users:manage','roles:assign'],
  properties: ['properties:read','properties:create','properties:update','properties:approve','properties:suspend'],
  leads: ['leads:read','leads:create','leads:update'],
  inspections: ['inspections:read','inspections:create','inspections:update'],
  tenants: ['tenants:read','tenants:create','tenants:update'],
  rent: ['rent:read','rent:update','payments:record'],
  sales: ['sales:read','sales:update'],
  reports: ['reports:read','reports:export'],
  audit: ['audit:read'],
} as const;
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][number];
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS).flat() as Permission[],
  MANAGER: ['company:read','users:read','users:invite','properties:read','properties:create','properties:update','properties:approve','properties:suspend','leads:read','leads:create','leads:update','inspections:read','inspections:create','inspections:update','tenants:read','tenants:create','tenants:update','rent:read','rent:update','payments:record','sales:read','sales:update','reports:read','reports:export','audit:read'],
  HR: ['company:read','users:read','users:invite','reports:read'],
  ACCOUNTANT: ['company:read','properties:read','tenants:read','rent:read','rent:update','payments:record','sales:read','reports:read','reports:export'],
  PROPERTY_AGENT: ['company:read','properties:read','properties:create','properties:update','leads:read','leads:create','leads:update','inspections:read','inspections:create','inspections:update','tenants:read'],
  VIEWER: ['company:read','properties:read','leads:read','inspections:read','tenants:read','rent:read','sales:read','reports:read']
};
