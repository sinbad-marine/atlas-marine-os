'use strict';
module.exports=async()=>{
  const port=Number(process.env.SINBAD_PREVIEW_PORT||4173);
  try{await fetch(`http://127.0.0.1:${port}/__shutdown`,{method:'POST',headers:{'x-sinbad-preview-token':'sinbad-playwright-preview-v1'},signal:AbortSignal.timeout(2000)});}catch{}
};
