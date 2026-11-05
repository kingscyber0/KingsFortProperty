import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../db';
import { requireAuth, requirePermission } from '../middleware/auth';
import { canInviteRole, SUPPORTED_ROLES } from '@kingsfort/shared';
export const workspaceRouter=Router();
workspaceRouter.use(requireAuth);
workspaceRouter.get('/users',requirePermission('users:read'),async(req,res,next)=>{try{const users=await prisma.user.findMany({where:{companyId:req.auth!.companyId},select:{id:true,name:true,email:true,phone:true,department:true,jobTitle:true,role:true,active:true,lastLoginAt:true,createdAt:true},orderBy:{createdAt:'asc'}});res.json({users});}catch(e){next(e);}});
workspaceRouter.get('/company',requirePermission('company:read'),async(req,res,next)=>{try{const company=await prisma.company.findUnique({where:{id:req.auth!.companyId},select:{id:true,name:true,email:true,phone:true,address:true,logoUrl:true,timezone:true,currency:true}});if(!company)return res.status(404).json({error:'Company workspace was not found.'});return res.json({company});}catch(e){next(e);}});
const companySettingsSchema=z.object({
 name:z.string().trim().min(2).max(120).optional(),
 email:z.email().optional(),
 phone:z.string().trim().min(7).max(30).nullable().optional(),
 address:z.string().trim().max(250).nullable().optional(),
 timezone:z.string().trim().min(1).max(64).refine(value=>{try{new Intl.DateTimeFormat('en-US',{timeZone:value});return true;}catch{return false;}},'Choose a valid time zone.').optional(),
 currency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
}).strict().refine(value=>Object.keys(value).length>0,'Provide at least one company setting to update.');
workspaceRouter.patch('/company',requirePermission('company:update'),async(req,res,next)=>{try{
 const input=companySettingsSchema.parse(req.body); const data={...input,email:input.email?.toLowerCase()};
 const company=await prisma.$transaction(async tx=>{
  const updated=await tx.company.update({where:{id:req.auth!.companyId},data,select:{id:true,name:true,email:true,phone:true,address:true,logoUrl:true,timezone:true,currency:true}});
  await tx.auditLog.create({data:{companyId:req.auth!.companyId,userId:req.auth!.userId,action:'COMPANY_SETTINGS_UPDATED',entityType:'Company',entityId:updated.id,metadata:{fields:Object.keys(input)}}});
  return updated;
 });
 return res.json({company});
}catch(e){next(e);}});
workspaceRouter.post('/invitations',requirePermission('users:invite'),async(req,res,next)=>{try{
 const input=z.object({email:z.email(),role:z.enum(SUPPORTED_ROLES),name:z.string().trim().min(2).max(100).optional()}).parse(req.body);
 if(!canInviteRole(req.auth!.role,input.role)) return res.status(403).json({error:'Only the company administrator can invite Manager, HR or Super Admin accounts.'});
 const email=input.email.toLowerCase(); const existing=await prisma.user.findUnique({where:{companyId_email:{companyId:req.auth!.companyId,email}}}); if(existing)return res.status(409).json({error:'This staff member already has an account in your company.'});
 const raw=crypto.randomBytes(32).toString('hex'); const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
 await prisma.invitation.create({data:{companyId:req.auth!.companyId,email,role:input.role,tokenHash,expiresAt:new Date(Date.now()+72*60*60*1000)}});
 await prisma.auditLog.create({data:{companyId:req.auth!.companyId,userId:req.auth!.userId,action:'STAFF_INVITED',entityType:'Invitation',metadata:{email,role:input.role}}});
 // Raw invite token is returned only to support the initial local/dev workflow. Production must email a one-time link and never expose it in API responses.
 if(process.env.NODE_ENV==='production') return res.status(201).json({invited:true,message:'Invitation created. The invitation email service must deliver the secure link.'});
 return res.status(201).json({invited:true,developmentInviteToken:raw,expiresInHours:72});
 }catch(e){next(e);}});
workspaceRouter.get('/onboarding',async(req,res,next)=>{try{const company=await prisma.company.findUnique({where:{id:req.auth!.companyId},select:{id:true,name:true,logoUrl:true,address:true,phone:true}});res.json({company,steps:[{id:'profile',title:'Complete your profile',done:true},{id:'company',title:'Set up company details',done:!!company?.phone},{id:'staff',title:'Invite your team',done:false},{id:'property',title:'Register your first property',done:false},{id:'guide',title:'Explore the workspace',done:false}]});}catch(e){next(e);}});

workspaceRouter.post('/onboarding/complete',async(req,res,next)=>{try{await prisma.user.updateMany({where:{id:req.auth!.userId,companyId:req.auth!.companyId},data:{onboardingCompletedAt:new Date()}});res.json({completed:true});}catch(e){next(e);}});
