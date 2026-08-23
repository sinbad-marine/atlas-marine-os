'use strict';

const VERSION='sinbad-world-source-catalog/1';
const SOURCES=Object.freeze([
  {id:'kiwix-wikipedia-tr-top-mini',title:'Turkish Wikipedia — Kiwix top mini',provider:'Kiwix / Wikimedia',officialCatalog:'https://download.kiwix.org/zim/wikipedia/',languages:['tr'],domains:['reference','history','geography','science','art','literature','society'],format:'ZIM',license:'CC-BY-SA-4.0',freshness:'mixed',updateCadence:'periodic-upstream-snapshot',distributionAllowed:true,requiresPerItemLicense:false,containsImages:false,imageLicensePolicy:'NONE',recommendedProfile:'light',enabled:false,artifact:{fileName:'wikipedia_tr_top_mini_2026-04.zim',url:'https://download.kiwix.org/zim/wikipedia/wikipedia_tr_top_mini_2026-04.zim',snapshotDate:'2026-04-12',reportedSize:'124M'}},
  {id:'kiwix-wikipedia-tr-mini',title:'Turkish Wikipedia — Kiwix mini',provider:'Kiwix / Wikimedia',officialCatalog:'https://library.kiwix.org/',languages:['tr'],domains:['reference','history','geography','science','art','literature','society'],format:'ZIM',license:'CC-BY-SA-4.0',freshness:'mixed',updateCadence:'periodic-upstream-snapshot',distributionAllowed:true,requiresPerItemLicense:false,containsImages:false,imageLicensePolicy:'NONE',recommendedProfile:'light',enabled:false},
  {id:'kiwix-wikipedia-tr-nopic',title:'Turkish Wikipedia — Kiwix full text without images',provider:'Kiwix / Wikimedia',officialCatalog:'https://library.kiwix.org/',languages:['tr'],domains:['reference','history','geography','science','art','literature','society'],format:'ZIM',license:'CC-BY-SA-4.0',freshness:'mixed',updateCadence:'periodic-upstream-snapshot',distributionAllowed:true,requiresPerItemLicense:false,containsImages:false,imageLicensePolicy:'NONE',recommendedProfile:'standard',enabled:false},
  {id:'openstax-curated-textbooks',title:'Curated OpenStax textbooks',provider:'OpenStax',officialCatalog:'https://openstax.org/subjects',languages:['en'],domains:['science','mathematics','economics','society'],format:'PDF/EPUB',license:'CC-BY-4.0',freshness:'mixed',updateCadence:'edition-based',distributionAllowed:true,requiresPerItemLicense:true,containsImages:true,imageLicensePolicy:'PRESERVE_PER_BOOK_AND_FIGURE_ATTRIBUTION',recommendedProfile:'academy',enabled:false},
  {id:'project-gutenberg-curated',title:'Curated Project Gutenberg works',provider:'Project Gutenberg',officialCatalog:'https://www.gutenberg.org/',languages:['en','tr'],domains:['literature','history','philosophy'],format:'EPUB/TXT',license:'PDM-1.0',freshness:'stable',updateCadence:'curated-release',distributionAllowed:false,requiresPerItemLicense:true,containsImages:false,imageLicensePolicy:'EXCLUDE_UNLESS_SEPARATELY_VERIFIED',recommendedProfile:'academy',enabled:false,note:'United States public-domain status does not automatically establish Turkish distribution rights.'},
  {id:'wikimedia-curated-visuals',title:'Curated Wikimedia Commons teaching visuals',provider:'Wikimedia Commons',officialCatalog:'https://commons.wikimedia.org/',languages:['mul'],domains:['history','geography','science','art','maritime'],format:'IMAGE+METADATA',license:'MIXED-PER-FILE',freshness:'mixed',updateCadence:'curated-release',distributionAllowed:false,requiresPerItemLicense:true,containsImages:true,imageLicensePolicy:'REQUIRE_PER_FILE_LICENSE_AUTHOR_SOURCE_AND_ATTRIBUTION',recommendedProfile:'academy',enabled:false}
].map(source=>Object.freeze({...source,languages:Object.freeze(source.languages),domains:Object.freeze(source.domains)})));
const BY_ID=new Map(SOURCES.map(source=>[source.id,source]));

function validateSource(source){
  if(!source||typeof source!=='object')throw new TypeError('source object required');
  const required=['id','title','provider','officialCatalog','languages','domains','format','license','freshness','updateCadence','distributionAllowed','requiresPerItemLicense','containsImages','imageLicensePolicy','recommendedProfile','enabled'];
  for(const field of required)if(!(field in source))throw new Error(`source missing field: ${field}`);
  if(source.enabled&&(!source.license||!source.updateCadence))throw new Error('enabled source requires license and update cadence');
  if(source.enabled&&source.requiresPerItemLicense)throw new Error('per-item source cannot be globally enabled');
  if(source.enabled&&source.containsImages&&source.imageLicensePolicy==='NONE')throw new Error('image source requires an image license policy');
  return true;
}
function listSources(){return SOURCES.slice();}
function getSource(id){return BY_ID.get(String(id||''))||null;}
for(const source of SOURCES)validateSource(source);
module.exports=Object.freeze({VERSION,SOURCES,listSources,getSource,validateSource});
