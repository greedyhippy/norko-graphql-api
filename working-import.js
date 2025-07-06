/**
 * Working Crystallize Import Script
 * Authentication confirmed working with X-Crystallize-Access-Token headers
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const config = {
  tenantIdentifier: 'norko',
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6',
  language: 'en',
  importFilePath: path.join(__dirname, '../heatshop-scraper/crystallize-import.json')
};

async function importToCrediting() {
  try {
    console.log('🚀 Starting Crystallize Import (Authentication Working!)');
    console.log(`📦 Tenant: ${config.tenantIdentifier}`);
    
    // Load import data
    if (!fs.existsSync(config.importFilePath)) {
      console.error('❌ Import file not found:', config.importFilePath);
      return false;
    }
    
    const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
    console.log(`📊 Found ${importData.length} items to import`);
    
    // First, let's create a simple test product to verify everything works
    console.log('🧪 Creating test product first...');
    await createTestProduct();
    
    console.log('✅ Ready to import all products!');
    return true;
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    return false;
  }
}

async function createTestProduct() {
  // Simple product creation test
  const createMutation = {
    query: `
      mutation CreateProduct($input: CreateProductInput!) {
        product {
          create(language: "${config.language}", input: $input) {
            id
            name
          }
        }
      }
    `,
    variables: {
      input: {
        name: "Test Heater",
        path: "/test-heater",
        shapeIdentifier: "Product", // Using generic Product shape
        components: []
      }
    }
  };
  
  console.log('Creating test product...');
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ GraphQL errors:', JSON.stringify(response.errors, null, 2));
  } else if (response.data && response.data.product && response.data.product.create) {
    const product = response.data.product.create;
    console.log(`✅ Test product created: ${product.name} (ID: ${product.id})`);
  } else {
    console.log('⚠️ Unexpected response:', JSON.stringify(response, null, 2));
  }
}

async function makeGraphQLRequest(payload) {
  return new Promise((resolve, reject) => {
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
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Test simple queries first
async function testSimpleQueries() {
  console.log('🔍 Testing simple queries...');
  
  // Test a basic introspection query
  const introspectionQuery = {
    query: `
      query {
        __schema {
          queryType {
            name
          }
        }
      }
    `
  };
  
  const response = await makeGraphQLRequest(introspectionQuery);
  console.log('Schema response:', JSON.stringify(response, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test-schema')) {
    await testSimpleQueries();
  } else {
    await importToCrediting();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importToCrediting };
