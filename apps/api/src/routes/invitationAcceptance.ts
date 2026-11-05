import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';

export const invitationAcceptanceRouter = Router();

const acceptanceSchema = z.object({
  token: z.string().min(32).max(256),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
});

invitationAcceptanceRouter.post(
  '/invitations/accept',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  async (req, res, next) => {
    try {
      const input = acceptanceSchema.parse(req.body);
      const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
      const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
        include: { company: { select: { id: true, name: true, slug: true } } },
      });
      const now = new Date();
      if (!invite || invite.acceptedAt || invite.expiresAt <= now) {
        return res.status(400).json({ error: 'This invitation is invalid, expired or already used.' });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await prisma.$transaction(async tx => {
        // Claim conditionally inside the same transaction as account creation.
        // A replay or concurrent acceptance can claim this invitation only once.
        const claimed = await tx.invitation.updateMany({
          where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) return null;

        const created = await tx.user.create({
          data: {
            companyId: invite.companyId,
            name: input.name,
            email: invite.email,
            passwordHash,
            phone: input.phone,
            department: input.department,
            jobTitle: input.jobTitle,
            role: invite.role,
          },
          select: { id: true, name: true, email: true, role: true },
        });
        await tx.auditLog.create({
          data: {
            companyId: invite.companyId,
            userId: created.id,
            action: 'STAFF_ACCOUNT_ACTIVATED',
            entityType: 'User',
            entityId: created.id,
          },
        });
        return created;
      });

      if (!user) return res.status(400).json({ error: 'This invitation is invalid, expired or already used.' });
      return res.status(201).json({ created: true, company: invite.company, user });
    } catch (error) {
      next(error);
    }
  },
);
