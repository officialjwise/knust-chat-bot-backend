const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Initialize Firebase
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const programsCollection = db.collection('programs');

// Import data and routes
const { validPrograms, collegeFees, cutOffAggregates, electiveRequirements, programToCollege, pdfData } = require('./data');
const routes = require('./routes');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Function to parse elective requirements properly
function parseElectiveRequirements(requirements) {
  if (!requirements || !Array.isArray(requirements)) {
    return ['Any'];
  }

  const parsedElectives = [];
  
  requirements.forEach(requirement => {
    if (typeof requirement === 'string') {
      parsedElectives.push({
        type: 'required',
        subject: requirement
      });
    } else if (Array.isArray(requirement)) {
      parsedElectives.push({
        type: 'choice',
        options: requirement.filter(item => typeof item === 'string' && item),
        note: `Choose one: ${requirement.filter(item => typeof item === 'string' && item).join(' OR ')}`
      });
    }
  });

  return parsedElectives.filter(e => e.subject || (e.options && e.options.length > 0));
}

// Function to get flat list of all possible electives
function getFlatElectivesList(requirements) {
  if (!requirements || !Array.isArray(requirements)) {
    return ['Any'];
  }

  const allElectives = [];
  
  requirements.forEach(requirement => {
    if (typeof requirement === 'string') {
      allElectives.push(requirement);
    } else if (Array.isArray(requirement)) {
      allElectives.push(...requirement.filter(item => typeof item === 'string' && item));
    }
  });

  return [...new Set(allElectives)];
}

async function populatePrograms() {
  try {
    // Clear existing programs
    let deleteBatch = db.batch();
    const snapshot = await programsCollection.get();
    snapshot.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    console.log('Cleared existing programs in Firestore');

    // Validate program count
    console.log(`Valid programs count: ${validPrograms.length}`);
    if (validPrograms.length !== 95) {
      console.warn('Warning: Expected 95 programs, found', validPrograms.length);
      console.log('Programs:', validPrograms.join(', '));
    }

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
        electivesCount: rawElectives.length,
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

    // Validate cut-off for BSc Biological Sciences
    const bioSci = programs.find(p => p.name === 'BSc Biological Sciences');
    if (bioSci) {
      console.log(`BSc Biological Sciences cut-off: ${JSON.stringify(bioSci.cutoffs)}`);
    }

    // Write to Firestore in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < programs.length; i += BATCH_SIZE) {
      let writeBatch = db.batch();
      const chunk = programs.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(program => {
        const docRef = programsCollection.doc(program.id);
        writeBatch.set(docRef, program);
      });
      
      await writeBatch.commit();
      console.log(`Committed batch of ${chunk.length} programs`);
    }

    pdfData.programs = programs;
    console.log(`Stored ${programs.length} programs in Firestore`);
  } catch (error) {
    console.error('Error populating programs:', error);
    pdfData.programs = [];
  }
}

async function loadProgramsFromFirestore() {
  try {
    await populatePrograms();
    const snapshot = await programsCollection.get();
    pdfData.programs = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));
    console.log(`Loaded ${pdfData.programs.length} programs from Firestore`);
    console.log(`pdfData.programs initialized with ${pdfData.programs.length} programs`);
  } catch (error) {
    console.error('Error loading programs:', error);
    pdfData.programs = [];
  }
}

// Initialize pdfData.programs as empty array
pdfData.programs = [];

(async () => {
  await loadProgramsFromFirestore();
})();

app.use('/', routes);

// Additional endpoints
const { findProgramByName, findProgramById } = require('./utils');

app.get('/api/program/by-name/:name', (req, res) => {
  const program = findProgramByName(req.params.name);
  if (program) {
    res.json(program);
  } else {
    res.status(404).json({ error: 'Program not found' });
  }
});

app.get('/api/program/by-id/:id', (req, res) => {
  const program = findProgramById(req.params.id);
  if (program) {
    res.json(program);
  } else {
    res.status(404).json({ error: 'Program not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/`);
});
// Export for routes.js
module.exports = {
  parseElectiveRequirements,
  getFlatElectivesList,
  pdfData
};