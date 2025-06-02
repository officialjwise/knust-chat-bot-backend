const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');

// Load environment variables
dotenv.config();

// Initialize pdfData object early to avoid circular dependency
const pdfData = { programs: [] };

// Initialize Firebase Admin
let serviceAccount;
let db;

async function initializeFirebase() {
  try {
    // Try multiple ways to get Firebase credentials
    let credentials;
    
    if (process.env.FIREBASE_CREDENTIALS) {
      console.log('Using FIREBASE_CREDENTIALS from environment');
      try {
        credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_CREDENTIALS JSON:', parseError.message);
        throw new Error('Invalid JSON format in FIREBASE_CREDENTIALS');
      }
    } else {
      // Fallback to service account file (for local development)
      console.log('Attempting to load firebase-service-account.json');
      try {
        credentials = require('./firebase-service-account.json');
      } catch (fileError) {
        throw new Error('No Firebase credentials found. Set FIREBASE_CREDENTIALS environment variable or provide firebase-service-account.json');
      }
    }

    // Validate required fields in service account
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        throw new Error(`Missing required field '${field}' in service account credentials`);
      }
    }

    // Fix private key formatting (common issue)
    if (credentials.private_key && !credentials.private_key.includes('\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: credentials.project_id
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.log('Firebase Admin already initialized');
    }

    db = admin.firestore();
    
    // Test the connection with timeout
    await Promise.race([
      testFirestoreConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
    ]);
    
    return true;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', {
      message: error.message,
      type: error.constructor.name
    });
    
    // Provide specific guidance based on error type
    if (error.message.includes('Invalid JWT Signature')) {
      console.error('\n=== FIREBASE AUTHENTICATION TROUBLESHOOTING ===');
      console.error('1. Your service account key may be expired or revoked');
      console.error('2. Generate a new service account key at:');
      console.error('   https://console.firebase.google.com/project/knust-e2eee/settings/serviceaccounts/adminsdk');
      console.error('3. Update your FIREBASE_CREDENTIALS environment variable');
      console.error('4. Ensure proper JSON formatting (escape newlines as \\n)\n');
    } else if (error.message.includes('UNAUTHENTICATED')) {
      console.error('\n=== AUTHENTICATION ERROR ===');
      console.error('1. Verify your Firebase project ID is correct');
      console.error('2. Check that the service account has proper permissions');
      console.error('3. Generate a new service account key\n');
    }
    
    return false;
  }
}

async function testFirestoreConnection() {
  try {
    const testCollection = db.collection('test');
    await testCollection.limit(1).get();
    console.log('Firestore connection test successful');
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error.message);
    throw error;
  }
}

// Import data after Firebase is initialized
let validPrograms, collegeFees, cutOffAggregates, electiveRequirements, programToCollege;

function loadStaticData() {
  try {
    const data = require('./data');
    validPrograms = data.validPrograms || [];
    collegeFees = data.collegeFees || {};
    cutOffAggregates = data.cutOffAggregates || {};
    electiveRequirements = data.electiveRequirements || {};
    programToCollege = data.programToCollege || {};
    console.log(`Static data loaded successfully - ${validPrograms.length} programs`);
  } catch (error) {
    console.error('Error loading static data:', error.message);
    // Set defaults if data can't be loaded
    validPrograms = [];
    collegeFees = {};
    cutOffAggregates = {};
    electiveRequirements = {};
    programToCollege = {};
  }
}

// Initialize Express app
const app = express();

// Enhanced CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com', 'https://www.your-frontend-domain.com']
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Load Swagger JSON and setup Swagger UI
try {
  const swaggerDocument = require('./swagger.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('Swagger documentation loaded');
} catch (error) {
  console.warn('Swagger documentation not available:', error.message);
}

// Function to parse elective requirements properly
function parseElectiveRequirements(requirements) {
  if (!requirements || !Array.isArray(requirements)) {
    return [{ type: 'required', subject: 'Any' }];
  }

  const parsedElectives = [];
  
  requirements.forEach(requirement => {
    if (typeof requirement === 'string' && requirement.trim()) {
      parsedElectives.push({
        type: 'required',
        subject: requirement.trim()
      });
    } else if (Array.isArray(requirement)) {
      const validOptions = requirement.filter(item => typeof item === 'string' && item.trim());
      if (validOptions.length > 0) {
        parsedElectives.push({
          type: 'choice',
          options: validOptions,
          note: `Choose one: ${validOptions.join(' OR ')}`
        });
      }
    }
  });

  return parsedElectives.length > 0 ? parsedElectives : [{ type: 'required', subject: 'Any' }];
}

// Function to get flat list of all possible electives
function getFlatElectivesList(requirements) {
  if (!requirements || !Array.isArray(requirements)) {
    return ['Any'];
  }

  const allElectives = [];
  
  requirements.forEach(requirement => {
    if (typeof requirement === 'string' && requirement.trim()) {
      allElectives.push(requirement.trim());
    } else if (Array.isArray(requirement)) {
      const validOptions = requirement.filter(item => typeof item === 'string' && item.trim());
      allElectives.push(...validOptions);
    }
  });

  const uniqueElectives = [...new Set(allElectives)];
  return uniqueElectives.length > 0 ? uniqueElectives : ['Any'];
}

async function populatePrograms() {
  if (!db) {
    console.error('Database not initialized. Skipping program population.');
    return false;
  }

  try {
    const programsCollection = db.collection('programs');
    
    // Check if programs already exist
    const existingSnapshot = await programsCollection.limit(1).get();
    if (!existingSnapshot.empty) {
      console.log('Programs already exist in Firestore, skipping population');
      return true;
    }

    console.log(`Starting to populate ${validPrograms.length} programs...`);

    // Create program objects
    const programs = validPrograms.map(programName => {
      const college = programToCollege[programName] || 'Unknown';
      const cutoffs = cutOffAggregates[programName] || { male: 'N/A', female: 'N/A' };
      const rawElectives = electiveRequirements[programName] || ['Any'];
      
      const parsedElectives = parseElectiveRequirements(rawElectives);
      const flatElectives = getFlatElectivesList(rawElectives);

      return {
        id: uuidv4(),
        name: programName,
        college,
        stream: ['regular', 'fee_paying'],
        coreRequirements: [
          'English Language (A1-C6)', 
          'Mathematics (A1-C6)', 
          'Integrated Science (A1-C6)'
        ],
        electiveRequirementsStructured: parsedElectives,
        electiveRequirements: flatElectives,
        electivesCount: Array.isArray(rawElectives) ? rawElectives.length : 1,
        cutoffs: typeof cutoffs === 'object' ? cutoffs : { male: cutoffs, female: cutoffs },
        cutoffSource: 'hardcoded',
        fees: collegeFees[college] || {
          regular_freshers: 2000,
          fee_paying_freshers: 2000,
          residential_freshers: 2167.80,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    });

    // Write to Firestore in batches with retry logic
    const BATCH_SIZE = 25; // Conservative batch size for Render
    let successCount = 0;
    
    for (let i = 0; i < programs.length; i += BATCH_SIZE) {
      const chunk = programs.slice(i, i + BATCH_SIZE);
      let retries = 3;
      
      while (retries > 0) {
        try {
          let writeBatch = db.batch();
          
          chunk.forEach(program => {
            const docRef = programsCollection.doc(program.id);
            writeBatch.set(docRef, program);
          });
          
          await writeBatch.commit();
          console.log(`✓ Committed batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(programs.length/BATCH_SIZE)} (${chunk.length} programs)`);
          successCount += chunk.length;
          break;
        } catch (batchError) {
          retries--;
          console.warn(`Batch write failed, retries left: ${retries}`, batchError.message);
          
          if (retries === 0) {
            console.error('Failed to write batch after all retries:', batchError.message);
          } else {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
          }
        }
      }
    }

    console.log(`Successfully stored ${successCount}/${programs.length} programs in Firestore`);
    return successCount > 0;
  } catch (error) {
    console.error('Error populating programs:', {
      message: error.message,
      stack: error.stack,
    });
    return false;
  }
}

async function loadProgramsFromFirestore() {
  if (!db) {
    console.error('Database not initialized. Using empty programs array.');
    pdfData.programs = [];
    return false;
  }

  try {
    // Try to populate programs first
    await populatePrograms();
    
    // Load programs from Firestore
    const programsCollection = db.collection('programs');
    const snapshot = await programsCollection.get();
    
    if (!snapshot.empty) {
      pdfData.programs = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
      console.log(`✓ Loaded ${pdfData.programs.length} programs from Firestore`);
    } else {
      console.warn('No programs found in Firestore');
      pdfData.programs = [];
    }
    
    return true;
  } catch (error) {
    console.error('Error loading programs from Firestore:', {
      message: error.message
    });
    pdfData.programs = [];
    return false;
  }
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'KNUST Chatbot Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      swagger: '/api-docs',
      programs: '/api/programs'
    },
    status: 'running'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firebase: !!db,
    programs: pdfData.programs.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Additional endpoints with error handling
app.get('/api/program/by-name/:name', (req, res) => {
  try {
    const { findProgramByName } = require('./utils');
    const program = findProgramByName(req.params.name);
    if (program) {
      res.json(program);
    } else {
      res.status(404).json({ 
        error: 'Program not found',
        requestedName: req.params.name 
      });
    }
  } catch (error) {
    console.error('Error in /api/program/by-name:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/program/by-id/:id', (req, res) => {
  try {
    const { findProgramById } = require('./utils');
    const program = findProgramById(req.params.id);
    if (program) {
      res.json(program);
    } else {
      res.status(404).json({ 
        error: 'Program not found',
        requestedId: req.params.id 
      });
    }
  } catch (error) {
    console.error('Error in /api/program/by-id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize the application
async function startServer() {
  console.log('🚀 Starting KNUST Chatbot Backend...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Load static data first
  loadStaticData();
  
  // Initialize Firebase
  const firebaseSuccess = await initializeFirebase();
  
  if (firebaseSuccess) {
    // Load programs from Firestore
    await loadProgramsFromFirestore();
  } else {
    console.warn('⚠️  Firebase initialization failed. Server will run with limited functionality.');
  }
  
  // Load routes after everything is initialized
  try {
    const routes = require('./routes');
    app.use('/', routes);
    console.log('✓ Routes loaded successfully');
  } catch (routesError) {
    console.error('❌ Error loading routes:', routesError.message);
  }
  
  // Start the server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎉 Server running successfully!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 API: http://0.0.0.0:${PORT}/`);
    console.log(`📚 Docs: http://0.0.0.0:${PORT}/api-docs`);
    console.log(`❤️  Health: http://0.0.0.0:${PORT}/health`);
    console.log(`📊 Programs: ${pdfData.programs.length} loaded`);
    console.log(`\n✅ Ready to serve requests!`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Export for routes.js
module.exports = {
  parseElectiveRequirements,
  getFlatElectivesList,
  pdfData,
  db: () => db // Export as function to ensure it's initialized
};