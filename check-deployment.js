const axios = require('axios');

async function checkDeploymentStatus() {
  console.log('🔍 Checking Deployment Status\n');
  
  const PRODUCTION_URL = 'https://knust-chat-bot-backend.onrender.com';
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Test authentication
    console.log('1️⃣ Testing authentication...');
    const authResponse = await axios.post(`${PRODUCTION_URL}/signin`, {
      email,
      password
    });
    const token = authResponse.data.idToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Authentication working');
    
    // Test existing endpoints
    console.log('\n2️⃣ Testing existing endpoints...');
    
    try {
      const usersResponse = await axios.get(`${PRODUCTION_URL}/api/users`, { headers });
      console.log('✅ GET /api/users - Working');
      console.log(`   Found ${usersResponse.data.users.length} users`);
    } catch (error) {
      console.log('❌ GET /api/users - Failed:', error.response?.status);
    }
    
    try {
      const statsResponse = await axios.get(`${PRODUCTION_URL}/api/dashboard/stats`, { headers });
      console.log('✅ GET /api/dashboard/stats - Working');
    } catch (error) {
      console.log('❌ GET /api/dashboard/stats - Failed:', error.response?.status);
    }
    
    // Test new endpoints
    console.log('\n3️⃣ Testing new endpoints...');
    
    try {
      const fixResponse = await axios.post(`${PRODUCTION_URL}/api/admin/users/fix-data`, {}, { headers });
      console.log('✅ POST /api/admin/users/fix-data - Working');
      console.log(`   Response: ${fixResponse.data.message}`);
    } catch (error) {
      console.log('❌ POST /api/admin/users/fix-data - Failed:', error.response?.status);
    }
    
    try {
      const regResponse = await axios.get(`${PRODUCTION_URL}/api/analytics/user-registrations`, { headers });
      console.log('✅ GET /api/analytics/user-registrations - Working');
    } catch (error) {
      console.log('❌ GET /api/analytics/user-registrations - Failed:', error.response?.status);
    }
    
    try {
      const loginResponse = await axios.get(`${PRODUCTION_URL}/api/analytics/user-logins`, { headers });
      console.log('✅ GET /api/analytics/user-logins - Working');
    } catch (error) {
      console.log('❌ GET /api/analytics/user-logins - Failed:', error.response?.status);
    }
    
    console.log('\n📊 Deployment Status Summary:');
    console.log('   🌐 Server: Running');
    console.log('   🔐 Auth: Working');
    console.log('   📝 New Endpoints: Need verification');
    
  } catch (error) {
    console.error('❌ Deployment check failed:', error.response?.data || error.message);
  }
}

checkDeploymentStatus();
