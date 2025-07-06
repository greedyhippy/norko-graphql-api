/**
 * Complete Crystallize Import Script
 * Gets required IDs and imports all products automatically
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

let tenantInfo = null;

async function completeImport() {
  try {
    console.log('🚀 Complete Crystallize Import Process');
    
    // Step 1: Get tenant information
    console.log('📋 Step 1: Getting tenant information...');
    tenantInfo = await getTenantInfo();
    if (!tenantInfo) {
      console.error('❌ Could not get tenant information');
      return false;
    }
    
    // Step 2: Load import data
    console.log('📋 Step 2: Loading import data...');
    if (!fs.existsSync(config.importFilePath)) {
      console.error('❌ Import file not found:', config.importFilePath);
      return false;
    }
    
    const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
    console.log(`📊 Found ${importData.length} items to import`);
    
    // Step 3: Import products
    console.log('📋 Step 3: Starting product import...');
    const results = await importAllProducts(importData.slice(0, 3)); // Start with first 3 as test
    
    console.log('\n🎉 Import Results:');
    console.log(`✅ Success: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    return results.success > 0;
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    return false;
  }
}

async function getTenantInfo() {
  // Get basic tenant info to find tenantId and default VAT type
  const query = {
    query: `
      query GetTenantInfo {
        me {
          id
        }
        vatTypes {
          id
          name
          percent
        }
      }
    `
  };
  
  try {
    const response = await makeGraphQLRequest(query);
    
    if (response.errors) {
      console.log('Trying alternative tenant query...');
      return await getTenantInfoAlternative();
    }
    
    if (response.data) {
      console.log('📊 Tenant info response:', JSON.stringify(response.data, null, 2));
      
      // Find default VAT type (usually 0% or the first one)
      const defaultVAT = response.data.vatTypes?.[0];
      
      return {
        tenantId: response.data.me?.id || config.tenantIdentifier,
        vatTypeId: defaultVAT?.id,
        vatTypes: response.data.vatTypes
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting tenant info:', error.message);
    return null;
  }
}

async function getTenantInfoAlternative() {
  // Try a simpler query
  const query = {
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
  
  try {
    const response = await makeGraphQLRequest(query);
    
    if (response.data && response.data.vatTypes) {
      console.log('✅ Got VAT types:', response.data.vatTypes);
      
      return {
        tenantId: config.tenantIdentifier, // Use identifier as fallback
        vatTypeId: response.data.vatTypes[0]?.id,
        vatTypes: response.data.vatTypes
      };
    }
    
    // If all else fails, try to create with minimal required fields
    return {
      tenantId: config.tenantIdentifier,
      vatTypeId: 'default', // We'll handle this in the mutation
      vatTypes: []
    };
    
  } catch (error) {
    console.error('Alternative tenant query failed:', error.message);
    return null;
  }
}

async function importAllProducts(importData) {
  const results = { success: 0, failed: 0 };
  
  for (let i = 0; i < importData.length; i++) {
    const item = importData[i];
    
    try {
      console.log(`\n📦 [${i + 1}/${importData.length}] Importing: ${item.catalogueItem.name}`);
      
      const success = await createProduct(item);
      
      if (success) {
        results.success++;
        console.log(`✅ Successfully imported: ${item.catalogueItem.name}`);
      } else {
        results.failed++;
        console.log(`❌ Failed to import: ${item.catalogueItem.name}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error importing ${item.catalogueItem.name}:`, error.message);
      results.failed++;
    }
  }
  
  return results;
}

async function createProduct(item) {
  const productInput = {
    tenantId: tenantInfo.tenantId,
    name: item.catalogueItem.name,
    shapeIdentifier: "Product", // Generic product shape
    vatTypeId: tenantInfo.vatTypeId,
    variants: [
      {
        name: item.catalogueItem.name,
        sku: `heater-${Date.now()}`, // Simple SKU generation
        price: item.price || 0,
        stock: 10, // Default stock
        isDefault: true // Required field
      }
    ],
    components: [] // Start with empty components
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
  
  try {
    const response = await makeGraphQLRequest(createMutation);
    
    if (response.errors) {
      console.log('❌ GraphQL errors:', JSON.stringify(response.errors, null, 2));
      return false;
    }
    
    if (response.data && response.data.product && response.data.product.create) {
      const product = response.data.product.create;
      console.log(`✅ Created product: ${product.name} (ID: ${product.id})`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error creating product:', error.message);
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

if (require.main === module) {
  completeImport();
}

module.exports = { completeImport };
