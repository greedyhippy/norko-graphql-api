/**
 * Working Crystallize Import with Actual Tenant ID
 * Tenant ID: 68683fb6c8233b2a3a4b38e3
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const config = {
  tenantId: '68683fb6c8233b2a3a4b38e3', // Actual tenant ID from user
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6',
  language: 'en',
  importFilePath: path.join(__dirname, '../heatshop-scraper/crystallize-import.json')
};

async function workingImport() {
  console.log('🚀 Working Crystallize Import');
  console.log(`📦 Tenant ID: ${config.tenantId}`);
  
  // Step 1: Create a test product to verify everything works
  console.log('🧪 Testing product creation...');
  const testSuccess = await createTestProduct();
  
  if (testSuccess) {
    console.log('✅ Test successful! Ready for bulk import.');
    
    // Step 2: Import a few real products
    console.log('\n📦 Importing real products...');
    await importRealProducts();
  } else {
    console.log('❌ Test failed. Need to resolve issues first.');
  }
}

async function createTestProduct() {
  // Create minimal product with tenant ID
  const productInput = {
    tenantId: config.tenantId,
    name: "Test Infrared Heater",
    shapeIdentifier: "Product", // Try with generic Product first
    variants: [
      {
        name: "Default",
        sku: "test-heater-001",
        isDefault: true,
        price: 199.99,
        stock: 1
      }
    ]
    // Still omitting vatTypeId - we'll add it if needed
  };
  
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
  
  console.log('Creating test product...');
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.errors) {
    console.log('❌ Test product errors:', JSON.stringify(response.errors, null, 2));
    
    // If VAT type is required, let's try to get it
    if (response.errors.some(e => e.message.includes('vatTypeId'))) {
      console.log('💡 VAT type required. Getting VAT types...');
      await getAndRetryWithVAT(productInput);
      return false; // We'll handle this in the retry
    }
    
    return false;
  } else if (response.data?.product?.create) {
    const product = response.data.product.create;
    console.log(`✅ Test product created: ${product.name} (ID: ${product.id})`);
    return true;
  }
  
  return false;
}

async function getAndRetryWithVAT(productInput) {
  // Get available VAT types
  const vatQuery = {
    query: `
      query {
        vatTypes {
          id
          name
          percent
        }
      }
    `
  };
  
  const response = await makeGraphQLRequest(vatQuery);
  
  if (response.data?.vatTypes?.length > 0) {
    const defaultVAT = response.data.vatTypes[0]; // Use first VAT type
    console.log(`✅ Using VAT type: ${defaultVAT.name} (${defaultVAT.percent}%)`);
    
    // Retry with VAT type
    productInput.vatTypeId = defaultVAT.id;
    
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
    
    const retryResponse = await makeGraphQLRequest(createMutation);
    
    if (retryResponse.data?.product?.create) {
      const product = retryResponse.data.product.create;
      console.log(`🎉 SUCCESS with VAT! Created: ${product.name} (ID: ${product.id})`);
      
      // Store the working VAT type for bulk import
      config.vatTypeId = defaultVAT.id;
      return true;
    } else {
      console.log('❌ Still failed with VAT:', JSON.stringify(retryResponse.errors, null, 2));
    }
  }
  
  return false;
}

async function importRealProducts() {
  // Load our scraped data
  if (!fs.existsSync(config.importFilePath)) {
    console.error('❌ Import file not found');
    return;
  }
  
  const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
  console.log(`📊 Found ${importData.length} products to import`);
  
  // Import first 5 products as demo
  const productsToImport = importData.slice(0, 5);
  const results = { success: 0, failed: 0 };
  
  for (let i = 0; i < productsToImport.length; i++) {
    const item = productsToImport[i];
    
    console.log(`\n📦 [${i + 1}/${productsToImport.length}] ${item.catalogueItem.name}`);
    
    const productInput = {
      tenantId: config.tenantId,
      name: item.catalogueItem.name,
      shapeIdentifier: "Product",
      variants: [
        {
          name: "Default",
          sku: `heater-${Date.now()}-${i}`,
          isDefault: true,
          price: item.price || 299.99,
          stock: 5
        }
      ]
    };
    
    // Add VAT type if we have it
    if (config.vatTypeId) {
      productInput.vatTypeId = config.vatTypeId;
    }
    
    const success = await createSingleProduct(productInput);
    
    if (success) {
      results.success++;
      console.log(`✅ Success`);
    } else {
      results.failed++;
      console.log(`❌ Failed`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n🎉 Import Complete!`);
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
}

async function createSingleProduct(productInput) {
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
  
  try {
    const response = await makeGraphQLRequest(createMutation);
    
    if (response.errors) {
      console.log('❌ Errors:', response.errors[0]?.message || 'Unknown error');
      return false;
    }
    
    return response.data?.product?.create?.id ? true : false;
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return false;
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

workingImport();
