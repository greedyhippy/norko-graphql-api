/**
 * Quick script to get the exact tenant and VAT type IDs we need
 */

const https = require('https');

const config = {
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6'
};

async function getRequiredIds() {
  console.log('🔍 Getting required IDs for import...');
  
  // Try to get VAT types - this should work
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
  
  let response = await makeGraphQLRequest(vatQuery);
  console.log('VAT Types response:', JSON.stringify(response, null, 2));
  
  // Try different ways to get tenant ID
  const queries = [
    {
      name: 'Tenant Query 1',
      query: `query { tenant { id identifier name } }`
    },
    {
      name: 'Me Query',
      query: `query { me { id } }`
    },
    {
      name: 'Root Query',
      query: `query { __schema { queryType { name } } }`
    }
  ];
  
  for (const q of queries) {
    console.log(`\n📋 Trying ${q.name}:`);
    try {
      const response = await makeGraphQLRequest({ query: q.query });
      console.log('Response:', JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }
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

getRequiredIds();
