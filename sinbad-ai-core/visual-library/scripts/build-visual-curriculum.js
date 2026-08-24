'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const MANIFESTS=[
  ['bowditch-volume-1','assets/bowditch/volume-1-manifest.json'],
  ['bowditch-volume-2','assets/bowditch/volume-2-manifest.json'],
  ['nga-chart-no-1','assets/nga-chart-no-1/manifest.json'],
  ['curated-safety','assets/curated-safety/manifest.json']
];
const RULES=[
  ['chart-or-symbol',/chart|harita|symbol|sembol|buoyage|şamandıra|light characteristic|day shape|signal flag/u],
  ['technical-diagram',/diagram|construction|calculation|geometry|vector|triangle|projection|curve|graph|plot|schematic/u],
  ['procedure-sequence',/procedure|operation|launch|deploy|recovery|rescue|survival|firefighting|man overboard|abandon/u],
  ['photograph',/lifebuoy|life buoy|liferaft|life raft|lifeboat|life jacket|epirb|sart|vessel|ship|anchor|radar|sextant|compass|equipment/u]
];
function normalize(value){return String(value||'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en-US');}
function visualNeed(topic){for(const [mode,pattern] of RULES)if(pattern.test(topic))return mode;return 'review-required';}
function idFor(topic){return `topic:${crypto.createHash('sha256').update(topic).digest('hex').slice(0,20)}`;}
function build(){
  const topics=new Map();
  for(const [sourceId,relative] of MANIFESTS){
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
    for(const visual of manifest.visuals||[])for(const occurrence of visual.occurrences||[]){
      for(const raw of occurrence.topics||[]){
        const topic=normalize(raw);if(topic.length<3)continue;
        const current=topics.get(topic)||{topicId:idFor(topic),topic,visualNeed:visualNeed(topic),sourceIds:new Set(),existingVisualCount:0,status:'candidate-discovery'};
        current.sourceIds.add(sourceId);current.existingVisualCount+=1;topics.set(topic,current);
      }
    }
  }
  const entries=[...topics.values()].map(item=>({...item,sourceIds:[...item.sourceIds].sort(),status:item.existingVisualCount?'existing-needs-quality-review':item.status})).sort((a,b)=>a.topic.localeCompare(b.topic));
  return {schemaVersion:'sinbad-visual-curriculum/1',generatedAt:'deterministic-from-versioned-manifests',qualityPolicy:{defaultMaximumImages:1,rejectTraits:['qr-code','logo-only','text-only','cover-page'],minimumWidth:800,minimumHeight:600,requiredProvenance:['sourcePageUrl','licenceName','licenceUrl','creator','sha256']},sourceManifests:MANIFESTS.map(([sourceId,file])=>({sourceId,file})),topicCount:entries.length,topics:entries};
}
if(require.main===module){const output=process.argv[2]||path.join(ROOT,'assets','visual-curriculum.json');fs.writeFileSync(output,`${JSON.stringify(build(),null,2)}\n`,'utf8');process.stdout.write(`${output}\n`);}
module.exports=Object.freeze({normalize,visualNeed,build});
