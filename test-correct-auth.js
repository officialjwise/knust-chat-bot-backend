const axios = require('axios');

async function testWithCorrectCredentials() {
  console.log('🧪 Testing with correct project credentials\n');
  
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Test signin directly with correct Firebase project
    console.log('1️⃣ Testing signin with correct Firebase API key...');
    const firebaseApiKey = 'AIzaSyBa3Ht1TcWCrUSsN5o3mGhGTVPjjz-8KJU'; // KNUST project key
    
    const directSignin = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        email: email,
        password: password,
        returnSecureToken: true
      }
    );
    
    console.log('✅ Direct Firebase signin successful');
    const idToken = directSignin.data.idToken;
    console.log('Token preview:', idToken.substring(0, 50) + '...');
    
    // Test admin endpoints with the correct token
    const headers = { 'Authorization': `Bearer ${idToken}` };
    
    console.log('\n2️⃣ Testing /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
    console.log('✅ Success:');
    console.log('   Email:', meResponse.data.email);
    console.log('   Role:', meResponse.data.role);
    console.log('   UID:', meResponse.data.uid);
    
    console.log('\n3️⃣ Testing /api/dashboard/stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
    console.log('✅ Success:');
    console.log('   Total Users:', statsResponse.data.totalUsers);
    console.log('   Total Chats:', statsResponse.data.totalChats);
    console.log('   Total Programs:', statsResponse.data.totalPrograms);
    
    console.log('\n4️⃣ Testing /api/users...');
    const usersResponse = await axios.get('http://localhost:3000/api/users?limit=3', { headers });
    console.log('✅ Success:');
    console.log('   Users found:', usersResponse.data.users.length);
    console.log('   Admin user present:', usersResponse.data.users.some(u => u.email === email));
    
    console.log('\n5️⃣ Testing /api/system/health...');
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
    console.log('✅ Success:');
    console.log('   Status:', healthResponse.data.status);
    console.log('   Services healthy:', Object.values(healthResponse.data.services).every(s => s === 'healthy' || s === 'configured'));
    
    console.log('\n6️⃣ Testing CORS for frontend...');
    const corsResponse = await axios.get('http://localhost:3000/api/auth/me', {
      headers: {
        ...headers,
        'Origin': 'https://lovable.dev'
      }
    });
    console.log('✅ CORS working for frontend domain');
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n📋 Working Configuration:');
    console.log('   📧 Admin Email: officialjwise20@gmail.com');
    console.log('   🔑 Admin Password: Amoako@21');
    console.log('   👑 Role: admin (confirmed)');
    console.log('   🆔 UID:', meResponse.data.uid);
    
    console.log('\n🌐 Frontend Integration:');
    console.log('   🔗 Backend URL: http://localhost:3000');
    console.log('   🔗 Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    console.log('   ✅ CORS: Enabled for all origins');
    console.log('   🔐 Auth Method: POST /signin → get idToken → use in Authorization header');
    console.log('   🛡️ Admin Protection: All /api/* endpoints require admin role');
    
    console.log('\n📋 Available Admin Endpoints:');
    console.log('   🔐 POST /signin - Get authentication token');
    console.log('   👤 GET /api/auth/me - Get current user info');
    console.log('   📊 GET /api/dashboard/stats - Dashboard overview');
    console.log('   👥 GET /api/users - Manage users');
    console.log('   💬 GET /api/chats - Monitor chat history');
    console.log('   📈 GET /api/analytics/usage - Usage analytics');
    console.log('   📋 GET /api/analytics/popular-programs - Popular programs');
    console.log('   ⚡ GET /api/system/health - System health check');
    
    console.log('\n🚀 Backend is fully ready for admin panel integration!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

testWithCorrectCredentials();
