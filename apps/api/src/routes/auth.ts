import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { StaffRole } from '@kingsfort/shared';

export const authRouter = Router();
const registerSchema = z.object({companyName:z.string().trim().min(2).max(120),companyEmail:z.email(),companyPhone:z.string().trim().min(7).max(30).optional(),companyAddress:z.string().trim().max(250).optional(),adminName:z.string().trim().min(2).max(100),adminEmail:z.email(),password:z.string().min(12).max(128)});
const loginSchema = z.object({companySlug:z.string().trim().min(2).optional(),email:z.email(),password:z.string().min(1).max(128)});
function issueToken(user:{id:string;companyId:string;email:string;role:StaffRole;sessionVersion:number}) {
  const secret=process.env.JWT_ACCESS_SECRET;
  if(!secret || secret.length<32) throw new Error('Server authentication secret is not configured.');
  return jwt.sign({companyId:user.companyId,sessionVersion:user.sessionVersion},secret,{algorithm:'HS256',subject:user.id,expiresIn:'15m',issuer:'kingsfortproperty',audience:'kingsfortproperty-api'});
}
function makeSlug(name:string){return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)+'-'+Math.random().toString(36).slice(2,7);}
authRouter.post('/register-company', async(req,res,next)=>{
 try {
  const input=registerSchema.parse(req.body);
  const passwordHash=await bcrypt.hash(input.password,12);
  const result=await prisma.$transaction(async tx=>{
   const company=await tx.company.create({data:{name:input.companyName,email:input.companyEmail.toLowerCase(),phone:input.companyPhone,address:input.companyAddress,slug:makeSlug(input.companyName)}});
   const user=await tx.user.create({data:{companyId:company.id,name:input.adminName,email:input.adminEmail.toLowerCase(),passwordHash,role:'SUPER_ADMIN'}});
   await tx.subscription.create({data:{companyId:company.id,planCode:'STANDARD_MONTHLY',status:'TRIALING'}});
   await tx.auditLog.create({data:{companyId:company.id,userId:user.id,action:'COMPANY_REGISTERED',entityType:'Company',entityId:company.id}});
   return {company,user};
  });
  return res.status(201).json({token:issueToken(result.user),company:{id:result.company.id,name:result.company.name,slug:result.company.slug},user:{id:result.user.id,name:result.user.name,email:result.user.email,role:result.user.role},onboardingRequired:true});
 } catch(e){next(e);}
});
authRouter.post('/login',async(req,res,next)=>{
 try {
  const input=loginSchema.parse(req.body); const email=input.email.toLowerCase();
  const users=await prisma.user.findMany({where:{email,active:true},include:{company:true},take:10});
  const user=input.companySlug?users.find(u=>u.company.slug===input.companySlug):users[0];
  if(!user || (users.length>1 && !input.companySlug)) return res.status(401).json({error:users.length>1?'This email belongs to more than one workspace. Select your company workspace.':'Invalid email or password.'});
  if(!await bcrypt.compare(input.password,user.passwordHash)) return res.status(401).json({error:'Invalid email or password.'});
  await prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
  return res.json({token:issueToken(user),company:{id:user.company.id,name:user.company.name,slug:user.company.slug},user:{id:user.id,name:user.name,email:user.email,role:user.role},onboardingRequired:!user.onboardingCompletedAt});
 }catch(e){next(e);}
});
authRouter.post('/logout',requireAuth,async(req,res,next)=>{
 try {
  const revoked=await prisma.$transaction(async tx=>{
   const result=await tx.user.updateMany({where:{id:req.auth!.userId,companyId:req.auth!.companyId,active:true,sessionVersion:req.auth!.sessionVersion},data:{sessionVersion:{increment:1}}});
   if(result.count!==1)return false;
   await tx.auditLog.create({data:{companyId:req.auth!.companyId,userId:req.auth!.userId,action:'SESSION_REVOKED',entityType:'User',entityId:req.auth!.userId}});
   return true;
  });
  if(!revoked)return res.status(401).json({error:'Your session is invalid or has already been revoked.'});
  return res.status(204).end();
 }catch(e){next(e);}
});
authRouter.get('/me',requireAuth,async(req,res,next)=>{
 try { const user=await prisma.user.findFirst({where:{id:req.auth!.userId,companyId:req.auth!.companyId,active:true},include:{company:{select:{id:true,name:true,slug:true,logoUrl:true,currency:true,timezone:true}}}}); if(!user)return res.status(401).json({error:'Account is no longer active.'}); return res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone,department:user.department,jobTitle:user.jobTitle},company:user.company}); }catch(e){next(e);}
});
