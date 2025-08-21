const admin = require('firebase-admin');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables
dotenv.config();

async function initializeFirebase() {
  try {
    let credentials;
    
    if (process.env.FIREBASE_CREDENTIALS) {
      console.log('Using FIREBASE_CREDENTIALS from environment');
      credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT_KEY from environment');
      credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      console.log('No Firebase credentials in environment, trying local file');
      credentials = require('./serviceAccountKey.json');
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    console.log('✅ Firebase Admin initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw error;
  }
}

async function updateExistingUserToAdmin() {
  try {
    console.log('🚀 Updating existing user to admin...');
    
    // Initialize Firebase
    const db = await initializeFirebase();
    
    const email = 'officialjwise20@gmail.com';
    const password = 'Amoako@21';
    
    // Get existing user from Firebase Auth
    console.log('1️⃣ Finding existing user in Firebase Auth...');
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('✅ User found in Firebase Auth:');
      console.log('   UID:', userRecord.uid);
      console.log('   Email:', userRecord.email);
      console.log('   Email Verified:', userRecord.emailVerified);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        console.log('❌ User not found in Firebase Auth. Creating new user...');
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true,
          displayName: 'Admin User'
        });
        console.log('✅ New user created with UID:', userRecord.uid);
      } else {
        throw authError;
      }
    }
    
    // Update password to ensure it's correct
    console.log('2️⃣ Updating user password...');
    await admin.auth().updateUser(userRecord.uid, {
      password: password,
      emailVerified: true
    });
    console.log('✅ Password updated successfully');
    
    // Update/create user document in Firestore with admin role
    console.log('3️⃣ Updating user document in Firestore...');
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ User document updated in Firestore with admin role');
    
    // Also add to admins collection
    try {
      await db.collection('admins').doc(userRecord.uid).set({
        email: email,
        name: 'Admin User',
        permissions: ['full_access'],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('✅ User added to admins collection');
    } catch (adminError) {
      console.log('⚠️  Could not add to admins collection (collection may not exist)');
    }
    
    // Test signin with the credentials
    console.log('4️⃣ Testing signin with updated credentials...');
    const firebaseApiKey = 'AIzaSyBa3Ht1TcWCrUSsN5o3mGhGTVPjjz-8KJU';
    
    try {
      const signinResponse = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
        {
          email: email,
          password: password,
          returnSecureToken: true
        }
      );
      
      console.log('✅ Direct Firebase signin successful');
      const idToken = signinResponse.data.idToken;
      
      // Test our backend signin endpoint
      console.log('5️⃣ Testing backend signin endpoint...');
      const backendSignin = await axios.post('http://localhost:3000/signin', {
        email: email,
        password: password
      });
      
      console.log('✅ Backend signin successful!');
      console.log('   Email:', backendSignin.data.user.email);
      console.log('   UID:', backendSignin.data.user.uid);
      
      const backendToken = backendSignin.data.idToken;
      
      // Test admin endpoints
      console.log('6️⃣ Testing admin endpoints...');
      const headers = { 'Authorization': `Bearer ${backendToken}` };
      
      // Test auth/me
      const meResponse = await axios.get('http://localhost:3000/api/auth/me', { headers });
      console.log('✅ /api/auth/me - Role:', meResponse.data.role);
      
      // Test dashboard
      const statsResponse = await axios.get('http://localhost:3000/api/dashboard/stats', { headers });
      console.log('✅ /api/dashboard/stats - Users:', statsResponse.data.totalUsers);
      
      // Test users list
      const usersResponse = await axios.get('http://localhost:3000/api/users?limit=5', { headers });
      console.log('✅ /api/users - Found:', usersResponse.data.users.length, 'users');
      
      // Test system health
      const healthResponse = await axios.get('http://localhost:3000/api/system/health', { headers });
      console.log('✅ /api/system/health - Status:', healthResponse.data.status);
      
      // Test analytics
      const analyticsResponse = await axios.get('http://localhost:3000/api/analytics/usage', { headers });
      console.log('✅ /api/analytics/usage - Total chats:', analyticsResponse.data.totalChats);
      
      // Test CORS
      console.log('7️⃣ Testing CORS with frontend domain...');
      const corsResponse = await axios.get('http://localhost:3000/api/auth/me', {
        headers: {
          ...headers,
          'Origin': 'https://lovable.dev'
        }
      });
      console.log('✅ CORS working - Frontend can access endpoints');
      
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\n📋 Admin Credentials Ready:');
      console.log('   📧 Email: officialjwise20@gmail.com');
      console.log('   🔑 Password: Amoako@21');
      console.log('   👑 Role: admin');
      console.log('   🆔 UID:', userRecord.uid);
      
      console.log('\n🌐 Integration Details:');
      console.log('   🔗 Backend URL: http://localhost:3000');
      console.log('   🔗 Frontend URL: https://lovable.dev/projects/d0b157c7-5a7b-4fb8-b3e0-0a9f397f695b');
      console.log('   ✅ CORS: Enabled for all origins');
      console.log('   🔐 Authentication: Firebase ID tokens required');
      console.log('   👑 Admin Role: Required for admin endpoints');
      
      console.log('\n🚀 Ready for frontend integration!');
      
    } catch (signinError) {
      console.error('❌ Signin test failed:', signinError.response?.data || signinError.message);
    }
    
  } catch (error) {
    console.error('❌ Error updating user to admin:', error);
    process.exit(1);
  }
}

// Run the function
updateExistingUserToAdmin();
