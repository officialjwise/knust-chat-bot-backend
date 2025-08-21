const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function initializeFirebase() {
  try {
    let credentials;
    
    if (process.env.FIREBASE_CREDENTIALS) {
      console.log('Using FIREBASE_CREDENTIALS from environment');
      try {
        credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_CREDENTIALS JSON:', parseError.message);
        throw new Error('Invalid JSON format in FIREBASE_CREDENTIALS');
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT_KEY from environment');
      try {
        credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', parseError.message);
        throw new Error('Invalid JSON format in FIREBASE_SERVICE_ACCOUNT_KEY');
      }
    } else {
      console.log('No Firebase credentials in environment, trying local file');
      try {
        credentials = require('./serviceAccountKey.json');
      } catch (fileError) {
        console.error('Failed to load local service account file:', fileError.message);
        throw new Error('No Firebase credentials available. Please check environment variables or serviceAccountKey.json file.');
      }
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

async function createAdminUser() {
  try {
    console.log('🚀 Starting admin user creation...');
    
    // Initialize Firebase
    const db = await initializeFirebase();
    
    const email = 'jwise@gmail.com';
    const password = 'Amoako@21';
    
    // Create user in Firebase Auth
    console.log('Creating user in Firebase Auth...');
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        emailVerified: true,
        displayName: 'Admin User'
      });
      console.log('✅ User created in Firebase Auth with UID:', userRecord.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log('⚠️  User already exists in Firebase Auth, getting user record...');
        userRecord = await admin.auth().getUserByEmail(email);
        console.log('✅ Found existing user with UID:', userRecord.uid);
      } else {
        throw authError;
      }
    }
    
    // Create/update user document in Firestore with admin role
    console.log('Creating user document in Firestore...');
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Admin user document created/updated in Firestore');
    
    // Also add to admins collection if it exists
    try {
      await db.collection('admins').doc(userRecord.uid).set({
        email: email,
        name: 'Admin User',
        permissions: ['full_access'],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('✅ Admin user added to admins collection');
    } catch (adminError) {
      console.log('⚠️  Could not add to admins collection (collection may not exist)');
    }
    
    console.log('\n🎉 Admin user setup complete!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🆔 UID:', userRecord.uid);
    console.log('👑 Role: admin');
    
    // Test creating a custom token for immediate testing
    try {
      const customToken = await admin.auth().createCustomToken(userRecord.uid);
      console.log('\n🎫 Custom token for testing (expires in 1 hour):');
      console.log(customToken);
    } catch (tokenError) {
      console.log('⚠️  Could not create custom token:', tokenError.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();
