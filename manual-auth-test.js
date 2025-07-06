/**
 * Manual Crystallize Authentication Test
 * Let's test the exact auth format and API responses
 */

const https = require('https');

// Your Crystallize credentials
const config = {
  tenantIdentifier: 'norko',
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6'
};

console.log('🔍 Manual Crystallize Auth Test');
console.log('Tenant:', config.tenantIdentifier);
console.log('Token ID:', config.tokenId);
console.log('Token Secret:', config.tokenSecret.substring(0, 10) + '...');

// Test different auth methods and endpoints
async function testAuth() {
  
  // Test 1: Basic Auth with PIM API
  console.log('\n📋 Test 1: PIM API with Basic Auth');
  await testPIMAPI();
  
  // Test 2: Try the Core API
  console.log('\n📋 Test 2: Core API');
  await testCoreAPI();
  
  // Test 3: Try Catalogue API (read-only)
  console.log('\n📋 Test 3: Catalogue API (read-only)');
  await testCatalogueAPI();
}

async function testPIMAPI() {
  const authHeader = Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString('base64');
  
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
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
      'X-Crystallize-Tenant': config.tenantIdentifier
    }
  };
  
  console.log('URL:', `https://${options.hostname}${options.path}`);
  console.log('Headers:', options.headers);
  
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data.substring(0, 500));
        if (data.length > 500) console.log('... (truncated)');
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

async function testCoreAPI() {
  const authHeader = Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString('base64');
  
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
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json'
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

async function testCatalogueAPI() {
  // No auth needed for catalogue API - it's for reading public data
  const query = {
    query: `
      query {
        catalogue(path: "/") {
          name
          path
        }
      }
    `
  };
  
  const options = {
    hostname: 'api.crystallize.com',
    path: `/${config.tenantIdentifier}/catalogue`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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

testAuth();
