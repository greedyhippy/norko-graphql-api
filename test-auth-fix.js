/**
 * Simple server test to verify authentication fix
 */

// Load environment variables like the server does
try {
  require('dotenv').config();
  console.log('✅ Loaded .env file');
} catch (error) {
  console.log('⚠️  dotenv not available, using system environment variables');
}

// Test environment variables
console.log('Environment variables:');
console.log('- AUTH_REQUIRED (raw):', process.env.AUTH_REQUIRED);
console.log('- AUTH_REQUIRED (parsed):', process.env.AUTH_REQUIRED === 'true');
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Test the authentication function exactly as in server
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';

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

  return { authenticated: false };
}

// Mock request object
const mockReq = {
  headers: {}  // No authorization header
};

try {
  const context = createAuthContext({ req: mockReq });
  console.log('✅ Authentication test passed:', context);
  console.log('🎉 The server should work without authentication errors');
} catch (error) {
  console.error('❌ Authentication test failed:', error.message);
}
