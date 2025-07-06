/**
 * Corrected Crystallize Authentication Test
 * Using proper headers based on 2025 documentation
 */

const https = require('https');

const config = {
  tenantIdentifier: 'norko',
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6'
};

console.log('🔍 Corrected Crystallize Auth Test (2025)');
console.log('Using proper X-Crystallize-Access-Token headers');

async function testCorrectedAuth() {
  
  // Test 1: PIM API with proper headers
  console.log('\n📋 Test 1: PIM API with X-Crystallize-Access-Token headers');
  await testPIMAPICorrect();
  
  // Test 2: Core API with proper headers
  console.log('\n📋 Test 2: Core API with proper headers');
  await testCoreAPICorrect();
}

async function testPIMAPICorrect() {
  const query = {
    query: `
      query {
        tenant {
          id
          identifier
          name
        }
      }
    `
  };
  
  const options = {
    hostname: 'pim.crystallize.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crystallize-Access-Token-Id': config.tokenId,
      'X-Crystallize-Access-Token-Secret': config.tokenSecret
    }
  };
  
  console.log('URL:', `https://${options.hostname}${options.path}`);
  console.log('Headers:', {
    'Content-Type': options.headers['Content-Type'],
    'X-Crystallize-Access-Token-Id': config.tokenId,
    'X-Crystallize-Access-Token-Secret': config.tokenSecret.substring(0, 10) + '...'
  });
  
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data.substring(0, 500));
        if (data.length > 500) console.log('... (truncated)');
        
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data && parsed.data.tenant) {
              console.log('✅ Authentication successful!');
              console.log('Tenant:', parsed.data.tenant);
            }
          } catch (e) {
            console.log('⚠️ Valid response but could not parse JSON');
          }
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log('Error:', error.message);
      resolve();
    });
    
    req.write(JSON.stringify(query));
    req.end();
  });
}

async function testCoreAPICorrect() {
  const query = {
    query: `
      query {
        tenant {
          id
          identifier
          name
        }
      }
    `
  };
  
  const options = {
    hostname: 'api.crystallize.com',
    path: `/@${config.tenantIdentifier}/`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crystallize-Access-Token-Id': config.tokenId,
      'X-Crystallize-Access-Token-Secret': config.tokenSecret
    }
  };
  
  console.log('URL:', `https://${options.hostname}${options.path}`);
  
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data.substring(0, 500));
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log('Error:', error.message);
      resolve();
    });
    
    req.write(JSON.stringify(query));
    req.end();
  });
}

testCorrectedAuth();
