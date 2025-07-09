/**
 * Create a simple product shape for Crystallize import
 */

const https = require('https');

const config = {
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6'
};

async function createProductShape() {
  console.log('🔧 Creating product shape for infrared heaters...');
  
  const createShapeMutation = {
    query: `
      mutation CreateProductShape($input: CreateShapeInput!) {
        shape {
          create(input: $input) {
            identifier
            name
          }
        }
      }
    `,
    variables: {
      input: {
        identifier: "infrared-heater-product",
        name: "Infrared Heater Product",
        type: "product",
        components: [
          {
            id: "name",
            name: "Product Name",
            type: "singleLine"
          },
          {
            id: "description",
            name: "Description", 
            type: "richText"
          },
          {
            id: "price",
            name: "Price",
            type: "numeric"
          },
          {
            id: "images",
            name: "Product Images",
            type: "images"
          },
          {
            id: "specifications",
            name: "Technical Specifications",
            type: "componentChoice",
            config: {
              choices: [
                {
                  id: "wattage",
                  name: "Wattage",
                  type: "numeric"
                },
                {
                  id: "dimensions", 
                  name: "Dimensions",
                  type: "singleLine"
                },
                {
                  id: "coverage",
                  name: "Coverage Area",
                  type: "singleLine"
                }
              ]
            }
          }
        ]
      }
    }
  };

  const result = await makeGraphQLRequest(createShapeMutation);
  
  if (result.errors) {
    console.log('❌ Shape creation errors:', JSON.stringify(result.errors, null, 2));
    return null;
  }
  
  if (result.data?.shape?.create) {
    console.log('✅ Shape created successfully:', result.data.shape.create);
    return result.data.shape.create.identifier;
  }
  
  return null;
}

async function makeGraphQLRequest(payload) {
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

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Run shape creation
createProductShape().then(shapeId => {
  if (shapeId) {
    console.log(`🎉 Ready to import products with shape: ${shapeId}`);
    console.log('Now run: node final-working-import.js');
  } else {
    console.log('❌ Shape creation failed - check Crystallize admin panel for existing shapes');
  }
}).catch(console.error);
