const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function resetAdminPassword() {
  try {
    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      console.log('🔧 Initializing Firebase Admin...');
      
      const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: `https://${credentials.project_id}-default-rtdb.firebaseio.com`
      });
      
      console.log('✅ Firebase Admin initialized');
    }
    
    console.log('🔐 Resetting admin user password...');
    
    // Get the user by email
    const userRecord = await admin.auth().getUserByEmail('jwise@gmail.com');
    console.log('📧 Found user:', userRecord.uid);
    
    // Update the password
    await admin.auth().updateUser(userRecord.uid, {
      password: 'Amoako@21',
      emailVerified: true
    });
    
    console.log('✅ Password reset successfully');
    
    // Update Firestore record
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email: 'jwise@gmail.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Firestore record updated');
    console.log('🎉 Admin user is ready!');
    console.log(`📧 Email: jwise@gmail.com`);
    console.log(`🔑 Password: Amoako@21`);
    console.log(`🆔 UID: ${userRecord.uid}`);
    
    return userRecord.uid;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the reset
if (require.main === module) {
  resetAdminPassword().catch(console.error);
}

module.exports = { resetAdminPassword };
