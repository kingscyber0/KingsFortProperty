import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { StaffRole, ROLE_PERMISSIONS, Permission } from '@kingsfort/shared';
import { prisma } from '../db';

export interface AuthUser { userId: string; companyId: string; email: string; role: StaffRole; sessionVersion: number }
declare global { namespace Express { interface Request { auth?: AuthUser } } }
export async function requireAuth(req: Request,res: Response,next: NextFunction) {
  const header = req.header('authorization');
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return res.status(401).json({error:'Authentication required.'});
  let claims: jwt.JwtPayload;
  try {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT secret is not configured securely.');
    const verified = jwt.verify(match[1],secret,{algorithms:['HS256'],issuer:'kingsfortproperty',audience:'kingsfortproperty-api'});
    if (typeof verified === 'string' || typeof verified.sub !== 'string' || typeof verified.companyId !== 'string' || !Number.isInteger(verified.sessionVersion) || verified.sessionVersion < 0) {
      throw new Error('Access token claims are invalid.');
    }
    claims = verified;
  } catch { return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'}); }

  // Resolve the current membership on every request so disabled accounts and
  // role changes take effect immediately; role/email are never trusted from JWT claims.
  const user = await prisma.user.findFirst({
    where:{id:claims.sub,companyId:claims.companyId,active:true},
    select:{id:true,companyId:true,email:true,role:true,sessionVersion:true},
  });
  if (!user || user.sessionVersion !== claims.sessionVersion) return res.status(401).json({error:'Your session is invalid or has been revoked.'});
  req.auth = {userId:user.id,companyId:user.companyId,email:user.email,role:user.role as StaffRole,sessionVersion:user.sessionVersion};
  return next();
}
export function requirePermission(permission: Permission) {
  return (req: Request,res: Response,next: NextFunction) => {
    if (!req.auth) return res.status(401).json({error:'Authentication required.'});
    const allowed = ROLE_PERMISSIONS[req.auth.role] as Permission[];
    if (!allowed.includes(permission)) return res.status(403).json({error:'You do not have permission to perform this action.'});
    return next();
  };
}
