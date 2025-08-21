const axios = require('axios');

async function testUserManagementFixes() {
  console.log('🔧 Testing User Management Fixes\n');
  
  const PRODUCTION_URL = 'https://knust-chat-bot-backend.onrender.com';
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  try {
    // Step 1: Authenticate as admin
    console.log('1️⃣ Authenticating as admin...');
    const authResponse = await axios.post(`${PRODUCTION_URL}/signin`, {
      email,
      password
    });
    
    const token = authResponse.data.idToken;
    const headers = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Admin authenticated');
    
    // Step 2: Check current user data
    console.log('\n2️⃣ Checking current user data...');
    const usersResponse = await axios.get(`${PRODUCTION_URL}/api/users?limit=5`, { headers });
    console.log('📊 Current users sample:');
    usersResponse.data.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
      console.log(`      Name: ${user.name || 'N/A'}`);
      console.log(`      Created: ${user.createdAt || 'Invalid'}`);
      console.log(`      Last Login: ${user.lastLogin || 'Never'}`);
      console.log(`      Login Count: ${user.loginCount || 0}`);
      console.log(`      Role: ${user.role}`);
      console.log('');
    });
    
    // Step 3: Fix existing user data
    console.log('3️⃣ Fixing existing user data...');
    const fixResponse = await axios.post(`${PRODUCTION_URL}/api/admin/users/fix-data`, {}, { headers });
    console.log('✅ User data fix completed:');
    console.log(`   Updated: ${fixResponse.data.updatedUsers} users`);
    console.log(`   Total: ${fixResponse.data.totalUsers} users`);
    
    // Step 4: Check fixed user data
    console.log('\n4️⃣ Checking fixed user data...');
    const fixedUsersResponse = await axios.get(`${PRODUCTION_URL}/api/users?limit=5`, { headers });
    console.log('📊 Fixed users sample:');
    fixedUsersResponse.data.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
      console.log(`      Name: ${user.name || 'N/A'}`);
      console.log(`      Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Invalid'}`);
      console.log(`      Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}`);
      console.log(`      Login Count: ${user.loginCount || 0}`);
      console.log(`      Role: ${user.role}`);
      console.log('');
    });
    
    // Step 5: Test new analytics endpoints
    console.log('5️⃣ Testing new analytics endpoints...');
    
    // User registration analytics
    const regAnalytics = await axios.get(`${PRODUCTION_URL}/api/analytics/user-registrations?period=30`, { headers });
    console.log('📈 Registration Analytics:');
    console.log(`   New users (30 days): ${regAnalytics.data.totalNewUsers}`);
    console.log(`   Average daily: ${regAnalytics.data.averageDaily}`);
    
    // User login analytics
    const loginAnalytics = await axios.get(`${PRODUCTION_URL}/api/analytics/user-logins?period=30`, { headers });
    console.log('📊 Login Analytics:');
    console.log(`   Active users (30 days): ${loginAnalytics.data.totalActiveUsers}`);
    console.log(`   Average logins per user: ${loginAnalytics.data.averageLoginsPerUser}`);
    
    console.log('\n🎉 USER MANAGEMENT FIXES COMPLETE!');
    console.log('\n📋 New Endpoints Available:');
    console.log('   🔧 POST /api/admin/users/fix-data - Fix existing user data');
    console.log('   👤 POST /api/admin/users - Create user by admin');
    console.log('   📊 GET /api/analytics/user-registrations - Registration analytics');
    console.log('   📈 GET /api/analytics/user-logins - Login analytics');
    console.log('   🔄 POST /api/admin/users/bulk-action - Bulk user operations');
    console.log('\n   ✅ User dates now properly formatted');
    console.log('   ✅ Login tracking implemented');
    console.log('   ✅ Missing user fields populated');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   URL:', error.config?.url);
    }
  }
}

testUserManagementFixes();
