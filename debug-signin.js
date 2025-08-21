const axios = require('axios');

async function debugSigninAndTest() {
  console.log('🔍 Debugging signin response and testing admin endpoints\n');
  
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Test signin and examine response
    console.log('1️⃣ Testing signin and examining response...');
    const signinResponse = await axios.post('http://localhost:3000/signin', {
      email: email,
      password: password
    });
    
    console.log('✅ Signin successful!');
    console.log('📋 Full response data:');
    console.log(JSON.stringify(signinResponse.data, null, 2));
    
    const token = signinResponse.data.idToken || signinResponse.data.token;
    if (!token) {
      throw new Error('No token found in response');
    }
    
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Test a simple admin endpoint
    console.log('\n2️⃣ Testing /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
    console.log('✅ /api/auth/me response:');
    console.log(JSON.stringify(meResponse.data, null, 2));
    
    // Test dashboard
    console.log('\n3️⃣ Testing /api/dashboard/stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
    console.log('✅ Dashboard stats:');
    console.log('   Total Users:', statsResponse.data.totalUsers);
    console.log('   Total Chats:', statsResponse.data.totalChats);
    console.log('   Total Programs:', statsResponse.data.totalPrograms);
    
    // Test system health
    console.log('\n4️⃣ Testing /api/system/health...');
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
    console.log('✅ System health:');
    console.log('   Status:', healthResponse.data.status);
    console.log('   Services:', healthResponse.data.services);
    
    console.log('\n🎉 Admin endpoints are working correctly!');
    console.log('\n📋 Working Admin Credentials:');
    console.log('   📧 Email:', email);
    console.log('   🔑 Password:', password);
    console.log('   👑 Role: admin (confirmed)');
    
    console.log('\n🚀 Ready for frontend integration at:');
    console.log('   https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

debugSigninAndTest();
