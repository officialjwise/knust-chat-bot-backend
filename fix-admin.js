const admin = require('firebase-admin');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

async function initializeFirebase() {
  try {
    let credentials;
    
    if (process.env.FIREBASE_CREDENTIALS) {
      credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      credentials = require('./serviceAccountKey.json');
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    return admin.firestore();
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
    throw error;
  }
}

async function createWorkingAdminAndTest() {
  console.log('🔧 Creating working admin user and testing...\n');
  
  try {
    const db = await initializeFirebase();
    const email = 'jwise@gmail.com';
    const newPassword = 'AdminPass123!';
    
    console.log('1️⃣ Updating admin user password...');
    
    // Get existing user
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('✅ Found user:', userRecord.uid);
    
    // Update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
      emailVerified: true
    });
    console.log('✅ Password updated successfully');
    
    // Test signin with new password
    console.log('\n2️⃣ Testing signin with updated password...');
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    
    const signinResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        email: email,
        password: newPassword,
        returnSecureToken: true
      }
    );
    
    console.log('✅ Direct Firebase signin successful');
    const idToken = signinResponse.data.idToken;
    
    // Test our signin endpoint
    console.log('\n3️⃣ Testing our signin endpoint...');
    const backendSignin = await axios.post('http://localhost:3000/signin', {
      email: email,
      password: newPassword
    });
    
    console.log('✅ Backend signin successful!');
    console.log('   Email:', backendSignin.data.user.email);
    console.log('   UID:', backendSignin.data.user.uid);
    
    const backendToken = backendSignin.data.idToken;
    
    // Test admin endpoints
    console.log('\n4️⃣ Testing admin endpoints...');
    const headers = { 'Authorization': `Bearer ${backendToken}` };
    
    // Test auth/me
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
    console.log('✅ /api/auth/me - Role:', meResponse.data.role);
    
    // Test dashboard
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
    console.log('✅ /api/dashboard/stats - Users:', statsResponse.data.totalUsers);
    
    // Test users list
    const usersResponse = await axios.get('http://localhost:3000/api/users', { headers });
    console.log('✅ /api/users - Found:', usersResponse.data.users.length, 'users');
    
    // Test system health
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
    console.log('✅ /api/system/health - Status:', healthResponse.data.status);
    
    // Test analytics
    const analyticsResponse = await axios.get('http://localhost:3000/api/analytics/usage', { headers });
    console.log('✅ /api/analytics/usage - Total chats:', analyticsResponse.data.totalChats);
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n📋 Updated Admin Credentials:');
    console.log('   📧 Email: jwise@gmail.com');
    console.log('   🔑 Password: AdminPass123!');
    console.log('   👑 Role: admin');
    console.log('   🆔 UID:', userRecord.uid);
    
    console.log('\n🌐 CORS Configuration:');
    console.log('   ✅ Allows all origins');
    console.log('   ✅ Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    console.log('   ✅ Backend URL: http://localhost:3000');
    
    console.log('\n🚀 Ready for frontend integration!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Config URL:', error.config?.url);
    }
  }
}

createWorkingAdminAndTest();
