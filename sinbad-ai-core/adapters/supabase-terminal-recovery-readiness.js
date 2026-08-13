'use strict';
const recoveryModule=require('./supabase-terminal-recovery.js');
const auditModule=require('./supabase-terminal-recovery-audit.js');
const READINESS_VERSION='sinbad-terminal-recovery-readiness/3F-v1';
const RECOVERY_REASONS=new Set(['EXPIRED_CLAIM_SLA_EXCEEDED','RECOVERY_INVALID_INSPECT_ARGS','RECOVERY_CAPABILITY_DENIED','RECOVERY_STORE_UNAVAILABLE','RECOVERY_DATA_INTEGRITY_FAILED','RECOVERY_CLOCK_SKEW']);
const AUDIT_REASONS=new Set(['AUDIT_INVALID_SCAN_ARGS','AUDIT_CAPABILITY_DENIED','AUDIT_STORE_UNAVAILABLE','AUDIT_EVENT_HASH_MISMATCH','AUDIT_ORDER_INVALID','AUDIT_SCAN_LIMIT_REACHED']);
function optionalInteger(value){return Number.isInteger(value)&&value>=0?value:null;}
function report(status,reasonCode,details={}){return Object.freeze({version:READINESS_VERSION,status,reasonCode,expiredCount:optionalInteger(details.expiredCount),oldestAgeMs:optionalInteger(details.oldestAgeMs),auditEventCount:optionalInteger(details.auditEventCount),auditPageCount:optionalInteger(details.auditPageCount),auditWatermarkId:Number.isSafeInteger(details.auditWatermarkId)&&details.auditWatermarkId>0?details.auditWatermarkId:null});}
function create(options={}){
  if(!options.client||typeof options.client.rpc!=='function'||options.serviceRole!==true)throw new TypeError('A trusted server-side Supabase service-role client is required');
  const client=Object.freeze({rpc:options.client.rpc.bind(options.client)});
  const recovery=recoveryModule.create({client,serviceRole:true,actorHash:options.actorHash});
  const audit=auditModule.create({client,serviceRole:true});
  const limit=Number(options.limit),slaMs=Number(options.slaMs),pageSize=Number(options.pageSize),maxEvents=Number(options.maxEvents),now=options.now;
  if(!Number.isInteger(limit)||limit<1||limit>500||!Number.isInteger(slaMs)||slaMs<1000||slaMs>604800000||!Number.isInteger(pageSize)||pageSize<1||pageSize>500||!Number.isInteger(maxEvents)||maxEvents<pageSize||maxEvents>100000||(now!==undefined&&typeof now!=='function'))throw new TypeError('Valid recovery readiness bounds are required');
  return Object.freeze({
    async check(){
      let health,recoveryDetails;
      try{
        health=await recovery.inspect({limit,slaMs,now});
        if(health?.version!==recoveryModule.RECOVERY_VERSION||!Number.isInteger(health.expiredCount)||health.expiredCount<0||!Array.isArray(health.claims)||health.claims.length!==health.expiredCount||((health.status==='RECOVERY_HEALTHY'||health.status==='RECOVERY_SLA_BREACHED')&&(!Number.isInteger(health.oldestAgeMs)||health.oldestAgeMs<0)))return report('RECOVERY_READINESS_BLOCKED','RECOVERY_CONTRACT_INVALID');
        recoveryDetails={expiredCount:health.expiredCount,oldestAgeMs:health.oldestAgeMs};
        if(health.status!=='RECOVERY_HEALTHY')return report('RECOVERY_READINESS_BLOCKED',RECOVERY_REASONS.has(health.reasonCode)?health.reasonCode:'RECOVERY_CONTRACT_INVALID',recoveryDetails);
        if(health.reasonCode!==null)return report('RECOVERY_READINESS_BLOCKED','RECOVERY_CONTRACT_INVALID',recoveryDetails);
      }catch{return report('RECOVERY_READINESS_BLOCKED','RECOVERY_CHECK_EXCEPTION');}
      try{
        const scan=await audit.scan({pageSize,maxEvents});
        if(scan?.version!==auditModule.SCAN_VERSION||!Number.isInteger(scan.eventCount)||scan.eventCount<0||!Number.isInteger(scan.pageCount)||scan.pageCount<0||(scan.watermarkId!==null&&(!Number.isSafeInteger(scan.watermarkId)||scan.watermarkId<1)))return report('RECOVERY_READINESS_BLOCKED','AUDIT_CONTRACT_INVALID',recoveryDetails);
        const details={...recoveryDetails,auditEventCount:scan.eventCount,auditPageCount:scan.pageCount,auditWatermarkId:scan.watermarkId};
        if(scan.status!=='AUDIT_SCAN_COMPLETE')return report('RECOVERY_READINESS_BLOCKED',AUDIT_REASONS.has(scan.reasonCode)?scan.reasonCode:'AUDIT_CONTRACT_INVALID',details);
        if(scan.reasonCode!==null||scan.pageCount<1||scan.eventCount>=maxEvents||((scan.eventCount===0)!==(scan.watermarkId===null)))return report('RECOVERY_READINESS_BLOCKED','AUDIT_CONTRACT_INVALID',details);
        return report('RECOVERY_READINESS_READY',null,details);
      }catch{return report('RECOVERY_READINESS_BLOCKED','AUDIT_SCAN_EXCEPTION',recoveryDetails);}
    }
  });
}
module.exports=Object.freeze({READINESS_VERSION,create});
