'use strict';

const {visualEvidence}=require('./contracts');

const VISUALS=Object.freeze([
  visualEvidence({
    schemaVersion:'sinbad-visual-evidence/1',
    visualId:'vis:0be3f56381149978efb5adfb50e6593d2609a5ed04d4a1cc546687c257c54b28',
    topics:['research buoy','observational buoy','undersea habitat support'],
    aliases:['araştırma şamandırası','gözlem şamandırası','aquarius yaşam destek şamandırası'],
    caption:'AQUARIUS sualtı habitatına yaşam desteği sağlayan NOAA/NURP araştırma şamandırası. Bu, seyir yardımcısı şamandıra örneği değildir.',
    altText:'Açık denizde, üzerinde NOAA ve NURP işaretleri bulunan büyük sarı araştırma ve yaşam destek şamandırası.',
    mediaType:'image/jpeg',
    sourcePageUrl:'https://www.noaa.gov/noaa-collections/photo-library/nur08063jpg',
    assetUrl:'https://www.noaa.gov/media/ngdl/download-photo/afa3a165-4011-4e24-866b-353a9f070cac',
    authority:'National Oceanic and Atmospheric Administration (NOAA)',
    creator:null,
    creditLine:'OAR/National Undersea Research Program (NURP)',
    licenceName:'NOAA Digital Photo Collection public domain terms',
    licenceUrl:'https://www.noaa.gov/noaa-collections/photo-library',
    licenceStatus:'APPROVED',
    retrievedAt:'2026-08-22',
    sha256:'0be3f56381149978efb5adfb50e6593d2609a5ed04d4a1cc546687c257c54b28',
    linkedSourceIds:['noaa-currents-tutorial','noaa-nav-cast']
  })
]);

module.exports=Object.freeze({VISUALS});
