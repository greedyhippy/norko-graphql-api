// GraphQL Backend for HeatShop Products - Railway Deployment
// Apollo Server v4 with scraped product data and authentication

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Authentication configuration
const JWT_SECRET = process.env.JWT_SECRET;
const API_KEY = process.env.API_KEY;
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';

console.log('🔐 Authentication Config:');
console.log('- API_KEY:', API_KEY ? '✅ Set' : '❌ Missing');
console.log('- JWT_SECRET:', JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('- AUTH_REQUIRED:', AUTH_REQUIRED);

// Load scraped products data
let productsData = [];
try {
  const dataPath = path.join(__dirname, 'crystallize-products.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const parsedData = JSON.parse(rawData);
  productsData = parsedData.products || [];
  console.log(`📦 Loaded ${productsData.length} products from scraped data`);
} catch (error) {
  console.error('❌ Error loading products data:', error.message);
  // Fallback to sample data if file not found
  productsData = generateSampleProducts();
}

// GraphQL Schema Definition
const typeDefs = `
  type Product {
    id: ID!
    name: String!
    path: String!
    category: String!
    description: Description!
    specifications: Specifications!
    features: Features!
    images: [ProductImage!]!
    variants: [ProductVariant!]!
    price: Float!
    currency: String!
  }

  type Description {
    html: String!
    plainText: String!
  }

  type Specifications {
    wattage: Int!
    dimensions: String!
    weight: Float!
  }

  type Features {
    html: String!
    plainText: String!
  }

  type ProductImage {
    url: String!
    altText: String!
  }

  type ProductVariant {
    id: ID!
    name: String!
    sku: String!
    price: Float!
    currency: String!
    stock: Int!
    isDefault: Boolean!
  }

  input ProductFilter {
    category: String
    minPrice: Float
    maxPrice: Float
    minWattage: Int
    maxWattage: Int
  }

  type Query {
    products(first: Int = 20, filter: ProductFilter): [Product!]!
    product(id: ID!): Product
    categories: [String!]!
    productsByCategory(category: String!): [Product!]!
    searchProducts(query: String!): [Product!]!
    productsByPriceRange(minPrice: Float!, maxPrice: Float!): [Product!]!
    productsByWattage(minWattage: Int!, maxWattage: Int!): [Product!]!
    health: String!
  }
`;

// GraphQL Resolvers
const resolvers = {
  Query: {
    products: async (parent, { first = 20, filter }) => {
      let filteredProducts = [...productsData];
      
      if (filter) {
        if (filter.category) {
          filteredProducts = filteredProducts.filter(p => 
            p.category.toLowerCase().includes(filter.category.toLowerCase())
          );
        }
        
        if (filter.minPrice || filter.maxPrice) {
          filteredProducts = filteredProducts.filter(p => {
            const price = p.variants[0]?.price || 0;
            return (!filter.minPrice || price >= filter.minPrice) &&
                   (!filter.maxPrice || price <= filter.maxPrice);
          });
        }
        
        if (filter.minWattage || filter.maxWattage) {
          filteredProducts = filteredProducts.filter(p => {
            const wattage = p.components.specifications.chunks[0]?.wattage || 0;
            return (!filter.minWattage || wattage >= filter.minWattage) &&
                   (!filter.maxWattage || wattage <= filter.maxWattage);
          });
        }
      }
      
      return filteredProducts.slice(0, first).map(transformProduct);
    },

    product: async (parent, { id }) => {
      const product = productsData.find(p => p.id === id);
      return product ? transformProduct(product) : null;
    },

    categories: () => {
      const categories = [...new Set(productsData.map(p => p.category))];
      return categories.sort();
    },

    productsByCategory: async (parent, { category }) => {
      const products = productsData.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
      return products.map(transformProduct);
    },

    searchProducts: async (parent, { query }) => {
      const searchTerm = query.toLowerCase();
      const filteredProducts = productsData.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.components.description.content.plainText.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
      );
      return filteredProducts.map(transformProduct);
    },

    productsByPriceRange: async (parent, { minPrice, maxPrice }) => {
      const filteredProducts = productsData.filter(p => {
        const price = p.variants[0]?.price || 0;
        return price >= minPrice && price <= maxPrice;
      });
      return filteredProducts.map(transformProduct);
    },

    productsByWattage: async (parent, { minWattage, maxWattage }) => {
      const filteredProducts = productsData.filter(p => {
        const wattage = p.components.specifications.chunks[0]?.wattage || 0;
        return wattage >= minWattage && wattage <= maxWattage;
      });
      return filteredProducts.map(transformProduct);
    },

    health: () => `🚀 Norko GraphQL API is running! ${productsData.length} products loaded.`
  }
};

// Transform scraped product data to GraphQL schema
function transformProduct(product) {
  const specs = product.components.specifications.chunks[0] || {};
  
  return {
    id: product.id,
    name: product.name,
    path: product.path,
    category: product.category,
    description: {
      html: product.components.description.content.html,
      plainText: product.components.description.content.plainText
    },
    specifications: {
      wattage: specs.wattage || 0,
      dimensions: specs.dimensions || 'Unknown',
      weight: specs.weight || 0
    },
    features: {
      html: product.components.features.content.html,
      plainText: product.components.features.content.plainText
    },
    images: product.components.productImages.images || [],
    variants: product.variants.map((variant, index) => ({
      id: `${product.id}-variant-${index}`,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      currency: variant.priceVariants[0]?.currency || 'GBP',
      stock: variant.stock,
      isDefault: variant.isDefault || false
    })),
    price: product.variants[0]?.price || 0,
    currency: product.variants[0]?.priceVariants[0]?.currency || 'GBP'
  };
}

// Generate sample products if data file not found
function generateSampleProducts() {
  console.log('📝 Generating sample product data...');
  return [
    {
      id: 'sample-panel-heater',
      name: 'Sample Infrared Panel Heater',
      path: '/infrared-heaters/panel-heaters/sample-panel-heater',
      category: 'Panel Heaters',
      components: {
        description: {
          content: {
            html: '<p>High-quality infrared panel heater for efficient heating.</p>',
            plainText: 'High-quality infrared panel heater for efficient heating.'
          }
        },
        specifications: {
          chunks: [{
            wattage: 900,
            dimensions: '1000mm x 800mm',
            weight: 8.5
          }]
        },
        features: {
          content: {
            html: '<ul><li>Energy efficient</li><li>Easy installation</li></ul>',
            plainText: 'Energy efficient, Easy installation'
          }
        },
        productImages: {
          images: []
        }
      },
      variants: [{
        name: '900W',
        sku: 'SAM-900W',
        price: 299.99,
        priceVariants: [{ currency: 'GBP' }],
        stock: 10,
        isDefault: true
      }]
    }
  ];
}

// Authentication context function
function createAuthContext({ req }) {
  // Skip authentication in development (if AUTH_REQUIRED is false)
  if (process.env.NODE_ENV === 'development' && !AUTH_REQUIRED) {
    console.log('🔓 Development mode - authentication bypassed');
    return { authenticated: true, user: { role: 'development' } };
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ Missing Authorization header');
    throw new Error('Authorization header required for secure access');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    console.log('❌ Missing Bearer token');
    throw new Error('Bearer token required for authentication');
  }

  // Simple API Key validation (for your frontend)
  if (API_KEY && token === API_KEY) {
    console.log('✅ API Key authentication successful');
    return { 
      authenticated: true, 
      user: { 
        role: 'frontend_client',
        apiKey: token 
      } 
    };
  }

  // JWT Token validation (for advanced use cases)
  if (JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT authentication successful');
      return { authenticated: true, user: decoded };
    } catch (error) {
      console.log('❌ JWT validation failed:', error.message);
      // Continue to check other methods
    }
  }

  console.log('❌ Authentication failed - invalid token');
  throw new Error('Invalid authentication token');
}

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Express Server Setup
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  console.log('🚀 Starting Apollo Server...');

  // Create Apollo Server with authentication
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    
    // Add authentication context
    context: createAuthContext,
    
    // Security settings for production
    introspection: process.env.NODE_ENV !== 'production',
    
    // Format errors to not expose sensitive information
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      
      // In production, sanitize error messages
      if (process.env.NODE_ENV === 'production') {
        if (error.message.includes('Authorization') || error.message.includes('authentication')) {
          return new Error('Authentication required');
        }
        if (error.message.includes('Invalid')) {
          return new Error('Authentication failed');
        }
        return new Error('Internal server error');
      }
      
      return error;
    }
  });

  // CRITICAL: Start the server before applying middleware
  await server.start();
  console.log('✅ Apollo Server started successfully');

  // Apply middleware with authentication and rate limiting
  app.use(
    '/graphql',
    apiLimiter,  // Add rate limiting
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }),
    bodyParser.json({ limit: '50mb' }),
    expressMiddleware(server, {
      context: createAuthContext  // This applies authentication
    })
  );

  // Enhanced health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      products: productsData.length,
      timestamp: new Date().toISOString(),
      authentication: AUTH_REQUIRED ? 'enabled' : 'disabled',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: '🔥 Norko GraphQL API',
      products: productsData.length,
      graphql: '/graphql',
      playground: 'https://studio.apollographql.com/sandbox/explorer',
      health: '/health',
      authentication: AUTH_REQUIRED ? 'enabled' : 'disabled'
    });
  });

  // Enhanced GraphQL playground with authentication support
  app.get('/playground', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Norko GraphQL Playground</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: white; }
              .container { max-width: 1200px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 40px; }
              .auth-section { background: #2a2a2a; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
              .query-section { display: flex; gap: 20px; margin-bottom: 20px; }
              .query-input { flex: 1; }
              textarea, input { width: 100%; background: #2a2a2a; color: white; border: 1px solid #444; padding: 15px; font-family: monospace; }
              textarea { height: 200px; }
              .result { background: #2a2a2a; padding: 20px; border-radius: 5px; }
              button { background: #007cba; color: white; padding: 12px 24px; border: none; border-radius: 3px; cursor: pointer; margin: 10px 5px; font-size: 16px; }
              button:hover { background: #005a8b; }
              pre { background: #1e1e1e; padding: 15px; border-radius: 5px; overflow-x: auto; }
              .examples { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
              .example-btn { background: #444; padding: 8px 12px; font-size: 14px; }
              .status { padding: 10px; border-radius: 3px; margin-bottom: 20px; }
              .status.enabled { background: #4a7c59; }
              .status.disabled { background: #7c4a4a; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔥 Norko GraphQL API Playground</h1>
                  <p>Interactive GraphQL testing interface with ${productsData.length} infrared heater products</p>
                  <div class="status ${AUTH_REQUIRED ? 'enabled' : 'disabled'}">
                      Authentication: ${AUTH_REQUIRED ? '🔐 ENABLED' : '🔓 DISABLED'}
                  </div>
              </div>
              
              ${AUTH_REQUIRED ? `
              <div class="auth-section">
                  <h3>🔐 Authentication</h3>
                  <p>Enter your Bearer token to access the API:</p>
                  <input type="text" id="authToken" placeholder="Enter your API token here..." />
                  <button onclick="testAuth()">Test Authentication</button>
              </div>
              ` : ''}
              
              <div class="examples">
                  <button class="example-btn" onclick="loadExample('health')">Health Check</button>
                  <button class="example-btn" onclick="loadExample('products')">Get Products</button>
                  <button class="example-btn" onclick="loadExample('categories')">Get Categories</button>
                  <button class="example-btn" onclick="loadExample('search')">Search Products</button>
              </div>
              
              <div class="query-section">
                  <div class="query-input">
                      <h3>GraphQL Query:</h3>
                      <textarea id="query" placeholder="Enter your GraphQL query here...">
query GetProducts {
  products(first: 3) {
    name
    category
    price
    currency
    specifications {
      wattage
    }
  }
}</textarea>
                  </div>
              </div>
              
              <button onclick="runQuery()">▶ Run Query</button>
              
              <div class="result">
                  <h3>Result:</h3>
                  <pre id="result">Click "Run Query" to see results...</pre>
              </div>
          </div>

          <script>
              const API_URL = window.location.origin + '/graphql';
              const AUTH_REQUIRED = ${AUTH_REQUIRED};
              
              const examples = {
                  health: \`query {
  health
}\`,
                  products: \`query GetProducts {
  products(first: 3) {
    name
    category
    price
    currency
    specifications {
      wattage
      dimensions
    }
  }
}\`,
                  categories: \`query GetCategories {
  categories
}\`,
                  search: \`query SearchHeaters {
  searchProducts(query: "panel") {
    name
    price
    specifications {
      wattage
    }
  }
}\`
              };
              
              function loadExample(type) {
                  document.getElementById('query').value = examples[type];
              }
              
              function getHeaders() {
                  const headers = {
                      'Content-Type': 'application/json',
                  };
                  
                  if (AUTH_REQUIRED) {
                      const token = document.getElementById('authToken').value;
                      if (token) {
                          headers['Authorization'] = \`Bearer \${token}\`;
                      }
                  }
                  
                  return headers;
              }
              
              async function testAuth() {
                  const resultElement = document.getElementById('result');
                  resultElement.textContent = 'Testing authentication...';
                  
                  try {
                      const response = await fetch(API_URL, {
                          method: 'POST',
                          headers: getHeaders(),
                          body: JSON.stringify({ query: '{ health }' })
                      });
                      
                      const data = await response.json();
                      if (response.ok && !data.errors) {
                          resultElement.textContent = '✅ Authentication successful!\\n' + JSON.stringify(data, null, 2);
                      } else {
                          resultElement.textContent = '❌ Authentication failed:\\n' + JSON.stringify(data, null, 2);
                      }
                  } catch (error) {
                      resultElement.textContent = '❌ Error: ' + error.message;
                  }
              }
              
              async function runQuery() {
                  const query = document.getElementById('query').value;
                  const resultElement = document.getElementById('result');
                  
                  resultElement.textContent = 'Running query...';
                  
                  try {
                      const response = await fetch(API_URL, {
                          method: 'POST',
                          headers: getHeaders(),
                          body: JSON.stringify({ query })
                      });
                      
                      const data = await response.json();
                      resultElement.textContent = JSON.stringify(data, null, 2);
                  } catch (error) {
                      resultElement.textContent = 'Error: ' + error.message;
                  }
              }
          </script>
      </body>
      </html>
    `);
  });

  const PORT = process.env.PORT || 4000;
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📊 Loaded ${productsData.length} products`);
    console.log(`🎮 GraphQL Playground: http://localhost:${PORT}/playground`);
    console.log(`🔐 Authentication: ${AUTH_REQUIRED ? 'ENABLED' : 'DISABLED'}`);
    if (AUTH_REQUIRED) {
      console.log(`🔑 API Key: ${API_KEY ? 'Set' : 'Missing'}`);
      console.log(`🎫 JWT Secret: ${JWT_SECRET ? 'Set' : 'Missing'}`);
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('💥 Server startup failed:', error);
  process.exit(1);
});
