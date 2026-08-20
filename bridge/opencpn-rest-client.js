'use strict';
const https=require('https');
let input='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>3*1024*1024)process.exit(2)});
process.stdin.on('end',()=>{
  try{
    const request=JSON.parse(input);
    if(request.action!=='upload'||typeof request.key!=='string'||typeof request.gpx!=='string')throw new Error('INVALID_REQUEST');
    const query=new URLSearchParams({apikey:request.key,source:'SINBAD-BRIDGE',force:'1',activate:'1'}).toString();
    const body=Buffer.from(request.gpx,'utf8');
    const req=https.request({hostname:'127.0.0.1',port:8443,path:`/api/rx_object?${query}`,method:'POST',rejectUnauthorized:false,headers:{'Content-Type':'application/gpx+xml','Content-Length':body.length}},res=>{
      let output='';
      res.setEncoding('utf8');
      res.on('data',chunk=>{output+=chunk;if(output.length>65536)req.destroy(new Error('RESPONSE_TOO_LARGE'))});
      res.on('end',()=>process.stdout.write(JSON.stringify({statusCode:res.statusCode,body:output})));
    });
    req.setTimeout(10000,()=>req.destroy(new Error('OPENCPN_TIMEOUT')));
    req.on('error',error=>{process.stderr.write(error.message);process.exitCode=1});
    req.end(body);
  }catch(error){process.stderr.write(error.message);process.exitCode=1}
});
