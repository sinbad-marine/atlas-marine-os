'use strict';
const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/browser',
  fullyParallel:false,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?'github':'list',
  globalTeardown:require.resolve('./tests/browser/global-teardown.js'),
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node tools/serve-pages-preview.js',url:'http://127.0.0.1:4173/',reuseExistingServer:false,timeout:30000},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ]
});
