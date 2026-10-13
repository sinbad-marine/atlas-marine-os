'use strict';
// Record timings and resource observations, never environment variables or credentials.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
class BrowserEvidenceReporter{
  constructor(){this.tests=[];this.samples=[];this.steps=new Map();}
  onBegin(config){
    this.file=path.join(config.projects[0].outputDir,'execution-evidence.json');
    this.runtime={node:process.version,os:os.platform(),release:os.release(),arch:os.arch(),workers:config.workers,cpus:os.cpus().length,playwright:require('@playwright/test/package.json').version};
    this.sample();this.timer=setInterval(()=>this.sample(),1000);this.timer.unref();
    process.stdout.write(`BROWSER_RUNTIME ${JSON.stringify(this.runtime)}\n`);
  }
  sample(){
    const times=os.cpus().reduce((a,c)=>{for(const [k,v] of Object.entries(c.times))a[k]=(a[k]||0)+v;return a;},{});
    this.samples.push({at:Date.now(),load:os.loadavg(),freeMemory:os.freemem(),cpuTimes:times});
  }
  onTestBegin(test){this.steps.set(test.id,[]);process.stdout.write(`BROWSER_BEGIN ${test.titlePath().join(' > ')}\n`);}
  onStepEnd(test,result,step){
    const list=this.steps.get(test.id)||[];
    list.push({title:step.title,category:step.category,duration:step.duration,error:step.error?.message});
    if(list.length>30)list.shift();
  }
  onTestEnd(test,result){
    this.tests.push({title:test.titlePath(),status:result.status,retry:result.retry,duration:result.duration,errors:result.errors.map(e=>e.message),lastSteps:this.steps.get(test.id)});
    process.stdout.write(`BROWSER_END ${JSON.stringify(this.tests.at(-1))}\n`);
    this.steps.delete(test.id);this.save();
  }
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({runtime:this.runtime,samples:this.samples,tests:this.tests},null,2));}
  onEnd(){clearInterval(this.timer);this.sample();this.save();}
}
module.exports=BrowserEvidenceReporter;
