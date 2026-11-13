import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../db';
import { requireAuth, requirePermission } from '../middleware/auth';

export function createPropertiesRouter(db: typeof prisma = prisma, authenticate = requireAuth) {
const propertiesRouter = Router();
propertiesRouter.use(authenticate);

const ownerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.email().optional(),
  isPrimary: z.boolean().default(false),
}).strict();
const propertyFields = {
  name: z.string().trim().min(2).max(140),
  propertyType: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  fullAddress: z.string().trim().min(5).max(300),
  transactionType: z.enum(['RENT', 'SALE', 'BOTH']),
  price: z.coerce.number().positive().max(9999999999999999),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  bathrooms: z.number().int().min(0).max(100).nullable().optional(),
  furnishingStatus: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  owners: z.array(ownerSchema).max(20).optional(),
};
const createSchema = z.object(propertyFields).strict();
const updateSchema = createSchema.partial().strict().refine(value => Object.keys(value).length > 0, 'Provide at least one property field to update.');
const availabilitySchema = z.object({ availability: z.enum(['AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'UNAVAILABLE']), reason: z.string().trim().max(500).optional() }).strict();
const approvalSchema = z.object({ approval: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']), reason: z.string().trim().max(500).optional() }).strict();
const propertyInclude = { owners: { orderBy: { isPrimary: 'desc' as const } }, createdBy: { select: { id: true, name: true } } };

propertiesRouter.get('/properties', requirePermission('properties:read'), async (req, res, next) => {
  try {
    const query = z.object({ q: z.string().trim().max(120).optional(), propertyType: z.string().trim().max(80).optional(), transactionType: z.enum(['RENT', 'SALE', 'BOTH']).optional(), availability: z.enum(['AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'UNAVAILABLE']).optional(), approval: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']).optional() }).parse(req.query);
    const where: any = { companyId: req.auth!.companyId };
    if (query.q) where.OR = ['propertyCode', 'name', 'location', 'fullAddress'].map(field => ({ [field]: { contains: query.q, mode: 'insensitive' } }));
    if (query.propertyType) where.propertyType = { contains: query.propertyType, mode: 'insensitive' };
    if (query.transactionType) where.transactionType = query.transactionType;
    if (query.availability) where.availability = query.availability;
    if (query.approval) where.approval = query.approval;
    const [properties, total] = await db.$transaction([
      db.property.findMany({ where, include: propertyInclude, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.property.count({ where }),
    ]);
    return res.json({ properties, total });
  } catch (error) { next(error); }
});

propertiesRouter.post('/properties', requirePermission('properties:create'), async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const { owners = [], ...fields } = input;
    const propertyCode = 'KF-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const property = await db.$transaction(async tx => {
      const created = await tx.property.create({ data: { ...fields, price: fields.price.toFixed(2), companyId: req.auth!.companyId, createdById: req.auth!.userId, propertyCode, owners: { create: owners.map(owner => ({ ...owner, email: owner.email?.toLowerCase() ?? null })) } }, include: propertyInclude });
      await tx.auditLog.create({ data: { companyId: req.auth!.companyId, userId: req.auth!.userId, action: 'PROPERTY_CREATED', entityType: 'Property', entityId: created.id, metadata: { propertyCode: created.propertyCode } } });
      return created;
    });
    return res.status(201).json({ property });
  } catch (error) { next(error); }
});

propertiesRouter.get('/properties/:id', requirePermission('properties:read'), async (req, res, next) => {
  try {
    const property = await db.property.findFirst({ where: { id: req.params.id as string, companyId: req.auth!.companyId }, include: { ...propertyInclude, statusHistory: { orderBy: { changedAt: 'desc' }, take: 25 } } });
    if (!property) return res.status(404).json({ error: 'Property was not found in this workspace.' });
    return res.json({ property });
  } catch (error) { next(error); }
});

propertiesRouter.patch('/properties/:id', requirePermission('properties:update'), async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const { owners, ...fields } = input;
    const property = await db.$transaction(async tx => {
      const result = await tx.property.updateMany({ where: { id: req.params.id as string, companyId: req.auth!.companyId }, data: { ...fields, price: fields.price === undefined ? undefined : fields.price.toFixed(2) } });
      if (result.count !== 1) return null;
      if (owners) await tx.propertyOwner.deleteMany({ where: { propertyId: req.params.id as string, companyId: req.auth!.companyId } });
      if (owners?.length) await tx.propertyOwner.createMany({ data: owners.map(owner => ({ ...owner, email: owner.email?.toLowerCase() ?? null, propertyId: req.params.id as string, companyId: req.auth!.companyId })) });
      await tx.auditLog.create({ data: { companyId: req.auth!.companyId, userId: req.auth!.userId, action: 'PROPERTY_UPDATED', entityType: 'Property', entityId: req.params.id as string, metadata: { fields: Object.keys(input) } } });
      return tx.property.findFirst({ where: { id: req.params.id as string, companyId: req.auth!.companyId }, include: propertyInclude });
    });
    if (!property) return res.status(404).json({ error: 'Property was not found in this workspace.' });
    return res.json({ property });
  } catch (error) { next(error); }
});

propertiesRouter.patch('/properties/:id/availability', requirePermission('properties:update'), async (req, res, next) => {
  try {
    const input = availabilitySchema.parse(req.body);
    const property = await db.$transaction(async tx => {
      const current = await tx.property.findFirst({ where: { id: req.params.id as string, companyId: req.auth!.companyId }, select: { id: true, availability: true } });
      if (!current) return null;
      await tx.property.updateMany({ where: { id: current.id, companyId: req.auth!.companyId }, data: { availability: input.availability } });
      await tx.propertyStatusHistory.create({ data: { companyId: req.auth!.companyId, propertyId: current.id, oldStatus: current.availability, newStatus: input.availability, reason: input.reason, changedById: req.auth!.userId } });
      await tx.auditLog.create({ data: { companyId: req.auth!.companyId, userId: req.auth!.userId, action: 'PROPERTY_AVAILABILITY_CHANGED', entityType: 'Property', entityId: current.id, metadata: { from: current.availability, to: input.availability } } });
      return tx.property.findFirst({ where: { id: current.id, companyId: req.auth!.companyId }, include: propertyInclude });
    });
    if (!property) return res.status(404).json({ error: 'Property was not found in this workspace.' });
    return res.json({ property });
  } catch (error) { next(error); }
});

propertiesRouter.patch('/properties/:id/approval', requirePermission('properties:approve'), async (req, res, next) => {
  try {
    const input = approvalSchema.parse(req.body);
    const property = await db.$transaction(async tx => {
      const current = await tx.property.findFirst({ where: { id: req.params.id as string, companyId: req.auth!.companyId }, select: { id: true, approval: true } });
      if (!current) return null;
      await tx.property.updateMany({ where: { id: current.id, companyId: req.auth!.companyId }, data: { approval: input.approval } });
      await tx.propertyStatusHistory.create({ data: { companyId: req.auth!.companyId, propertyId: current.id, oldStatus: current.approval, newStatus: input.approval, reason: input.reason, changedById: req.auth!.userId } });
      await tx.auditLog.create({ data: { companyId: req.auth!.companyId, userId: req.auth!.userId, action: 'PROPERTY_APPROVAL_CHANGED', entityType: 'Property', entityId: current.id, metadata: { from: current.approval, to: input.approval } } });
      return tx.property.findFirst({ where: { id: current.id, companyId: req.auth!.companyId }, include: propertyInclude });
    });
    if (!property) return res.status(404).json({ error: 'Property was not found in this workspace.' });
    return res.json({ property });
  } catch (error) { next(error); }
});

  return propertiesRouter;
}

export const propertiesRouter = createPropertiesRouter();
