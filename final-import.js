/**
 * Final Working Demo Import
 * Get the actual required values and create products
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const config = {
  tenantIdentifier: 'norko',
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6',
  language: 'en'
};

async function finalImport() {
  console.log('🚀 Final Working Import Attempt');
  
  // Step 1: Get available shapes
  console.log('📋 Step 1: Getting available shapes...');
  const shapes = await getShapes();
  
  // Step 2: Get tenant ID somehow
  console.log('📋 Step 2: Getting tenant info...');
  const tenantId = await getTenantId();
  
  // Step 3: Create one working product
  if (shapes.length > 0 && tenantId) {
    console.log('📋 Step 3: Creating demo product...');
    await createWorkingProduct(shapes[0], tenantId);
  }
}

async function getShapes() {
  // Try the corrected query
  const query = {
    query: `
      query {
        shape {
          getMany {
            identifier
            name
            type
          }
        }
      }
    `
  };
  
  try {
    const response = await makeGraphQLRequest(query);
    
    if (response.data && response.data.shape && response.data.shape.getMany) {
      console.log('✅ Available shapes:');
      response.data.shape.getMany.forEach(shape => {
        console.log(`  - ${shape.identifier} (${shape.name}) - ${shape.type}`);
      });
      return response.data.shape.getMany;
    } else {
      console.log('No shapes in response:', JSON.stringify(response, null, 2));
      // Return a default shape to try
      return [{ identifier: 'Product', name: 'Product', type: 'product' }];
    }
  } catch (error) {
    console.log('Error getting shapes:', error.message);
    return [{ identifier: 'Product', name: 'Product', type: 'product' }];
  }
}

async function getTenantId() {
  // Try several approaches to get tenant ID
  const queries = [
    `query { me { id tenantId } }`,
    `query { me { tenantId } }`,
    `query { tenant { id } }`,
  ];
  
  for (const queryStr of queries) {
    try {
      const response = await makeGraphQLRequest({ query: queryStr });
      console.log(`Query "${queryStr}" response:`, JSON.stringify(response, null, 2));
      
      if (response.data) {
        // Extract any ID-like field
        const data = response.data;
        if (data.me?.tenantId) return data.me.tenantId;
        if (data.me?.id) return data.me.id;
        if (data.tenant?.id) return data.tenant.id;
      }
    } catch (error) {
      console.log(`Query failed: ${error.message}`);
    }
  }
  
  // If all else fails, try using the identifier as ID
  console.log('💡 Using tenant identifier as fallback ID');
  return config.tenantIdentifier;
}

async function createWorkingProduct(shape, tenantId) {
  // Create the most minimal product possible
  const productInput = {
    tenantId: tenantId,
    name: "Demo Infrared Heater",
    shapeIdentifier: shape.identifier,
    variants: [
      {
        name: "Default Variant",
        sku: "demo-heater-001",
        isDefault: true,
        price: 299.99,
        stock: 5
      }
    ]
    // Deliberately omitting vatTypeId to see if we can get it to work
  };
  
  console.log('Attempting to create product with:', JSON.stringify(productInput, null, 2));
  
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
      input: productInput
    }
  };
  
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ Final attempt errors:', JSON.stringify(response.errors, null, 2));
    console.log('\n💡 For the demo, we might need to:');
    console.log('1. Use the Crystallize App to create the first product manually');
    console.log('2. Or set up proper VAT types in the tenant');
    console.log('3. Or use a simpler content type like Document/Folder');
  } else if (response.data && response.data.product && response.data.product.create) {
    const product = response.data.product.create;
    console.log(`🎉 SUCCESS! Created demo product: ${product.name} (ID: ${product.id})`);
    console.log('✅ We can now proceed with bulk import of all 36 products!');
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

finalImport();
