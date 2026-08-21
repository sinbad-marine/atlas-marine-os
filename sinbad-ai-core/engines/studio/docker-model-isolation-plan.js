'use strict';
const path=require('node:path');

const VERSION='0.1.0';
const MODE='DOCKER_MODEL_ISOLATION_PLAN_ONLY';
const IMAGE='ollama/ollama@sha256:b88c73ace3e115f8ec53dc8761ae1c0aabfa675406e3681786b98757ce050f42';
const IMAGE_SIZE_BYTES=2520039143;
const MODEL='qwen3:14b';
const MODEL_DIGEST='sha256:bdbd181c33f2ed1b31c972991882db3cf4d192569092138a7d29e973cd9debe8';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(input={}){
  if(String(input.model||'')!==MODEL)throw new TypeError('PINNED_LOCAL_MODEL_REQUIRED');
  const modelRoot=String(input.modelRoot||'');
  if(!path.isAbsolute(modelRoot)||path.basename(path.normalize(modelRoot)).toLowerCase()!=='models')throw new TypeError('ABSOLUTE_OLLAMA_MODELS_ROOT_REQUIRED');
  return freeze({
    version:VERSION,mode:MODE,status:'DOCKER_MODEL_ISOLATION_PLAN_READY',
    image:IMAGE,imageSizeBytes:IMAGE_SIZE_BYTES,platform:'linux/amd64',model:MODEL,modelDigest:MODEL_DIGEST,
    policy:{network:'NONE',publishedPorts:[],rootFilesystem:'READ_ONLY',modelMount:'READ_ONLY',coreMount:'NONE',workspaceMount:'NONE',capabilities:'DROP_ALL',privilegeEscalation:'DENY',user:'65532:65532',pids:128,memory:'14g',cpus:4,tmpfs:'/tmp:rw,noexec,nosuid,size=1g'},
    mounts:[{source:path.resolve(modelRoot),target:'/models',readOnly:true}],
    environment:{HOME:'/tmp/home',OLLAMA_MODELS:'/models',OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_NO_CLOUD:'1'},
    authority:'PLAN_ONLY',containerStarted:false,modelCalled:false,filesystemRead:false,filesystemWrite:false,networkUsed:false,
    nextGate:'VERIFY_MODEL_ROOT_AND_APPROVE_ONE_CONTAINER_PROBE'
  });
}

module.exports=freeze({VERSION,MODE,IMAGE,IMAGE_SIZE_BYTES,MODEL,MODEL_DIGEST,create});
