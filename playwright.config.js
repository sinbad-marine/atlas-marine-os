'use strict';
const {defineConfig,devices}=require('@playwright/test');
const previewPort=Number(process.env.SINBAD_PREVIEW_PORT||4173);
const previewURL=`http://127.0.0.1:${previewPort}`;

module.exports=defineConfig({
  testDir:'./tests/browser',
  fullyParallel:false,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?'github':'list',
  snapshotPathTemplate:'{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  expect:{toHaveScreenshot:{animations:'disabled',caret:'hide',scale:'css',threshold:.2,maxDiffPixelRatio:.02}},
  globalTeardown:require.resolve('./tests/browser/global-teardown.js'),
  use:{baseURL:previewURL,trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node tools/serve-pages-preview.js',url:`${previewURL}/`,reuseExistingServer:!process.env.CI,timeout:30000,env:{...process.env,SINBAD_PREVIEW_PORT:String(previewPort)}},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ]
});
