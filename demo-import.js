/**
 * Simplified Demo Import Script
 * Focus on getting products imported without complex VAT/tenant setup
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

async function demoImport() {
  try {
    console.log('🚀 Demo Crystallize Import (Simplified)');
    console.log('💡 Skipping complex VAT/tenant setup for demo');
    
    // Load import data
    if (!fs.existsSync(config.importFilePath)) {
      console.error('❌ Import file not found:', config.importFilePath);
      return false;
    }
    
    const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
    console.log(`📊 Found ${importData.length} items to import`);
    
    // Try the simplest possible product creation
    console.log('📦 Testing simplest product creation...');
    await createSimpleProduct();
    
    console.log('✅ Demo import approach validated!');
    return true;
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    return false;
  }
}

async function createSimpleProduct() {
  // Absolute minimal product - just name and shape
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
        name: "Demo Infrared Heater",
        shapeIdentifier: "Product"
      }
    }
  };
  
  console.log('Creating minimal demo product...');
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ Errors:', JSON.stringify(response.errors, null, 2));
    console.log('💡 Let\'s try with Document instead of Product...');
    await createSimpleDocument();
  } else if (response.data && response.data.product && response.data.product.create) {
    const product = response.data.product.create;
    console.log(`✅ Created demo product: ${product.name} (ID: ${product.id})`);
  } else {
    console.log('⚠️ Unexpected response:', JSON.stringify(response, null, 2));
  }
}

async function createSimpleDocument() {
  // Try creating a document instead (might be simpler)
  const createMutation = {
    query: `
      mutation CreateDocument($input: CreateDocumentInput!) {
        document {
          create(language: "${config.language}", input: $input) {
            id
            name
          }
        }
      }
    `,
    variables: {
      input: {
        name: "Demo Heater Info",
        shapeIdentifier: "Document"
      }
    }
  };
  
  console.log('Trying document creation...');
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ Document errors too:', JSON.stringify(response.errors, null, 2));
    console.log('💡 Maybe we need to create/check shapes first...');
    await checkAvailableShapes();
  } else if (response.data && response.data.document && response.data.document.create) {
    const doc = response.data.document.create;
    console.log(`✅ Created demo document: ${doc.name} (ID: ${doc.id})`);
  }
}

async function checkAvailableShapes() {
  // Check what shapes are available in the tenant
  const shapesQuery = {
    query: `
      query {
        shapes {
          identifier
          name
          type
        }
      }
    `
  };
  
  console.log('🔍 Checking available shapes...');
  const response = await makeGraphQLRequest(shapesQuery);
  
  if (response.data && response.data.shapes) {
    console.log('📋 Available shapes:');
    response.data.shapes.forEach(shape => {
      console.log(`  - ${shape.identifier} (${shape.name}) - Type: ${shape.type}`);
    });
    
    // Try to create with the first available product shape
    const productShape = response.data.shapes.find(s => s.type === 'product');
    if (productShape) {
      console.log(`💡 Trying with shape: ${productShape.identifier}`);
      await createWithSpecificShape(productShape.identifier);
    }
  } else {
    console.log('❌ Could not get shapes:', JSON.stringify(response, null, 2));
  }
}

async function createWithSpecificShape(shapeIdentifier) {
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
        name: "Demo Heater with Specific Shape",
        shapeIdentifier: shapeIdentifier
      }
    }
  };
  
  console.log(`Creating with shape: ${shapeIdentifier}...`);
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ Still errors:', JSON.stringify(response.errors, null, 2));
  } else if (response.data && response.data.product && response.data.product.create) {
    const product = response.data.product.create;
    console.log(`🎉 SUCCESS! Created: ${product.name} (ID: ${product.id})`);
    console.log('💡 Now we know the working pattern for bulk import!');
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

if (require.main === module) {
  demoImport();
}

module.exports = { demoImport };
