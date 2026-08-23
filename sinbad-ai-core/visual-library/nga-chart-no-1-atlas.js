'use strict';

const SOURCE=Object.freeze({
  sourceId:'nga-chart-no-1',
  title:'NGA Chart No. 1 - Nautical Chart Symbols, Abbreviations and Terms',
  authority:'National Geospatial-Intelligence Agency (NGA)',
  documentUrl:'https://msi.nga.mil/api/publications/download?key=16694005/SFH00000/ChartNo1.pdf&type=view',
  documentSha256:'247f548eaa45db815e1c49fea9785e966a6e8dd9e4771abc26d4dad473488a1e',
  documentBytes:3844589,
  pageCount:131,
  licenceName:'United States federal government work',
  licenceStatus:'APPROVED'
});

const PLATES=Object.freeze([
  Object.freeze({page:126,printedPage:128,file:'assets/nga-chart-no-1/page-126.png',sha256:'b4610f16cbef5eed39f77d930724e05d37308076428dc473ac0b17fda1ffb762',topics:Object.freeze(['iala region a','lateral marks','port hand buoy','starboard hand buoy','preferred channel mark'])}),
  Object.freeze({page:127,printedPage:129,file:'assets/nga-chart-no-1/page-127.png',sha256:'c3648c4f19cf81aacc3d3b6a13a5599f4b59de4937dd56e565ec9054491273dc',topics:Object.freeze(['iala region b','lateral marks','port hand buoy','starboard hand buoy','preferred channel mark'])}),
  Object.freeze({page:128,printedPage:130,file:'assets/nga-chart-no-1/page-128.png',sha256:'4b291f343c6fefc2951af9e9ed28e792ec820ebe489ee23ba6e9c5735d8faa14',topics:Object.freeze(['cardinal marks','north cardinal','east cardinal','south cardinal','west cardinal','light rhythms'])}),
  Object.freeze({page:129,printedPage:131,file:'assets/nga-chart-no-1/page-129.png',sha256:'1b309f2bea9073d118b31b22ca5107294a0bd2dbd251daa6c9226bb11d138cc6',topics:Object.freeze(['isolated danger mark','safe water mark','special mark','new danger mark','light rhythms'])})
]);

module.exports=Object.freeze({SOURCE,PLATES});
