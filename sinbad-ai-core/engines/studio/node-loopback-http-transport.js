'use strict';
const http=require('node:http');
const protocol=require('./local-model-protocol.js');

const VERSION='0.2.0';
const MODE='NODE_LOOPBACK_HTTP_TRANSPORT';
const MAX_REQUEST_BYTES=73728;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(){
  async function transport(input={}){
    const endpoint=protocol.validateEndpoint(input.url);
    if(input.method!=='POST'||input.headers?.['content-type']!=='application/json'||typeof input.body!=='string')throw new TypeError('LOOPBACK_HTTP_REQUEST_INVALID');
    const requestBytes=Buffer.byteLength(input.body,'utf8'),maxResponseBytes=Number(input.maxResponseBytes);
    if(!requestBytes||requestBytes>MAX_REQUEST_BYTES)throw new RangeError('LOOPBACK_HTTP_REQUEST_TOO_LARGE');
    if(!Number.isInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>protocol.MAX_RESPONSE_BYTES+8192)throw new RangeError('LOOPBACK_HTTP_RESPONSE_LIMIT_INVALID');
    if(input.signal!==undefined&&!(input.signal instanceof AbortSignal))throw new TypeError('LOOPBACK_HTTP_SIGNAL_INVALID');
    const url=new URL(endpoint),hostname=url.hostname==='localhost'?'127.0.0.1':url.hostname==='[::1]'?'::1':url.hostname;
    return new Promise((resolve,reject)=>{
      const request=http.request({protocol:'http:',hostname,port:Number(url.port),path:url.pathname,method:'POST',headers:{'content-type':'application/json','content-length':requestBytes,accept:'application/json'},signal:input.signal},response=>{
        const contentType=String(response.headers['content-type']||'').toLowerCase();
        if(!/^application\/json(?:\s*;|$)/u.test(contentType)){response.resume();reject(new Error('LOOPBACK_HTTP_CONTENT_TYPE_INVALID'));return;}
        const chunks=[];let total=0,settled=false;
        response.on('data',chunk=>{if(settled)return;total+=chunk.length;if(total>maxResponseBytes){settled=true;response.destroy();reject(new Error('LOOPBACK_HTTP_RESPONSE_TOO_LARGE'));return;}chunks.push(chunk);});
        response.on('end',()=>{if(!settled)resolve(freeze({statusCode:Number(response.statusCode||0),body:Buffer.concat(chunks,total).toString('utf8')}));});
        response.on('error',error=>{if(!settled)reject(error);});
      });
      request.on('error',reject);request.end(input.body,'utf8');
    });
  }
  return freeze({VERSION,MODE,transport});
}

module.exports=freeze({VERSION,MODE,MAX_REQUEST_BYTES,create});
