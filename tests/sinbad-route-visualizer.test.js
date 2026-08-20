'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('../sinbad-navigation.js');
const visualizer=require('../sinbad-route-visualizer.js');

test('recognizes a Turkish request to draw the calculation on a map',()=>{
  assert.equal(visualizer.isPlotRequest('Bunu harita üzerinde çizerek göster'),true);
  assert.equal(visualizer.isPlotRequest('Merhaba Sinbad'),false);
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
