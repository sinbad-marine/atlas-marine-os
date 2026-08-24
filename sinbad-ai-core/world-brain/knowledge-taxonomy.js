'use strict';

const VERSION='sinbad-world-knowledge-taxonomy/1';

const DOMAINS=Object.freeze([
  {id:'maritime',label:'Maritime and navigation',freshness:'mixed'},
  {id:'history',label:'History and civilizations',freshness:'stable'},
  {id:'geography',label:'Geography and cultures',freshness:'mixed'},
  {id:'science',label:'Natural and applied sciences',freshness:'mixed'},
  {id:'mathematics',label:'Mathematics and logic',freshness:'stable'},
  {id:'technology',label:'Technology and computing',freshness:'fast'},
  {id:'medicine',label:'Health and medicine',freshness:'fast',highStakes:true},
  {id:'art',label:'Visual arts, architecture and design',freshness:'stable'},
  {id:'literature',label:'Literature, language and mythology',freshness:'stable'},
  {id:'music',label:'Music, theatre and cinema',freshness:'mixed'},
  {id:'philosophy',label:'Philosophy, ethics and religions',freshness:'stable'},
  {id:'politics',label:'Politics, government and international relations',freshness:'live'},
  {id:'law',label:'Law, regulation and public administration',freshness:'live',highStakes:true},
  {id:'economics',label:'Economics, business and finance',freshness:'live',highStakes:true},
  {id:'society',label:'Society, education and daily life',freshness:'mixed'},
  {id:'environment',label:'Environment, climate and sustainability',freshness:'fast'},
  {id:'sports',label:'Sports and recreation',freshness:'live'},
  {id:'food',label:'Food, agriculture and culinary culture',freshness:'mixed'},
  {id:'travel',label:'Travel, places and practical culture',freshness:'fast'},
  {id:'media',label:'News, media, entertainment and popular culture',freshness:'live'},
  {id:'practical',label:'Practical skills, crafts and home life',freshness:'mixed'},
  {id:'reference',label:'Dictionaries, encyclopedias, units and reference tables',freshness:'mixed'}
].map(Object.freeze));

const BY_ID=new Map(DOMAINS.map(domain=>[domain.id,domain]));

function getDomain(id){return BY_ID.get(String(id||''))||null;}
function listDomains(){return DOMAINS.slice();}

module.exports=Object.freeze({VERSION,DOMAINS,getDomain,listDomains});
