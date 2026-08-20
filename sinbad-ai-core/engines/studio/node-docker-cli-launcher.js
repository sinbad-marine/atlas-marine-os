'use strict';
const path=require('node:path');
const childProcess=require('node:child_process');
const runner=require('./docker-sandbox-test-runner.js');
const VERSION='0.4.0',MODE='AUTHENTIC_DOCKER_CLI_LAUNCH_ONLY';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(options={}){
  const dockerPath=path.resolve(String(options.dockerPath||'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe'));
  const spawn=typeof options.spawn==='function'?options.spawn:childProcess.spawn;
  async function launch(request){
    if(!runner.isAuthenticLaunchRequest(request))throw new Error('AUTHENTIC_DOCKER_LAUNCH_REQUEST_REQUIRED');
    return new Promise((resolve,reject)=>{
      let output='',settled=false,timedOut=false;
      const child=spawn(dockerPath,[...request.args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const append=chunk=>{if(Buffer.byteLength(output,'utf8')<request.maxOutputBytes)output=(output+String(chunk)).slice(0,request.maxOutputBytes);};
      child.stdout?.on('data',append);child.stderr?.on('data',append);
      const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');const cleanup=spawn(dockerPath,['rm','-f',request.containerName],{shell:false,windowsHide:true,stdio:'ignore'});cleanup.once?.('error',()=>{});},request.timeoutMs);
      child.once('error',error=>{if(settled)return;settled=true;clearTimeout(timer);reject(Object.assign(new Error('DOCKER_LAUNCH_FAILED'),{cause:error}));});
      child.once('close',code=>{if(settled)return;settled=true;clearTimeout(timer);resolve(freeze({exitCode:Number.isInteger(code)?code:null,timedOut,output}));});
    });
  }
  return freeze({VERSION,MODE,dockerPath,launch});
}
module.exports=freeze({VERSION,MODE,create});
