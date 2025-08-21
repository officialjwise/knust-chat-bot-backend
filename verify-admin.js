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

async function testAdminUserAndEndpoints() {
  console.log('🔍 Verifying admin user and testing endpoints...\n');
  
  try {
    const db = await initializeFirebase();
    const email = 'jwise@gmail.com';
    
    // Check if user exists in Firebase Auth
    console.log('1️⃣ Checking Firebase Auth user...');
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('✅ User found in Firebase Auth:');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);
    console.log('   Email Verified:', userRecord.emailVerified);
    
    // Check user document in Firestore
    console.log('\n2️⃣ Checking Firestore user document...');
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ User document found in Firestore:');
      console.log('   Role:', userData.role);
      console.log('   Name:', userData.name);
      console.log('   Active:', userData.isActive);
    } else {
      console.log('❌ User document not found in Firestore');
    }
    
    // Create a custom token for testing
    console.log('\n3️⃣ Creating custom token for testing...');
    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    console.log('✅ Custom token created');
    
    // Exchange custom token for ID token using Firebase REST API
    console.log('\n4️⃣ Exchanging custom token for ID token...');
    const firebaseApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyBa3Ht1TcWCrUSsN5o3mGhGTVPjjz-8KJU';
    
    const tokenResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );
    
    const idToken = tokenResponse.data.idToken;
    console.log('✅ ID token obtained');
    
    // Test admin endpoints with the ID token
    console.log('\n5️⃣ Testing admin endpoints...');
    
    // Test /api/auth/me
    console.log('Testing /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3000/api/auth/me', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    console.log('✅ /api/auth/me successful:');
    console.log('   Email:', meResponse.data.email);
    console.log('   Role:', meResponse.data.role);
    
    // Test dashboard stats
    console.log('\nTesting /api/dashboard/stats...');
    const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    console.log('✅ /api/dashboard/stats successful:');
    console.log('   Total Users:', statsResponse.data.totalUsers);
    console.log('   Total Programs:', statsResponse.data.totalPrograms);
    
    // Test users list
    console.log('\nTesting /api/users...');
    const usersResponse = await axios.get('http://localhost:3000/api/users', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    console.log('✅ /api/users successful:');
    console.log('   Users found:', usersResponse.data.users.length);
    
    // Test system health
    console.log('\nTesting /api/system/health...');
    const healthResponse = await axios.get('http://localhost:3000/api/system/health', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    console.log('✅ /api/system/health successful:');
    console.log('   Status:', healthResponse.data.status);
    
    console.log('\n🎉 All tests passed! Admin endpoints are working correctly.');
    console.log('\n📋 For frontend integration:');
    console.log('   Email: jwise@gmail.com');
    console.log('   Password: Amoako@21');
    console.log('   Role: admin');
    console.log('   Base URL: http://localhost:3000');
    console.log('   Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
    }
  }
}

testAdminUserAndEndpoints();
