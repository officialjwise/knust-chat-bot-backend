const admin = require('firebase-admin');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Firebase configuration
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBa3Ht1TcWCrUSsN5o3mGhGTVPjjz-8KJU';
const SERVER_URL = 'http://localhost:3000';

async function seedAdminUser() {
  try {
    console.log('🚀 Creating admin user...');
    
    // Create user with Firebase Admin SDK
    const userRecord = await admin.auth().createUser({
      email: 'jwise@gmail.com',
      password: 'Amoako@21',
      emailVerified: true,
      disabled: false,
    });
    
    console.log('✅ User created in Firebase Auth:', userRecord.uid);
    
    // Add user to Firestore with admin role
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: 'jwise@gmail.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Admin user created in Firestore with admin role');
    return userRecord.uid;
    
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️  User already exists, updating role to admin...');
      
      // Get existing user
      const userRecord = await admin.auth().getUserByEmail('jwise@gmail.com');
      
      // Update user role in Firestore
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        email: 'jwise@gmail.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log('✅ User role updated to admin');
      return userRecord.uid;
    } else {
      console.error('❌ Error creating admin user:', error);
      throw error;
    }
  }
}

async function loginAndGetToken() {
  try {
    console.log('🔐 Logging in admin user...');
    
    // Sign in using Firebase REST API
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email: 'jwise@gmail.com',
        password: 'Amoako@21',
        returnSecureToken: true
      }
    );
    
    const idToken = response.data.idToken;
    console.log('✅ Login successful, token obtained');
    return idToken;
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testAdminEndpoints(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log('🧪 Testing admin endpoints...');
  
  try {
    // Test /api/auth/me
    console.log('Testing GET /api/auth/me...');
    const meResponse = await axios.get(`${SERVER_URL}/api/auth/me`, { headers });
    console.log('✅ /api/auth/me:', meResponse.data);
    
    // Test /api/dashboard/stats
    console.log('Testing GET /api/dashboard/stats...');
    const statsResponse = await axios.get(`${SERVER_URL}/api/dashboard/stats`, { headers });
    console.log('✅ /api/dashboard/stats:', statsResponse.data);
    
    // Test /api/users
    console.log('Testing GET /api/users...');
    const usersResponse = await axios.get(`${SERVER_URL}/api/users?limit=5`, { headers });
    console.log('✅ /api/users:', usersResponse.data);
    
    // Test /api/chats
    console.log('Testing GET /api/chats...');
    const chatsResponse = await axios.get(`${SERVER_URL}/api/chats?limit=5`, { headers });
    console.log('✅ /api/chats:', chatsResponse.data);
    
    // Test /api/system/health
    console.log('Testing GET /api/system/health...');
    const healthResponse = await axios.get(`${SERVER_URL}/api/system/health`, { headers });
    console.log('✅ /api/system/health:', healthResponse.data);
    
    // Test /api/analytics/popular-programs
    console.log('Testing GET /api/analytics/popular-programs...');
    const programsResponse = await axios.get(`${SERVER_URL}/api/analytics/popular-programs?limit=3`, { headers });
    console.log('✅ /api/analytics/popular-programs:', programsResponse.data);
    
    console.log('🎉 All admin endpoints tested successfully!');
    
  } catch (error) {
    console.error('❌ Admin endpoint test failed:', {
      endpoint: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

async function main() {
  try {
    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      console.log('🔧 Initializing Firebase Admin...');
      
      // Try to get credentials from environment or file
      let credentials;
      if (process.env.FIREBASE_CREDENTIALS) {
        credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
      } else {
        try {
          credentials = require('./firebase-service-account.json');
        } catch (e) {
          console.error('❌ No Firebase credentials found. Please set FIREBASE_CREDENTIALS environment variable or provide firebase-service-account.json');
          process.exit(1);
        }
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: `https://${credentials.project_id}-default-rtdb.firebaseio.com`
      });
      
      console.log('✅ Firebase Admin initialized');
    }
    
    // Seed admin user
    const adminUid = await seedAdminUser();
    
    // Login and get token
    const token = await loginAndGetToken();
    
    // Test admin endpoints
    await testAdminEndpoints(token);
    
    console.log('🏁 Admin setup and testing completed successfully!');
    console.log(`📧 Admin Email: jwise@gmail.com`);
    console.log(`🔑 Admin Password: Amoako@21`);
    console.log(`🆔 Admin UID: ${adminUid}`);
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { seedAdminUser, loginAndGetToken, testAdminEndpoints };
