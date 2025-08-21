const axios = require('axios');
require('dotenv').config();

async function debugAuthIssue() {
  console.log('🔍 Debugging Authentication Issue\n');
  
  const PRODUCTION_URL = 'https://knust-chat-bot-backend.onrender.com';
  const LOCAL_URL = 'http://localhost:3000';
  
  const email = 'officialjwise20@gmail.com';
  const password = 'Amoako@21';
  
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
  console.log('🔑 Firebase API Key:', FIREBASE_API_KEY ? FIREBASE_API_KEY.substring(0, 10) + '...' : 'NOT SET');
  
  // Test 1: Check if we can authenticate directly with Firebase
  console.log('\n1️⃣ Testing direct Firebase Auth...');
  try {
    const directAuth = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );
    console.log('✅ Direct Firebase auth successful');
    console.log('   Token length:', directAuth.data.idToken.length);
  } catch (error) {
    console.error('❌ Direct Firebase auth failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    return;
  }
  
  // Test 2: Try local signin
  console.log('\n2️⃣ Testing local signin...');
  try {
    const localSignin = await axios.post(`${LOCAL_URL}/signin`, {
      email,
      password
    });
    console.log('✅ Local signin successful');
    console.log('   User:', localSignin.data.user.email);
    console.log('   Token length:', localSignin.data.idToken.length);
  } catch (error) {
    console.error('❌ Local signin failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
  }
  
  // Test 3: Try production signin with detailed logging
  console.log('\n3️⃣ Testing production signin...');
  try {
    const productionSignin = await axios.post(`${PRODUCTION_URL}/signin`, {
      email,
      password
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Production signin successful');
    console.log('   User:', productionSignin.data.user.email);
    console.log('   Token length:', productionSignin.data.idToken.length);
  } catch (error) {
    console.error('❌ Production signin failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    console.error('   Headers:', error.response?.headers);
    console.error('   Timeout:', error.code === 'ECONNABORTED');
  }
  
  // Test 4: Check production health
  console.log('\n4️⃣ Testing production health...');
  try {
    const health = await axios.get(`${PRODUCTION_URL}/health`);
    console.log('✅ Production health check passed');
    console.log('   Status:', health.data.status);
  } catch (error) {
    console.error('❌ Production health check failed:', error.response?.data || error.message);
  }
}

debugAuthIssue();
