#!/usr/bin/env node

/**
 * Pre-deployment validation script for Railway
 * Checks all requirements and configurations before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Railway Deployment Pre-Check');
console.log('================================');

let hasErrors = false;
let hasWarnings = false;

// 1. Check required files
const requiredFiles = [
  'package.json',
  'server.js',
  'railway.json',
  '../heatshop-scraper/crystallize-products.json'
];

console.log('\n📁 Checking required files...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    hasErrors = true;
  }
});

// 2. Check package.json scripts
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log(`  ✅ Start script: ${packageJson.scripts.start}`);
  } else {
    console.log('  ❌ Missing start script');
    hasErrors = true;
  }
  
  if (packageJson.engines && packageJson.engines.node) {
    console.log(`  ✅ Node version specified: ${packageJson.engines.node}`);
  } else {
    console.log('  ⚠️  Node version not specified in engines');
    hasWarnings = true;
  }
  
  const requiredDeps = ['@apollo/server', 'express', 'graphql'];
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`  ❌ Missing dependency: ${dep}`);
      hasErrors = true;
    }
  });
  
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
  hasErrors = true;
}

// 3. Check data file
console.log('\n🗄️  Checking product data...');
try {
  const dataPath = path.join(__dirname, '../heatshop-scraper/crystallize-products.json');
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      console.log(`  ✅ ${data.products.length} products loaded`);
      console.log(`  ✅ Data source: ${data.metadata?.source || 'unknown'}`);
      console.log(`  ✅ Last scraped: ${data.metadata?.scrapedAt || 'unknown'}`);
    } else {
      console.log('  ⚠️  No products found in data file');
      hasWarnings = true;
    }
  } else {
    console.log('  ❌ Product data file not found');
    hasErrors = true;
  }
} catch (error) {
  console.log(`  ❌ Error reading product data: ${error.message}`);
  hasErrors = true;
}

// 4. Environment variables check
console.log('\n🔧 Environment variables (Railway setup required):');
const envVars = [
  { name: 'NODE_ENV', required: false, note: 'Set to "production" in Railway' },
  { name: 'PORT', required: false, note: 'Automatically set by Railway' },
  { name: 'API_KEY', required: true, note: 'Set your secure API key' },
  { name: 'JWT_SECRET', required: true, note: 'Set 32+ character secret' },
  { name: 'AUTH_REQUIRED', required: false, note: 'Set to "true" for production' },
  { name: 'CORS_ORIGIN', required: false, note: 'Set to your frontend domain' }
];

envVars.forEach(envVar => {
  const value = process.env[envVar.name];
  if (value) {
    if (envVar.name === 'JWT_SECRET' && value.length < 32) {
      console.log(`  ⚠️  ${envVar.name}: TOO SHORT (needs 32+ chars)`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${envVar.name}: Set`);
    }
  } else {
    if (envVar.required) {
      console.log(`  ❌ ${envVar.name}: MISSING - ${envVar.note}`);
      hasErrors = true;
    } else {
      console.log(`  ⚠️  ${envVar.name}: Not set - ${envVar.note}`);
      hasWarnings = true;
    }
  }
});

// 5. Railway configuration check
console.log('\n🚂 Railway configuration...');
try {
  const railwayConfig = JSON.parse(fs.readFileSync('railway.json', 'utf8'));
  console.log('  ✅ railway.json exists and is valid');
  console.log(`  ✅ Restart policy: ${railwayConfig.deploy?.restartPolicyType || 'default'}`);
  console.log(`  ✅ Sleep disabled: ${railwayConfig.deploy?.sleepApplication === false ? 'yes' : 'no'}`);
} catch (error) {
  console.log(`  ❌ Railway config error: ${error.message}`);
  hasErrors = true;
}

// 6. Server syntax check
console.log('\n🔍 Server syntax check...');
try {
  require('./server.js');
  console.log('  ❌ Server should not start during validation');
  hasErrors = true;
} catch (error) {
  if (error.message.includes('listen EADDRINUSE')) {
    console.log('  ✅ Server syntax OK (port conflict expected)');
  } else {
    console.log(`  ❌ Server syntax error: ${error.message}`);
    hasErrors = true;
  }
}

// Summary
console.log('\n📊 DEPLOYMENT READINESS SUMMARY');
console.log('================================');

if (hasErrors) {
  console.log('❌ DEPLOYMENT NOT READY - Fix errors before deploying');
  console.log('\n🔧 Required actions:');
  console.log('   1. Fix all ❌ errors listed above');
  console.log('   2. Set environment variables in Railway dashboard');
  console.log('   3. Re-run this check');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  DEPLOYMENT READY WITH WARNINGS');
  console.log('\n🔧 Recommended actions:');
  console.log('   1. Review ⚠️  warnings above');
  console.log('   2. Set environment variables in Railway dashboard');
  console.log('   3. Deploy when ready');
  process.exit(0);
} else {
  console.log('✅ FULLY READY FOR DEPLOYMENT');
  console.log('\n🚀 Next steps:');
  console.log('   1. Set environment variables in Railway dashboard');
  console.log('   2. Connect your Git repository to Railway');
  console.log('   3. Deploy!');
  process.exit(0);
}
