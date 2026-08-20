'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('../sinbad-navigation.js');
const visualizer=require('../sinbad-route-visualizer.js');

test('recognizes a Turkish request to draw the calculation on a map',()=>{
  assert.equal(visualizer.isPlotRequest('Bunu harita üzerinde çizerek göster'),true);
  assert.equal(visualizer.isPlotRequest('Merhaba Sinbad'),false);
});

test('recognizes OpenCPN as the explicit first-choice chart target',()=>{
  assert.equal(visualizer.isOpenCpnRequest('Open CPN haritada göster'),true);
  assert.equal(visualizer.isOpenCpnRequest('Web haritasında göster'),false);
});

test('reconstructs a follow-up DR calculation and produces plot points',()=>{
  const route=visualizer.routeFromConversation([
    {role:'user',text:'26 derece 10 dakika kuzey 013 derece 15 dakika batı mevkiinden rota 294 derece, 5 saat sonraki pozisyon nedir?'},
    {role:'user',text:'13 knot hızla'},
    {role:'user',text:'Bunu harita üzerinde çizerek göster'}
  ],globalThis.SinbadNavigation);
  assert.equal(route.status,'READY');
  assert.equal(route.distanceNm,65);
  assert.ok(Math.abs(route.end.lat-26.6067)<0.002);
  assert.ok(Math.abs(route.end.lon+14.356)<0.01);
  assert.equal(route.points.length,33);
  assert.equal(Object.isFrozen(route),true);
});

test('reports missing inputs without inventing a route',()=>{
  const route=visualizer.routeFromConversation([{role:'user',text:'Rota 294 derece, haritada çiz'}],globalThis.SinbadNavigation);
  assert.equal(route.status,'NEEDS_INPUT');
  assert.ok(route.missing.includes('lat'));
  assert.ok(route.missing.includes('speed'));
});

test('plots a complete natural Turkish DR request in one message',()=>{
  const route=visualizer.routeFromConversation([{
    role:'user',
    text:'26 derece 10 dakika N- 13 derece 15 dakika W pozisyonundan 294 derece rotasıyla 22 knot hız ile seyir yapan bir geminin 5 saat sonundaki pozisyonu nedir. haritada göster'
  }],globalThis.SinbadNavigation);
  assert.equal(route.status,'READY');
  assert.equal(route.distanceNm,110);
  assert.equal(route.course,294);
  assert.equal(route.speedKnots,22);
  assert.equal(route.hours,5);
  assert.ok(Math.abs(route.end.lat-26.9124)<0.003);
  assert.ok(Math.abs(route.end.lon+15.128)<0.02);
});

test('exports the calculated route as bounded GPX for OpenCPN',()=>{
  const route=visualizer.routeFromConversation([{
    role:'user',text:'26 derece 10 dakika N- 13 derece 15 dakika W pozisyonundan 294 derece rotasıyla 22 knot hız ile 5 saat sonundaki pozisyonu OpenCPN haritada göster'
  }],globalThis.SinbadNavigation);
  const gpx=visualizer.toGpx(route,{name:'DR & Route',createdAt:'2026-08-20T20:00:00.000Z'});
  assert.match(gpx,/<gpx version="1\.1"/);
  assert.match(gpx,/<name>DR &amp; Route<\/name>/);
  assert.match(gpx,/lat="26\.166667" lon="-13\.250000"/);
  assert.match(gpx,/lat="26\.911848" lon="-15\.120858"/);
  assert.equal((gpx.match(/<rtept /g)||[]).length,2);
});
