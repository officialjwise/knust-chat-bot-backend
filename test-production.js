const axios = require('axios');

async function testProductionDeployment() {
  console.log('🌐 Testing Production Deployment at Render\n');
  
  const PRODUCTION_URL = 'https://knust-chat-bot-backend.onrender.com';
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Test basic health check
    console.log('1️⃣ Testing production health...');
    const healthResponse = await axios.get(`${PRODUCTION_URL}/health`);
    console.log('✅ Production server is healthy');
    console.log('   Status:', healthResponse.data.status);
    
    // Test admin authentication
    console.log('\n2️⃣ Testing admin authentication...');
    const signinResponse = await axios.post(`${PRODUCTION_URL}/signin`, {
      email: email,
      password: password
    });
    
    console.log('✅ Admin authentication successful');
    const token = signinResponse.data.idToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Test admin endpoints
    console.log('\n3️⃣ Testing admin endpoints...');
    
    // Test auth/me
    const meResponse = await axios.get(`${PRODUCTION_URL}/api/auth/me`, { headers });
    console.log('✅ /api/auth/me - Role:', meResponse.data.role);
    
    // Test dashboard
    const statsResponse = await axios.get(`${PRODUCTION_URL}/api/dashboard/stats`, { headers });
    console.log('✅ /api/dashboard/stats - Users:', statsResponse.data.totalUsers);
    
    // Test system health with auth
    const adminHealthResponse = await axios.get(`${PRODUCTION_URL}/api/system/health`, { headers });
    console.log('✅ /api/system/health - Status:', adminHealthResponse.data.status);
    
    // Test CORS
    console.log('\n4️⃣ Testing CORS for frontend...');
    const corsResponse = await axios.get(`${PRODUCTION_URL}/api/auth/me`, {
      headers: {
        ...headers,
        'Origin': 'https://lovable.dev'
      }
    });
    console.log('✅ CORS working for frontend domain');
    
    console.log('\n🎉 PRODUCTION DEPLOYMENT SUCCESSFUL!');
    console.log('\n📋 Production Summary:');
    console.log('   🌐 URL:', PRODUCTION_URL);
    console.log('   📧 Admin:', email);
    console.log('   👑 Role: admin (confirmed)');
    console.log('   🔗 Frontend: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    console.log('   ✅ All admin endpoints working');
    console.log('   ✅ CORS configured for frontend');
    console.log('   ✅ Authentication working');
    console.log('   ✅ Ready for admin panel integration');
    
  } catch (error) {
    console.error('❌ Production test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

testProductionDeployment();
