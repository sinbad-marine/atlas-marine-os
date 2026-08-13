'use strict';
const STORE_VERSION='sinbad-durable-idempotency-store/2Y-v1';
function validate(store={}){if(!store||store.version!==STORE_VERSION||store.durable!==true||!Number.isInteger(store.claimLeaseMs)||store.claimLeaseMs<1000||typeof store.claim!=='function'||typeof store.settle!=='function')throw new TypeError('A versioned durable idempotency store with claim lease and settle is required');return Object.freeze({version:STORE_VERSION,durable:true,claimLeaseMs:store.claimLeaseMs,claim:store.claim.bind(store),settle:store.settle.bind(store)});}
module.exports=Object.freeze({STORE_VERSION,validate});
