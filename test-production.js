/**
 * Production Deployment Test for Railway
 * Tests the deployed GraphQL API with real product data
 */

const fetch = require('node-fetch');

// Railway production URL (found via deployment search)
const PRODUCTION_URL = process.env.RAILWAY_URL || 'https://norko-graphql-api-production.up.railway.app';
const GRAPHQL_ENDPOINT = `${PRODUCTION_URL}/graphql`;

/**
 * Test GraphQL queries against production deployment
 */
async function testProductionAPI() {
  console.log('🚀 Testing Production Railway Deployment');
  console.log(`🌐 Testing: ${GRAPHQL_ENDPOINT}`);

  // Test 1: Basic health check query
  const healthQuery = `
    query {
      products(limit: 1) {
        id
        name
        pricing {
          basePrice
          currency
        }
      }
      metadata {
        totalProducts
        scrapedAt
        source
      }
    }
  `;

  try {
    console.log('\n🧪 Test 1: Health Check & Basic Product Query');
    const healthResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: healthQuery })
    });

    if (!healthResponse.ok) {
      throw new Error(`HTTP ${healthResponse.status}: ${healthResponse.statusText}`);
    }

    const healthData = await healthResponse.json();
    
    if (healthData.errors) {
      console.error('❌ GraphQL Errors:', healthData.errors);
      return false;
    }

    console.log('✅ API is responding');
    console.log(`✅ Total products: ${healthData.data.metadata.totalProducts}`);
    console.log(`✅ Data source: ${healthData.data.metadata.source}`);
    console.log(`✅ Last scraped: ${healthData.data.metadata.scrapedAt}`);
    
    if (healthData.data.products.length > 0) {
      const product = healthData.data.products[0];
      console.log(`✅ Sample product: ${product.name} - £${product.pricing.basePrice}`);
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }

  // Test 2: Advanced product filtering
  const filterQuery = `
    query {
      products(
        category: "Panel Heaters"
        minPrice: 200
        maxPrice: 500
        limit: 5
      ) {
        id
        name
        category
        pricing {
          basePrice
        }
        specifications {
          basic {
            wattage
            mounting
          }
          powerCategory
        }
      }
    }
  `;

  try {
    console.log('\n🧪 Test 2: Advanced Filtering');
    const filterResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: filterQuery })
    });

    const filterData = await filterResponse.json();
    
    if (filterData.errors) {
      console.error('❌ Filter query errors:', filterData.errors);
      return false;
    }

    console.log(`✅ Filtered results: ${filterData.data.products.length} products`);
    filterData.data.products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - £${product.pricing.basePrice} (${product.specifications.basic.wattage}W)`);
    });

  } catch (error) {
    console.error('❌ Filter test failed:', error.message);
    return false;
  }

  // Test 3: Search functionality
  const searchQuery = `
    query {
      searchProducts(query: "infrared") {
        id
        name
        category
        pricing {
          basePrice
        }
      }
    }
  `;

  try {
    console.log('\n🧪 Test 3: Search Functionality');
    const searchResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: searchQuery })
    });

    const searchData = await searchResponse.json();
    
    if (searchData.errors) {
      console.error('❌ Search query errors:', searchData.errors);
      return false;
    }

    console.log(`✅ Search results: ${searchData.data.searchProducts.length} products found`);

  } catch (error) {
    console.error('❌ Search test failed:', error.message);
    return false;
  }

  console.log('\n🎉 All production tests passed!');
  console.log('🚀 Railway deployment is working correctly');
  return true;
}

// Helper function to wait for deployment
async function waitForDeployment(maxAttempts = 10, delayMs = 30000) {
  console.log('⏳ Waiting for Railway deployment to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${PRODUCTION_URL}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        console.log('✅ Deployment is ready!');
        return true;
      }
    } catch (error) {
      console.log(`   Attempt ${attempt}/${maxAttempts}: Not ready yet...`);
    }
    
    if (attempt < maxAttempts) {
      console.log(`   Waiting ${delayMs/1000}s before next check...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log('⚠️  Deployment not ready after maximum attempts');
  return false;
}

// Run tests
async function main() {
  if (process.argv[2] === '--wait') {
    const isReady = await waitForDeployment();
    if (!isReady) {
      console.log('❌ Deployment check timed out');
      process.exit(1);
    }
  }
  
  const success = await testProductionAPI();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { testProductionAPI, waitForDeployment };
