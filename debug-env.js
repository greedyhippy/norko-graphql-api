// Quick test to verify env vars
console.log('Testing environment variables...');
console.log('AUTH_REQUIRED:', process.env.AUTH_REQUIRED);
console.log('AUTH_REQUIRED type:', typeof process.env.AUTH_REQUIRED);
console.log('AUTH_REQUIRED === "true":', process.env.AUTH_REQUIRED === 'true');
console.log('!AUTH_REQUIRED:', !process.env.AUTH_REQUIRED);

// Set AUTH_REQUIRED to false for testing
process.env.AUTH_REQUIRED = 'false';

console.log('\nAfter setting AUTH_REQUIRED to false:');
console.log('AUTH_REQUIRED:', process.env.AUTH_REQUIRED);
console.log('AUTH_REQUIRED === "true":', process.env.AUTH_REQUIRED === 'true');
console.log('Boolean(AUTH_REQUIRED):', Boolean(process.env.AUTH_REQUIRED));

const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';
console.log('Final AUTH_REQUIRED variable:', AUTH_REQUIRED);

if (!AUTH_REQUIRED) {
  console.log('✅ Authentication should be bypassed');
} else {
  console.log('❌ Authentication will be required');
}
