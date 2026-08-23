'use strict';

function endpoint(baseUrl){
  const url=new URL(baseUrl);
  if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Kiwix provider must be loopback-only');
  if(url.protocol!=='http:')throw new Error('local Kiwix provider must use HTTP loopback');
  return url;
}

function searchUrl(baseUrl,query,{language='tur',pageLength=8}={}){
  const url=new URL('search',endpoint(baseUrl).href.endsWith('/')?endpoint(baseUrl):`${endpoint(baseUrl).href}/`);
  url.searchParams.set('books.filter.lang',language);
  url.searchParams.set('pattern',String(query||'').trim());
  url.searchParams.set('pageLength',String(Math.max(1,Math.min(20,pageLength))));
  url.searchParams.set('format','xml');
  return url.href;
}

async function search(baseUrl,query,{fetchImpl=globalThis.fetch,signal,language,pageLength}={}){
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation required');
  if(!String(query||'').trim())return Object.freeze({query:'',xml:'',source:'offline-kiwix'});
  const response=await fetchImpl(searchUrl(baseUrl,query,{language,pageLength}),{signal,headers:{accept:'application/xml'}});
  if(!response.ok)throw new Error(`Kiwix search failed: HTTP ${response.status}`);
  return Object.freeze({query:String(query).trim(),xml:await response.text(),source:'offline-kiwix'});
}

module.exports=Object.freeze({endpoint,searchUrl,search});
