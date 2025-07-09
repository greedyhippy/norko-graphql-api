/**
 * Check available shapes in Crystallize
 */

const https = require('https');

const config = {
  tokenId: '1263a56d7ee217ae294c',
  tokenSecret: 'ddf5e3117d1ccab6ca8ea09fa0214d412c027cb6'
};

async function getShapes() {
  const query = {
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
    req.write(JSON.stringify(query));
    req.end();
  });
}

getShapes().then(result => {
  console.log('Available shapes:', JSON.stringify(result, null, 2));
}).catch(console.error);
