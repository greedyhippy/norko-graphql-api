/**
 * Check Railway deployment status and find the correct URL
 */

const https = require('https');
const http = require('http');

// Common Railway URL patterns
const possibleUrls = [
  // Add your Railway URLs here
];

async function testUrl(url) {
  return new Promise((resolve) => {
    const request = https.get(`${url}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          data: data.slice(0, 200) // First 200 chars
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        status: 'ERROR',
        error: err.message
      });
    });
    
    request.setTimeout(5000, () => {
      request.destroy();
      resolve({
        url,
        status: 'TIMEOUT',
        error: 'Request timeout'
      });
    });
  });
}

async function findRailwayUrl() {
  console.log('🔍 Searching for Railway deployment URL...\n');
  
  for (const url of possibleUrls) {
    console.log(`Testing: ${url}`);
    const result = await testUrl(url);
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log(`✅ Found working deployment: ${url}`);
      console.log(`Response preview: ${result.data}\n`);
      return url;
    } else if (result.error) {
      console.log(`❌ Error: ${result.error}\n`);
    } else {
      console.log(`❌ HTTP ${result.status}\n`);
    }
  }
  
  console.log('❌ Could not find working Railway deployment');
  console.log('💡 Check your Railway dashboard for the correct URL');
  return null;
}

findRailwayUrl();
