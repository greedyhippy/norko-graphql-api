// Quick test to see if server starts correctly
const { exec } = require('child_process');

console.log('🧪 Testing Norko GraphQL API Server...');

const serverProcess = exec('node server.js', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Server failed to start:', error);
    return;
  }
  if (stderr) {
    console.error('⚠️ Server stderr:', stderr);
  }
  console.log('📟 Server stdout:', stdout);
});

// Let it run for 5 seconds then kill it
setTimeout(() => {
  console.log('⏹️ Stopping test server...');
  serverProcess.kill();
  console.log('✅ Server test completed');
}, 5000);

serverProcess.stdout.on('data', (data) => {
  console.log('📡 Server output:', data.toString());
});

serverProcess.stderr.on('data', (data) => {
  console.error('🚨 Server error:', data.toString());
});
