'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadCatalog(){
  const source=fs.readFileSync(require.resolve('../store-data.js'),'utf8');
  const context={};
  vm.runInNewContext(`${source}\nthis.catalog=STORE_DATA;`,context,{filename:'store-data.js'});
  return context.catalog;
}

test('SDM authorized catalog contains the complete current sitemap inventory',()=>{
  const catalog=loadCatalog();
  assert.equal(catalog.length,147);
  assert.equal(new Set(catalog.map(product=>product.id)).size,catalog.length);
});

test('every catalog item has a safe product identity, category, image and supplier link',()=>{
  for(const product of loadCatalog()){
    assert.match(product.id,/^[^\s<>]+$/u);
    assert.ok(product.name.length>1);
    assert.ok(product.category.length>1);
    assert.match(product.image,/^https:\/\/static\.wixstatic\.com\//u);
    assert.match(product.supplierUrl,/^https:\/\/www\.denizmagaza\.com\/product-page\//u);
    assert.ok(product.price===null||(Number.isFinite(product.price)&&product.price>0));
  }
});
