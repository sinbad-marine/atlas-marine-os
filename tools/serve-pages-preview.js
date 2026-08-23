'use strict';
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {ROOT,buildPagesArtifact}=require('./build-pages-artifact.js');

const HOST='127.0.0.1';
const PORT=4173;
const target=path.join(ROOT,'.release',`playwright-pages-${process.pid}`);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

async function start(){
  await buildPagesArtifact(target);
  const server=http.createServer(async(request,response)=>{
    try{
      if(request.method==='POST'&&request.url==='/__shutdown'&&request.headers['x-sinbad-preview-token']==='sinbad-playwright-preview-v1'){
        response.writeHead(204);response.end();return setImmediate(cleanup);
      }
      if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}
      const url=new URL(request.url,`http://${HOST}:${PORT}`);
      const requested=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file=path.resolve(target,...requested.split('/'));
      if(!file.startsWith(target+path.sep)){response.writeHead(403);return response.end();}
      const stat=await fsp.lstat(file);
      if(!stat.isFile()||stat.isSymbolicLink()){response.writeHead(404);return response.end();}
      response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      if(request.method==='HEAD')return response.end();
      fs.createReadStream(file).pipe(response);
    }catch{response.writeHead(404);response.end();}
  });
  let closing=false;
  const cleanup=()=>{if(closing)return;closing=true;server.close(()=>fsp.rm(target,{recursive:true,force:true}).finally(()=>process.exit(0)));};
  process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
  server.listen(PORT,HOST,()=>process.stdout.write(`SINBAD_RELEASE_PREVIEW_READY http://${HOST}:${PORT}\n`));
}
start().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
