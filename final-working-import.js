/**
 * Final Working Crystallize Import
 * Using actual tenant ID and handling VAT types properly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const config = {
  tenantId: '68683fb6c8233b2a3a4b38e3', // Actual tenant ID
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6',
  language: 'en',
  importFilePath: path.join(__dirname, '../heatshop-scraper/crystallize-import.json')
};

async function finalWorkingImport() {
  console.log('🚀 Final Working Crystallize Import');
  console.log(`📦 Tenant ID: ${config.tenantId}`);
  
  try {
    // Step 1: Create a default VAT type first (0% for demo)
    console.log('📋 Step 1: Creating default VAT type...');
    const vatTypeId = await createDefaultVATType();
    
    if (vatTypeId) {
      console.log(`✅ VAT type created: ${vatTypeId}`);
      config.vatTypeId = vatTypeId;
      
      // Step 2: Create test product
      console.log('📋 Step 2: Creating test product...');
      const success = await createTestProductWithVAT();
      
      if (success) {
        console.log('📋 Step 3: Importing real products...');
        await importRealProducts();
      }
    } else {
      console.log('⚠️ Could not create VAT type, trying alternative approach...');
      await tryAlternativeApproach();
    }
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
  }
}

async function createDefaultVATType() {
  const createVATMutation = {
    query: `
      mutation CreateVATType($input: CreateVatTypeInput!) {
        vatType {
          create(input: $input) {
            id
            name
            percent
          }
        }
      }
    `,
    variables: {
      input: {
        tenantId: config.tenantId,
        name: "Standard Rate",
        percent: 0
      }
    }
  };
  
  try {
    const response = await makeGraphQLRequest(createVATMutation);
    
    if (response.errors) {
      console.log('VAT creation errors (trying existing):', response.errors[0]?.message);
      // Try to get existing VAT types instead
      return await getExistingVATType();
    }
    
    if (response.data?.vatType?.create) {
      return response.data.vatType.create.id;
    }
    
  } catch (error) {
    console.log('VAT creation failed, trying existing VAT types...');
    return await getExistingVATType();
  }
  
  return null;
}

async function getExistingVATType() {
  // Try different queries to find VAT types
  const queries = [
    `query { vatType { getMany { id name percent } } }`,
    `query { tenant { vatTypes { id name percent } } }`,
    `query { me { tenant { vatTypes { id name percent } } } }`
  ];
  
  for (const queryStr of queries) {
    try {
      const response = await makeGraphQLRequest({ query: queryStr });
      
      if (response.data && !response.errors) {
        // Look for VAT types in the response
        const data = JSON.stringify(response.data);
        console.log('VAT query response:', data.substring(0, 200));
        
        // Extract any VAT type ID if found
        const vatMatch = data.match(/"id":"([^"]+)"/);
        if (vatMatch) {
          console.log('Found potential VAT type ID:', vatMatch[1]);
          return vatMatch[1];
        }
      }
    } catch (error) {
      console.log(`VAT query failed: ${error.message}`);
    }
  }
  
  return null;
}

async function createTestProductWithVAT() {
  const productInput = {
    tenantId: config.tenantId,
    name: "Demo Infrared Heater",
    shapeIdentifier: "Product",
    variants: [
      {
        name: "Default",
        sku: "demo-heater-001",
        isDefault: true,
        price: 199.99,
        stock: 1
      }
    ]
  };
  
  // Add VAT type if we have it
  if (config.vatTypeId) {
    productInput.vatTypeId = config.vatTypeId;
  }
  
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
    console.log('❌ Product creation errors:', JSON.stringify(response.errors, null, 2));
    return false;
  } else if (response.data?.product?.create) {
    const product = response.data.product.create;
    console.log(`✅ Test product created: ${product.name} (ID: ${product.id})`);
    return true;
  }
  
  return false;
}

async function tryAlternativeApproach() {
  console.log('🔄 Trying document creation instead...');
  
  const docInput = {
    tenantId: config.tenantId,
    name: "Infrared Heater Product Info",
    shapeIdentifier: "Document"
  };
  
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
      input: docInput
    }
  };
  
  const response = await makeGraphQLRequest(createMutation);
  
  if (response.data?.document?.create) {
    const doc = response.data.document.create;
    console.log(`✅ Created document: ${doc.name} (ID: ${doc.id})`);
    console.log('💡 Products can be created as documents for the demo!');
  } else {
    console.log('❌ Document creation also failed:', JSON.stringify(response.errors, null, 2));
  }
}

async function importRealProducts() {
  if (!fs.existsSync(config.importFilePath)) {
    console.error('❌ Import file not found');
    return;
  }
  
  const importData = JSON.parse(fs.readFileSync(config.importFilePath, 'utf8'));
  console.log(`📊 Found ${importData.length} products to import`);
  
  // Import first 3 products for demo
  const results = { success: 0, failed: 0 };
  
  for (let i = 0; i < 3 && i < importData.length; i++) {
    const item = importData[i];
    
    console.log(`\n📦 [${i + 1}/3] ${item.catalogueItem.name}`);
    
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
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n🎉 Demo Import Complete!`);
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.success > 0) {
    console.log('\n🚀 Ready to test the Remix frontend!');
    console.log('💡 Products should now be visible in Crystallize CMS and frontend');
  }
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
      console.log('❌ Error:', response.errors[0]?.message || 'Unknown error');
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

finalWorkingImport();
