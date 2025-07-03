// GraphQL Backend for HeatShop Products - Railway Deployment
// Apollo Server with scraped product data

const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const { gql } = require('apollo-server-express');
const fs = require('fs');
const path = require('path');

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
const typeDefs = gql`
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

// Express Server Setup
async function startServer() {
  const app = express();
  
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    playground: true
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      products: productsData.length,
      timestamp: new Date().toISOString()
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: '🔥 Norko GraphQL API',
      products: productsData.length,
      graphql: '/graphql',
      playground: '/graphql',
      health: '/health'
    });
  });

  const PORT = process.env.PORT || 4000;
  
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📊 Loaded ${productsData.length} products`);
    console.log(`🎮 GraphQL Playground: http://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('💥 Server startup failed:', error);
  process.exit(1);
});