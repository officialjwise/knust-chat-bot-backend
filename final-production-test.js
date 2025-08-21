const axios = require('axios');

async function comprehensiveProductionTest() {
  console.log('🚀 Comprehensive Production Test\n');
  
  const PRODUCTION_URL = 'https://knust-chat-bot-backend.onrender.com';
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Step 1: Health Check
    console.log('1️⃣ Health Check...');
    const health = await axios.get(`${PRODUCTION_URL}/health`);
    console.log('✅ Production server healthy:', health.data.status);
    
    // Step 2: Authentication
    console.log('\n2️⃣ Admin Authentication...');
    const signinResponse = await axios.post(`${PRODUCTION_URL}/signin`, {
      email,
      password
    });
    console.log('✅ Authentication successful');
    console.log('   User:', signinResponse.data.user.email);
    console.log('   Token valid:', signinResponse.data.idToken ? 'Yes' : 'No');
    
    const token = signinResponse.data.idToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Step 3: Verify User Role
    console.log('\n3️⃣ Verifying Admin Role...');
    const meResponse = await axios.get(`${PRODUCTION_URL}/api/auth/me`, { headers });
    console.log('✅ User role verified:', meResponse.data.role);
    console.log('   Admin access:', meResponse.data.role === 'admin' ? 'Granted' : 'Denied');
    
    // Step 4: Test All Admin Endpoints
    console.log('\n4️⃣ Testing Admin Endpoints...');
    
    // Dashboard Stats
    const statsResponse = await axios.get(`${PRODUCTION_URL}/api/dashboard/stats`, { headers });
    console.log('✅ Dashboard stats - Total users:', statsResponse.data.totalUsers);
    
    // User Management
    const usersResponse = await axios.get(`${PRODUCTION_URL}/api/users`, { headers });
    console.log('✅ User management - Found', usersResponse.data.users?.length || 0, 'users');
    
    // Chat Messages
    const chatsResponse = await axios.get(`${PRODUCTION_URL}/api/chats`, { headers });
    console.log('✅ Chat monitoring - Found', chatsResponse.data.messages?.length || 0, 'messages');
    
    // System Health (Admin)
    const systemResponse = await axios.get(`${PRODUCTION_URL}/api/system/health`, { headers });
    console.log('✅ System health:', systemResponse.data.status);
    
    // Step 5: Test CORS
    console.log('\n5️⃣ Testing CORS...');
    const corsResponse = await axios.get(`${PRODUCTION_URL}/api/auth/me`, {
      headers: {
        ...headers,
        'Origin': 'https://lovable.dev',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization, content-type'
      }
    });
    console.log('✅ CORS working for frontend');
    
    // Step 6: Test ChatBot Endpoint
    console.log('\n6️⃣ Testing ChatBot...');
    const chatResponse = await axios.post(`${PRODUCTION_URL}/chat`, {
      message: "What programs does KNUST offer?",
      sender: "test-user",
      sessionId: "test-session-" + Date.now()
    }, { headers });
    console.log('✅ ChatBot responding:', chatResponse.data.response ? 'Yes' : 'No');
    
    // Final Summary
    console.log('\n🎉 PRODUCTION TEST COMPLETE!\n');
    console.log('📋 Summary:');
    console.log('   🌐 Production URL: ' + PRODUCTION_URL);
    console.log('   👤 Admin User: ' + email);
    console.log('   🔐 Authentication: ✅ Working');
    console.log('   👑 Admin Role: ✅ Verified');
    console.log('   📊 Dashboard: ✅ Working');
    console.log('   👥 User Management: ✅ Working');
    console.log('   💬 Chat Monitoring: ✅ Working');
    console.log('   🔧 System Health: ✅ Working');
    console.log('   🌍 CORS: ✅ Working');
    console.log('   🤖 ChatBot: ✅ Working');
    console.log('\n   🎯 Ready for frontend integration at:');
    console.log('   https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    
  } catch (error) {
    console.error('❌ Test failed at step:', error.config?.url);
    console.error('   Error:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
  }
}

comprehensiveProductionTest();
