/**
 * Comprehensive Crystallize Import Script
 * Updated for 2025 API Guidelines
 * https://crystallize.com/learn/developer-guides/importing-data
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  tenantIdentifier: 'norko',
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6',
  language: 'en',
  importFilePath: path.join(__dirname, '../heatshop-scraper/crystallize-import.json')
};

/**
 * Main import function using the PIM API directly
 * This is the most reliable method according to 2025 guidelines
 */
async function importToCrediting() {
  try {
    console.log('🚀 Starting Crystallize Import (2025 API Guidelines)');
    console.log(`📦 Tenant: ${config.tenantIdentifier}`);
    console.log(`🌐 PIM API: https://pim.crystallize.com/graphql`);
    
    // Load import data
    if (!fs.existsSync(config.importFilePath)) {
      console.error('❌ Import file not found:', config.importFilePath);
      return false;
    }
    
    const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
    console.log(`📊 Found ${importData.length} items to import`);
    
    // Test authentication first
    console.log('🔐 Testing authentication...');
    const authTest = await testAuthentication();
    if (!authTest) {
      console.error('❌ Authentication failed');
      return false;
    }
    console.log('✅ Authentication successful');
    
    // Check if we need to create shapes first
    console.log('🏗️ Checking required shapes...');
    await ensureShapesExist();
    
    // Import products
    console.log('📦 Starting product import...');
    const results = await importProducts(importData);
    
    console.log('\n🎉 Import Summary:');
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️ Skipped: ${results.skipped}`);
    
    return results.success > 0;
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    return false;
  }
}

/**
 * Test authentication with a simple query
 */
async function testAuthentication() {
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
  
  try {
    const response = await makeGraphQLRequest(query);
    console.log('Auth response:', JSON.stringify(response, null, 2));
    return response && response.data && response.data.tenant;
  } catch (error) {
    console.error('Auth test failed:', error.message);
    return false;
  }
}

/**
 * Ensure required shapes exist
 */
async function ensureShapesExist() {
  // Check if "HeaterProduct" shape exists
  const query = {
    query: `
      query {
        shape {
          get(identifier: "HeaterProduct") {
            id
            identifier
            name
          }
        }
      }
    `
  };
  
  try {
    const response = await makeGraphQLRequest(query);
    if (response.data.shape.get) {
      console.log('✅ HeaterProduct shape exists');
    } else {
      console.log('⚠️ HeaterProduct shape not found - you may need to create it manually');
      console.log('💡 Go to https://app.crystallize.com and create the shape first');
    }
  } catch (error) {
    console.log('⚠️ Could not check shapes:', error.message);
  }
}

/**
 * Import products using PIM API mutations
 */
async function importProducts(importData) {
  const results = { success: 0, failed: 0, skipped: 0 };
  
  for (let i = 0; i < importData.length; i++) {
    const item = importData[i];
    
    try {
      console.log(`\n📦 [${i + 1}/${importData.length}] Importing: ${item.catalogueItem.name}`);
      
      // Check if product already exists
      const existsQuery = {
        query: `
          query CheckProduct($path: String!) {
            catalogue(language: "${config.language}", path: $path) {
              id
              name
            }
          }
        `,
        variables: {
          path: item.catalogueItem.path
        }
      };
      
      const existsResponse = await makeGraphQLRequest(existsQuery);
      if (existsResponse.data.catalogue && existsResponse.data.catalogue.id) {
        console.log(`⏭️ Product already exists: ${item.catalogueItem.name}`);
        results.skipped++;
        continue;
      }
      
      // Create the product
      const createMutation = {
        query: `
          mutation CreateProduct($input: CreateProductInput!) {
            product {
              create(language: "${config.language}", input: $input) {
                id
                name
                path
              }
            }
          }
        `,
        variables: {
          input: {
            name: item.catalogueItem.name,
            path: item.catalogueItem.path,
            shapeIdentifier: "HeaterProduct",
            topicPaths: item.catalogueItem.topics || [],
            components: transformComponents(item.catalogueItem.components || [])
          }
        }
      };
      
      const createResponse = await makeGraphQLRequest(createMutation);
      
      if (createResponse.errors) {
        console.error(`❌ GraphQL errors:`, createResponse.errors);
        results.failed++;
      } else if (createResponse.data.product.create) {
        const product = createResponse.data.product.create;
        console.log(`✅ Created: ${product.name} (ID: ${product.id})`);
        results.success++;
        
        // Publish the product
        await publishProduct(product.id);
      } else {
        console.error(`❌ Unexpected response format`);
        results.failed++;
      }
      
      // Rate limiting - pause between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Failed to import ${item.catalogueItem.name}:`, error.message);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Transform components to match expected format
 */
function transformComponents(components) {
  return components.map(component => {
    // Handle different component types
    switch (component.type) {
      case 'richText':
        return {
          componentId: component.componentId,
          richText: component.content
        };
      case 'singleLine':
        return {
          componentId: component.componentId,
          singleLine: {
            text: component.content
          }
        };
      case 'numeric':
        return {
          componentId: component.componentId,
          numeric: {
            number: parseFloat(component.content) || 0
          }
        };
      case 'images':
        return {
          componentId: component.componentId,
          images: component.content.map(img => ({
            src: img.src,
            altText: img.altText || ''
          }))
        };
      default:
        return component;
    }
  });
}

/**
 * Publish a product after creation
 */
async function publishProduct(productId) {
  const publishMutation = {
    query: `
      mutation PublishProduct($id: ID!) {
        product {
          publish(id: $id, language: "${config.language}") {
            id
          }
        }
      }
    `,
    variables: {
      id: productId
    }
  };
  
  try {
    await makeGraphQLRequest(publishMutation);
    console.log(`📢 Published product ${productId}`);
  } catch (error) {
    console.log(`⚠️ Could not publish ${productId}:`, error.message);
  }
}

/**
 * Make a GraphQL request to the PIM API
 */
async function makeGraphQLRequest(payload) {
  return new Promise((resolve, reject) => {
    const authHeader = Buffer.from(`${config.tokenId}:${config.tokenSecret}`).toString('base64');
    
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

/**
 * Generate modern spec file for new CLI usage
 */
async function generateModernSpecFile() {
  console.log('📝 Generating modern spec file for new CLI...');
  
  const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
  
  const specFile = {
    meta: {
      version: "2025.1",
      created: new Date().toISOString(),
      description: "Norko infrared heaters - Modern CLI import"
    },
    tenantIdentifier: config.tenantIdentifier,
    items: importData.map(item => ({
      ...item.catalogueItem,
      type: 'product',
      language: config.language
    }))
  };
  
  const outputPath = path.join(__dirname, '../heatshop-scraper/modern-cli-spec.json');
  fs.writeFileSync(outputPath, JSON.stringify(specFile, null, 2));
  
  console.log('✅ Created modern-cli-spec.json');
  console.log('\n📋 To use with new CLI:');
  console.log('1. Install: curl -LSs https://crystallizeapi.github.io/cli/install.bash | bash');
  console.log('2. Import: ~/crystallize mass-operation run norko modern-cli-spec.json');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--spec-only')) {
    await generateModernSpecFile();
  } else {
    const success = await importToCrediting();
    process.exit(success ? 0 : 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { importToCrediting, generateModernSpecFile };
