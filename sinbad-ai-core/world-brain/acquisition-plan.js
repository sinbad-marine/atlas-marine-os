'use strict';

const sources=require('./source-catalog.js');

const VERSION='sinbad-knowledge-acquisition-plan/1';
const STATES=Object.freeze({PLANNED:'PLANNED',AWAITING_APPROVAL:'AWAITING_APPROVAL',APPROVED:'APPROVED'});

function build({sourceId='kiwix-wikipedia-tr-top-mini',targetDirectory='knowledge-packs',approved=false}={}){
  const source=sources.getSource(sourceId);
  if(!source)throw new Error('unknown source');
  if(!source.artifact)throw new Error('source has no pinned artifact');
  const artifact=source.artifact;
  if(!/^https:\/\/download\.kiwix\.org\//.test(artifact.url))throw new Error('artifact URL is not an approved official host');
  return Object.freeze({
    schemaVersion:VERSION,state:approved?STATES.APPROVED:STATES.AWAITING_APPROVAL,
    sourceId:source.id,title:source.title,targetDirectory,
    artifact:Object.freeze({...artifact}),license:source.license,
    safety:Object.freeze({downloadStarted:false,installStarted:false,hashVerificationRequired:true,retainAttribution:true,allowNetworkOnlyAfterApproval:true})
  });
}

function approve(plan,confirmation){
  if(!plan||plan.schemaVersion!==VERSION)throw new Error('invalid acquisition plan');
  if(confirmation!==`DOWNLOAD:${plan.artifact.fileName}`)throw new Error('exact artifact confirmation required');
  return build({sourceId:plan.sourceId,targetDirectory:plan.targetDirectory,approved:true});
}

module.exports=Object.freeze({VERSION,STATES,build,approve});
