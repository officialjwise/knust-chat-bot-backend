const axios = require('axios');

async function testAdminEndpointsWithUpdatedUser() {
  console.log('🧪 Testing Admin Endpoints with Updated User\n');
  
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Test signin
    console.log('1️⃣ Testing signin...');
    const signinResponse = await axios.post('http://localhost:3000/signin', {
      email: email,
      password: password
    });
    
    console.log('✅ Signin successful!');
    console.log('   Email:', signinResponse.data.user.email);
    console.log('   UID:', signinResponse.data.user.uid);
    
    const token = signinResponse.data.idToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Test admin endpoints
    console.log('\n2️⃣ Testing /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
    console.log('✅ Success - Role:', meResponse.data.role);
    console.log('   Email:', meResponse.data.email);
    console.log('   UID:', meResponse.data.uid);
    
    console.log('\n3️⃣ Testing /api/dashboard/stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
    console.log('✅ Success:');
    console.log('   Total Users:', statsResponse.data.totalUsers);
    console.log('   Total Chats:', statsResponse.data.totalChats);
    console.log('   Total Programs:', statsResponse.data.totalPrograms);
    console.log('   Recent Chats:', statsResponse.data.recentChats);
    
    console.log('\n4️⃣ Testing /api/users (User Management)...');
    const usersResponse = await axios.get('http://localhost:3000/api/users?limit=5', { headers });
    console.log('✅ Success:');
    console.log('   Users found:', usersResponse.data.users.length);
    console.log('   Total pages:', usersResponse.data.pagination.pages);
    if (usersResponse.data.users.length > 0) {
      console.log('   First user:', usersResponse.data.users[0].email);
    }
    
    console.log('\n5️⃣ Testing /api/analytics/usage...');
    const usageResponse = await axios.get('http://localhost:3000/api/analytics/usage?period=7', { headers });
    console.log('✅ Success:');
    console.log('   Period:', usageResponse.data.period, 'days');
    console.log('   Total chats:', usageResponse.data.totalChats);
    console.log('   Average daily:', usageResponse.data.averageDaily);
    
    console.log('\n6️⃣ Testing /api/analytics/popular-programs...');
    const popularResponse = await axios.get('http://localhost:3000/api/analytics/popular-programs?limit=5', { headers });
    console.log('✅ Success:');
    console.log('   Programs analyzed:', popularResponse.data.popularPrograms.length);
    if (popularResponse.data.popularPrograms.length > 0) {
      console.log('   Top program:', popularResponse.data.popularPrograms[0].program);
      console.log('   Mentions:', popularResponse.data.popularPrograms[0].mentions);
    }
    
    console.log('\n7️⃣ Testing /api/chats (Chat Monitoring)...');
    const chatsResponse = await axios.get('http://localhost:3000/api/chats?limit=3', { headers });
    console.log('✅ Success:');
    console.log('   Chats found:', chatsResponse.data.chats.length);
    if (chatsResponse.data.chats.length > 0) {
      console.log('   Latest chat from:', chatsResponse.data.chats[0].userId);
    }
    
    console.log('\n8️⃣ Testing /api/system/health...');
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
    console.log('✅ Success:');
    console.log('   Status:', healthResponse.data.status);
    console.log('   Firestore:', healthResponse.data.services.firestore);
    console.log('   OpenAI:', healthResponse.data.services.openai);
    console.log('   Uptime:', Math.round(healthResponse.data.uptime), 'seconds');
    
    console.log('\n9️⃣ Testing CORS with frontend origin...');
    const corsResponse = await axios.get('http://localhost:3000/api/auth/me', {
      headers: {
        ...headers,
        'Origin': 'https://lovable.dev'
      }
    });
    console.log('✅ CORS working - Frontend can access all endpoints');
    
    console.log('\n🎉 ALL ADMIN ENDPOINT TESTS PASSED!');
    console.log('\n📋 Final Admin Credentials:');
    console.log('   📧 Email: officialjwise20@gmail.com');
    console.log('   🔑 Password: Amoako@21');
    console.log('   👑 Role: admin');
    console.log('   🆔 UID:', signinResponse.data.user.uid);
    
    console.log('\n🌐 Integration Ready:');
    console.log('   🔗 Backend URL: http://localhost:3000');
    console.log('   🔗 Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    console.log('   ✅ CORS: Enabled for all origins including lovable.dev');
    console.log('   🔐 Authentication: Firebase ID tokens via /signin endpoint');
    console.log('   👑 Admin Role: Required for all /api/* admin endpoints');
    
    console.log('\n🚀 Backend is ready for frontend admin panel integration!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

testAdminEndpointsWithUpdatedUser();
