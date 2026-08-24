'use strict';
const PROFILES=Object.freeze({
  light:Object.freeze({id:'light',label:'Light',goal:'Broad offline orientation on limited storage',sourceKinds:Object.freeze(['mini-encyclopedia']),images:'none',currentAffairs:'dated-index-only'}),
  standard:Object.freeze({id:'standard',label:'Standard',goal:'Full-text general reference without bulk imagery',sourceKinds:Object.freeze(['full-text-encyclopedia','dictionaries']),images:'essential-only',currentAffairs:'dated-update-packs'}),
  learning:Object.freeze({id:'learning',label:'Learning',goal:'Curated teaching corpus with verified diagrams and textbooks',sourceKinds:Object.freeze(['textbooks','licensed-visuals','primary-sources']),images:'curated-and-attributed',currentAffairs:'dated-update-packs'}),
  archive:Object.freeze({id:'archive',label:'Archive',goal:'Optional large research collection for capable storage',sourceKinds:Object.freeze(['full-encyclopedia','large-media-collections']),images:'license-preserving',currentAffairs:'dated-snapshots-only'})
});
function getProfile(id){return PROFILES[String(id||'')]||null;}
function listProfiles(){return Object.values(PROFILES);}
module.exports=Object.freeze({PROFILES,getProfile,listProfiles});
