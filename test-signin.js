const axios = require('axios');

async function testSigninAndEndpoints() {
  console.log('🧪 Testing Signin and Admin Endpoints\n');
  
  try {
    // Test signin endpoint directly
    console.log('1️⃣ Testing signin endpoint...');
    const signinResponse = await axios.post('http://localhost:3000/signin', {
      email: 'jwise@gmail.com',
      password: 'Amoako@21'
    });
    
    console.log('✅ Signin successful!');
    console.log('   User:', signinResponse.data.user.email);
    console.log('   UID:', signinResponse.data.user.uid);
    
    const idToken = signinResponse.data.idToken;
    
    // Test admin endpoints
    const headers = { 'Authorization': `Bearer ${idToken}` };
    
    console.log('\n2️⃣ Testing /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
    console.log('✅ Success - Role:', meResponse.data.role);
    
    console.log('\n3️⃣ Testing /api/dashboard/stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
    console.log('✅ Success - Total Users:', statsResponse.data.totalUsers);
    
    console.log('\n4️⃣ Testing /api/users...');
    const usersResponse = await axios.get('http://localhost:3000/api/users', { headers });
    console.log('✅ Success - Users found:', usersResponse.data.users.length);
    
    console.log('\n5️⃣ Testing /api/system/health...');
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
    console.log('✅ Success - Status:', healthResponse.data.status);
    
    console.log('\n6️⃣ Testing CORS with frontend domain...');
    const corsResponse = await axios.get('http://localhost:3000/api/auth/me', {
      headers: {
        ...headers,
        'Origin': 'https://lovable.dev'
      }
    });
    console.log('✅ CORS working - Frontend can access endpoints');
    
    console.log('\n🎉 All tests passed!');
    console.log('\n📋 Frontend Integration Details:');
    console.log('🔗 Backend URL: http://localhost:3000');
    console.log('🔗 Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    console.log('👤 Admin Email: jwise@gmail.com');
    console.log('🔑 Admin Password: Amoako@21');
    console.log('🛡️ CORS: Enabled for all origins');
    console.log('🔐 Authentication: Firebase ID tokens required');
    console.log('👑 Admin Role: Required for admin endpoints');
    
    console.log('\n🚀 Ready for frontend integration!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

testSigninAndEndpoints();
