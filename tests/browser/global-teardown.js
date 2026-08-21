'use strict';
module.exports=async()=>{
  try{await fetch('http://127.0.0.1:4173/__shutdown',{method:'POST',headers:{'x-sinbad-preview-token':'sinbad-playwright-preview-v1'},signal:AbortSignal.timeout(2000)});}catch{}
};
