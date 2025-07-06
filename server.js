/**
 * Enhanced GraphQL Backend for Norko Infrared Heaters - Railway Deployment
 * Apollo Server v4 with comprehensive scraped product data and authentication
 * 
 * Features:
 * - Comprehensive product data from enhanced web scraper
 * - Advanced filtering and search capabilities
 * - Authentication and API key protection
 * - Rate limiting and security measures
 * - Real-time product updates and caching
 * 
 * @author Norko Development Team
 * @version 2.0.0
 * @since 2025-07-06
 */

// Load environment variables
try {
  require('dotenv').config();
} catch (error) {
  console.log('⚠️  dotenv not available, using system environment variables');
}

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
console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');

// Enhanced data loading with fallback and validation
let productsData = [];
let productsMetadata = {};

/**
 * Load and validate product data from enhanced scraper
 * @returns {Promise<void>}
 */
async function loadProductData() {
  try {
    // Try to load enhanced scraper data first
    const enhancedDataPath = path.join(__dirname, '../heatshop-scraper/crystallize-products.json');
    const fallbackDataPath = path.join(__dirname, 'crystallize-products.json');
    
    let rawData;
    
    try {
      rawData = fs.readFileSync(enhancedDataPath, 'utf8');
      console.log('📦 Loading enhanced scraper data from heatshop-scraper/');
    } catch (error) {
      console.log('📦 Enhanced data not found, trying fallback location...');
      try {
        rawData = fs.readFileSync(fallbackDataPath, 'utf8');
        console.log('📦 Loading fallback data from local file');
      } catch (fallbackError) {
        console.log('⚠️  No product data found, generating sample data');
        productsData = generateSampleProducts();
        productsMetadata = {
          scrapedAt: new Date().toISOString(),
          totalProducts: productsData.length,
          source: 'sample_data'
        };
        return;
      }
    }
    
    const parsedData = JSON.parse(rawData);
    
    // Handle both old and new data structures
    if (parsedData.products && parsedData.metadata) {
      // New enhanced format from scraper
      productsData = parsedData.products;
      productsMetadata = parsedData.metadata;
      console.log(`✅ Loaded ${productsData.length} products from enhanced scraper data`);
      console.log(`📊 Scraped at: ${productsMetadata.scrapedAt}`);
      console.log(`🏷️  Categories: ${productsMetadata.categories?.length || 0}`);
    } else if (Array.isArray(parsedData)) {
      // Legacy format - array of products
      productsData = parsedData;
      productsMetadata = {
        scrapedAt: new Date().toISOString(),
        totalProducts: productsData.length,
        source: 'legacy_data'
      };
      console.log(`✅ Loaded ${productsData.length} products from legacy format`);
    } else {
      console.log('⚠️  Invalid data format, generating sample data');
      productsData = generateSampleProducts();
      productsMetadata = {
        scrapedAt: new Date().toISOString(),
        totalProducts: productsData.length,
        source: 'sample_data'
      };
    }
    
    // Validate product data structure
    if (productsData.length === 0) {
      console.log('⚠️  No products found, generating sample data');
      productsData = generateSampleProducts();
    }
    
    console.log(`🎯 Data validation: ${productsData.length} products ready for GraphQL API`);
    
  } catch (error) {
    console.error('❌ Failed to load product data:', error.message);
    console.log('🔄 Falling back to sample product data...');
    productsData = generateSampleProducts();
    productsMetadata = {
      scrapedAt: new Date().toISOString(),
      totalProducts: productsData.length,
      source: 'sample_data',
      error: error.message
    };
  }
}

// GraphQL Schema Definition
const typeDefs = `#graphql
  type Product {
    id: ID!
    name: String!
    path: String!
    category: String!
    description: Description!
    specifications: Specifications!
    features: Features!
    images: [Image!]!
    variants: [ProductVariant!]!
    price: Float!
    currency: String!
    sourceUrl: String
    extractedAt: String
    warranty: String
  }

  type Description {
    html: String!
    plainText: String!
  }

  type Specifications {
    wattage: Int!
    dimensions: String!
    weight: Float!
    coverage: String
    mounting: String
    efficiency: String
  }

  type Features {
    html: String!
    plainText: String!
  }

  type Image {
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

  type APIMetadata {
    scrapedAt: String!
    totalProducts: Int!
    source: String!
    categories: [String!]!
  }

  type Query {
    products(first: Int = 20, filter: ProductFilter): [Product!]!
    product(id: ID!): Product
    categories: [String!]!
    productsByCategory(category: String!): [Product!]!
    searchProducts(query: String!): [Product!]!
    productsByPriceRange(minPrice: Float!, maxPrice: Float!): [Product!]!
    productsByWattage(minWattage: Int!, maxWattage: Int!): [Product!]!
    metadata: APIMetadata!
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
            const wattage = p.components?.specifications?.chunks[0]?.wattage || p.specifications?.basic?.wattage || 0;
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
      const filteredProducts = productsData.filter(p => {
        const description = p.components?.description?.content?.plainText || p.information?.description || '';
        return p.name.toLowerCase().includes(searchTerm) ||
               description.toLowerCase().includes(searchTerm) ||
               p.category.toLowerCase().includes(searchTerm);
      });
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
        const wattage = p.components?.specifications?.chunks[0]?.wattage || p.specifications?.basic?.wattage || 0;
        return wattage >= minWattage && wattage <= maxWattage;
      });
      return filteredProducts.map(transformProduct);
    },

    metadata: () => ({
      scrapedAt: productsMetadata.scrapedAt || new Date().toISOString(),
      totalProducts: productsData.length,
      source: productsMetadata.source || 'unknown',
      categories: [...new Set(productsData.map(p => p.category))].sort()
    }),

    health: () => `🚀 Norko GraphQL API is running! ${productsData.length} products loaded.`
  }
};

// Transform scraped product data to GraphQL schema
function transformProduct(product) {
  // Handle enhanced scraper data structure
  const specs = product.components?.specifications?.chunks[0] || product.specifications?.basic || {};
  const description = product.components?.description?.content || {
    html: product.information?.description || '<p>High-quality infrared heater.</p>',
    plainText: product.information?.description?.replace(/<[^>]*>/g, '') || 'High-quality infrared heater.'
  };
  const features = product.components?.features?.content || {
    html: product.information?.features || '<ul><li>Energy efficient heating</li></ul>',
    plainText: product.information?.features?.replace(/<[^>]*>/g, '') || 'Energy efficient heating'
  };
  const images = product.components?.productImages?.images || product.media?.images || [];
  
  return {
    id: product.id,
    name: product.name,
    path: product.path,
    category: product.category,
    description: {
      html: description.html,
      plainText: description.plainText
    },
    specifications: {
      wattage: specs.wattage || 0,
      dimensions: specs.dimensions || 'Unknown',
      weight: specs.weight || 0,
      coverage: specs.coverage || product.specifications?.coverage || null,
      mounting: specs.mounting || 'Wall mounted',
      efficiency: specs.efficiency || product.specifications?.efficiency || 'A+ Energy Rating'
    },
    features: {
      html: features.html,
      plainText: features.plainText
    },
    images: images.map(img => ({
      url: img.url,
      altText: img.altText || img.alt || 'Product image'
    })),
    variants: product.variants.map((variant, index) => ({
      id: `${product.id}-variant-${index}`,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      currency: variant.priceVariants?.[0]?.currency || variant.currency || 'GBP',
      stock: variant.stock || 10,
      isDefault: variant.isDefault || index === 0
    })),
    price: product.variants[0]?.price || 0,
    currency: product.variants[0]?.priceVariants?.[0]?.currency || product.variants[0]?.currency || 'GBP',
    sourceUrl: product.sourceUrl || null,
    extractedAt: product.extractedAt || null,
    warranty: product.components?.warranty?.text || product.information?.warranty || '2 year manufacturer warranty'
  };
}

// Generate sample products if data file not found
function generateSampleProducts() {
  console.log('📝 Generating sample product data...');
  return [
    {
      id: 'sample-panel-heater-600w',
      name: 'Sample 600W Infrared Panel Heater',
      path: '/infrared-heaters/panel-heaters/sample-panel-heater-600w',
      category: 'Panel Heaters',
      sourceUrl: 'https://example.com/sample-heater',
      extractedAt: new Date().toISOString(),
      components: {
        description: {
          content: {
            html: '<p>High-quality 600W infrared panel heater for efficient and comfortable heating. Perfect for small to medium rooms.</p>',
            plainText: 'High-quality 600W infrared panel heater for efficient and comfortable heating. Perfect for small to medium rooms.'
          }
        },
        specifications: {
          chunks: [{
            wattage: 600,
            dimensions: '800mm x 600mm x 20mm',
            weight: 6.5,
            coverage: '12-15m²',
            mounting: 'Wall mounted',
            efficiency: 'A+ Energy Rating'
          }]
        },
        features: {
          content: {
            html: '<ul><li>Energy efficient infrared heating</li><li>Easy wall installation</li><li>Silent operation</li><li>Thermostat compatible</li></ul>',
            plainText: 'Energy efficient infrared heating, Easy wall installation, Silent operation, Thermostat compatible'
          }
        },
        productImages: {
          images: [
            {
              url: 'https://example.com/sample-heater-1.jpg',
              altText: 'Sample 600W Panel Heater - Front View'
            }
          ]
        },
        warranty: {
          text: '5 year manufacturer warranty'
        }
      },
      variants: [{
        name: '600W White',
        sku: 'SAM-600W-WHT',
        price: 299.99,
        priceVariants: [{ currency: 'GBP' }],
        stock: 15,
        isDefault: true
      }, {
        name: '600W Black',
        sku: 'SAM-600W-BLK',
        price: 299.99,
        priceVariants: [{ currency: 'GBP' }],
        stock: 8,
        isDefault: false
      }]
    },
    {
      id: 'sample-panel-heater-900w',
      name: 'Sample 900W Infrared Panel Heater',
      path: '/infrared-heaters/panel-heaters/sample-panel-heater-900w',
      category: 'Panel Heaters',
      sourceUrl: 'https://example.com/sample-heater-900w',
      extractedAt: new Date().toISOString(),
      components: {
        description: {
          content: {
            html: '<p>Powerful 900W infrared panel heater ideal for larger rooms and commercial spaces. Advanced heating technology.</p>',
            plainText: 'Powerful 900W infrared panel heater ideal for larger rooms and commercial spaces. Advanced heating technology.'
          }
        },
        specifications: {
          chunks: [{
            wattage: 900,
            dimensions: '1200mm x 600mm x 20mm',
            weight: 8.5,
            coverage: '18-22m²',
            mounting: 'Wall mounted',
            efficiency: 'A++ Energy Rating'
          }]
        },
        features: {
          content: {
            html: '<ul><li>High efficiency infrared heating</li><li>Commercial grade construction</li><li>Low maintenance</li><li>Smart controls ready</li></ul>',
            plainText: 'High efficiency infrared heating, Commercial grade construction, Low maintenance, Smart controls ready'
          }
        },
        productImages: {
          images: [
            {
              url: 'https://example.com/sample-heater-900w-1.jpg',
              altText: 'Sample 900W Panel Heater - Front View'
            }
          ]
        },
        warranty: {
          text: '7 year manufacturer warranty'
        }
      },
      variants: [{
        name: '900W White',
        sku: 'SAM-900W-WHT',
        price: 449.99,
        priceVariants: [{ currency: 'GBP' }],
        stock: 12,
        isDefault: true
      }]
    }
  ];
}

// Authentication context function
function createAuthContext({ req }) {
  console.log('🔍 Auth check - AUTH_REQUIRED:', AUTH_REQUIRED, 'type:', typeof AUTH_REQUIRED);
  
  // Skip authentication if not required (default is false for local development)
  if (!AUTH_REQUIRED) {
    console.log('🔓 Authentication disabled - access granted');
    return { authenticated: true, user: { role: 'development' } };
  }

  console.log('🔒 Authentication required - checking headers...');
  
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
  // Load product data before starting server
  await loadProductData();
  
  const app = express();
  const httpServer = http.createServer(app);

  console.log('🚀 Starting Apollo Server...');

  // Create Apollo Server with authentication
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    
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

  // Serve static images from scraper downloads
  const imagesPath = path.join(__dirname, '../heatshop-scraper/images');
  app.use('/images', express.static(imagesPath, {
    maxAge: '1d', // Cache images for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Set proper content types for images
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      }
      
      // Add CORS headers for images
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

  // Image metadata endpoint (optional - for debugging)
  app.get('/images-info', (req, res) => {
    try {
      const imagesDir = path.join(__dirname, '../heatshop-scraper/images');
      const imageFiles = fs.readdirSync(imagesDir).filter(file => 
        file.match(/\.(jpg|jpeg|png|webp)$/i)
      );
      
      const imageInfo = imageFiles.map(filename => {
        const filePath = path.join(imagesDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          modified: stats.mtime,
          url: `/images/${filename}`
        };
      });
      
      res.json({
        totalImages: imageFiles.length,
        totalSize: imageInfo.reduce((sum, img) => sum + img.size, 0),
        images: imageInfo.slice(0, 20) // Limit to first 20 for response size
      });
    } catch (error) {
      res.status(500).json({ error: 'Could not read images directory' });
    }
  });

  // Enhanced health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      products: productsData.length,
      timestamp: new Date().toISOString(),
      authentication: AUTH_REQUIRED ? 'enabled' : 'disabled',
      environment: process.env.NODE_ENV || 'development',
      dataSource: productsMetadata.source || 'unknown',
      lastScraped: productsMetadata.scrapedAt || 'unknown'
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: '🔥 Norko GraphQL API - Enhanced with Scraped Data',
      products: productsData.length,
      graphql: '/graphql',
      playground: 'https://studio.apollographql.com/sandbox/explorer',
      customPlayground: '/playground',
      health: '/health',
      authentication: AUTH_REQUIRED ? 'enabled' : 'disabled',
      dataSource: productsMetadata.source || 'unknown',
      lastScraped: productsMetadata.scrapedAt || 'unknown'
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
              .data-info { background: #2a2a2a; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
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
                  <div class="data-info">
                      <strong>Data Source:</strong> ${productsMetadata.source || 'unknown'}<br>
                      <strong>Last Updated:</strong> ${productsMetadata.scrapedAt || 'unknown'}<br>
                      <strong>Products Loaded:</strong> ${productsData.length}
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
                  <button class="example-btn" onclick="loadExample('metadata')">API Metadata</button>
                  <button class="example-btn" onclick="loadExample('products')">Get Products</button>
                  <button class="example-btn" onclick="loadExample('categories')">Get Categories</button>
                  <button class="example-btn" onclick="loadExample('search')">Search Products</button>
                  <button class="example-btn" onclick="loadExample('filter')">Filter by Wattage</button>
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
      dimensions
      efficiency
    }
    warranty
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
                  metadata: \`query {
  metadata {
    scrapedAt
    totalProducts
    source
    categories
  }
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
      efficiency
    }
    warranty
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
}\`,
                  filter: \`query FilterByWattage {
  productsByWattage(minWattage: 500, maxWattage: 1000) {
    name
    specifications {
      wattage
      efficiency
    }
    price
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

  const PORT = process.env.PORT || 4001;
  const HOST = process.env.HOST || '0.0.0.0'; // Railway needs 0.0.0.0 binding
  
  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📊 Loaded ${productsData.length} products from ${productsMetadata.source || 'unknown'}`);
    console.log(`🎮 GraphQL Playground: http://localhost:${PORT}/playground`);
    console.log(`🔐 Authentication: ${AUTH_REQUIRED ? 'ENABLED' : 'DISABLED'}`);
    if (AUTH_REQUIRED) {
      console.log(`🔑 API Key: ${API_KEY ? 'Set' : 'Missing'}`);
      console.log(`🎫 JWT Secret: ${JWT_SECRET ? 'Set' : 'Missing'}`);
    }
    console.log(`📅 Data last scraped: ${productsMetadata.scrapedAt || 'unknown'}`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('💥 Server startup failed:', error);
  process.exit(1);
});
