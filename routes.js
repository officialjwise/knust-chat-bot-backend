const express = require('express');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');
const router = express.Router();
const axios = require('axios');
// Import pdfData from server.js, helpers from utils.js, and validPrograms from data.js
const { pdfData } = require('./server');
const { findProgramByName } = require('./utils');
const { validPrograms } = require('./data');

const programsCollection = admin.firestore().collection('programs');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Calculate aggregate, treating C6 as 4 (same as C4/C5)
function calculateAggregate(grades) {
  const gradeValues = {
    A1: 1, B2: 2, B3: 3, C4: 4, C5: 4, C6: 4, D7: 7, E8: 8, F9: 9
  };

  const subjects = [
    grades.english,
    grades.math,
    grades.integratedScience,
    ...(grades.electives || []).map(e => e.grade)
  ].filter(g => g && gradeValues[g]);

  const values = subjects.map(g => gradeValues[g]).sort((a, b) => a - b).slice(0, 6);
  return values.reduce((sum, val) => sum + val, 0);
}

// Match user electives against program requirements
function matchesElectives(userElectives, programElectives) {
  if (!Array.isArray(userElectives) || !Array.isArray(programElectives)) {
    console.log('Invalid electives:', { userElectives, programElectives });
    return false;
  }

  return programElectives.every(pe => {
    if (!pe) return false;
    if (Array.isArray(pe.options)) {
      return pe.options.some(alt => 
        typeof alt === 'string' && 
        userElectives.some(ue => 
          ue?.subject && 
          typeof ue.subject === 'string' && 
          ue.subject.toLowerCase().includes(alt.toLowerCase())
        )
      );
    }
    if (pe.subject === 'Any') return true;
    return userElectives.some(ue => 
      ue?.subject && 
      typeof ue.subject === 'string' && 
      ue.subject.toLowerCase().includes(pe.subject.toLowerCase())
    );
  });
}

// Firebase Web API Key (store in environment variables in production)
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBa3Ht1TcWCrUSsN5o3mGhGTVPjjz-8KJU';

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.error('Authentication token missing');
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// User signup
router.post('/signup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    console.error('Missing required signup fields', { email, firstName, lastName });
    return res.status(400).json({ error: 'Email, password, firstName, and lastName required' });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false,
    });

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      firstName,
      lastName,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ uid: userRecord.uid, message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', {
      message: error.message,
      code: error.code,
    });
    res.status(400).json({ error: 'Invalid input' });
  }
});

// User signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.error('Missing email or password', { email });
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Verify email and password using Firebase Auth REST API
    const authResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );

    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // Create custom token
    const customToken = await admin.auth().createCustomToken(user.uid);

    res.json({
      uid: user.uid,
      customToken,
      message: 'Sign-in successful',
    });
  } catch (error) {
    console.error('Error signing in:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    console.error('Missing email for password reset');
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    await admin.auth().generatePasswordResetLink(email);
    res.json({ message: 'Password reset link sent' });
  } catch (error) {
    console.error('Error generating reset link:', {
      message: error.message,
      code: error.code,
    });
    res.status(400).json({ error: 'Invalid input' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { oobCode, newPassword } = req.body;

  if (!oobCode || !newPassword) {
    console.error('Missing reset code or new password');
    return res.status(400).json({ error: 'Reset code and new password required' });
  }

  try {
    const email = await admin.auth().verifyPasswordResetCode(oobCode);
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', {
      message: error.message,
      code: error.code,
    });
    res.status(400).json({ error: 'Invalid input' });
  }
});

// Chat endpoint with improved program name extraction
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, sender } = req.body;
  if (!message || !sender) {
    console.error('Missing message or sender');
    return res.status(400).json({ error: 'Message and sender are required' });
  }

  try {
    // Extract program name using regex for common prefixes or standalone names
    let programName = message.match(/(BSc|BA|BFA|BEd|LLB|PharmD|DVM|BDS|BHM|Doctor of)\s+[\w\s\/\(\)]+|LLB/i)?.[0]?.trim();

    // Fallback: Match any potential program name against validPrograms
    if (!programName) {
      const words = message.toLowerCase().split(/\s+/);
      for (let i = 1; i < words.length; i++) {
        const potentialName = words.slice(i).join(' ').trim();
        const match = validPrograms.find(p => p.toLowerCase().includes(potentialName));
        if (match) {
          programName = match;
          break;
        }
      }
    }

    // Normalize specific cases
    if (programName) {
      const lowerName = programName.toLowerCase();
      if (lowerName.includes('biological science')) {
        programName = 'BSc Biological Sciences';
      } else if (lowerName.includes('optometry')) {
        programName = 'Doctor of Optometry';
      } else if (lowerName.includes('law') || lowerName === 'llb') {
        programName = 'LLB';
      } else if (lowerName.includes('economic')) {
        programName = 'BA Economics';
      } else {
        // Fuzzy match against validPrograms
        programName = validPrograms.find(p => 
          p.toLowerCase() === lowerName ||
          p.toLowerCase().includes(lowerName) ||
          lowerName.includes(p.toLowerCase())
        ) || programName;
      }
      console.log('Extracted programName:', programName);
    }

    let program = programName ? findProgramByName(programName) : null;

    // Fallback search in pdfData.programs
    if (!program && programName) {
      const lowerQuery = programName.toLowerCase();
      program = (pdfData?.programs || []).find(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        lowerQuery.includes(p.name.toLowerCase())
      );
    }

    let responseText = '';

    if (program) {
      const prompt = `
        You are a KNUST admissions assistant for freshers. Answer the user's question using ONLY the following program data. Provide a concise, accurate response with details on cut-offs, fees, core and elective requirements, and streams.

        Program Data:
        - Name: ${program.name}
        - College: ${program.college}
        - Cut-offs: Male: ${program.cutoffs.male || program.cutoffs}, Female: ${program.cutoffs.female || program.cutoffs}
        - Stream: ${program.stream.join(', ')}
        - Fees:
          - Regular Freshers: GHC ${program.fees.regular_freshers}
          - Fee-Paying Freshers: GHC ${program.fees.fee_paying_freshers}
          - Residential Freshers: GHC ${program.fees.residential_freshers}
        - Core Requirements: ${program.coreRequirements.join(', ')}
        - Elective Requirements: ${program.electiveRequirementsStructured.map(e => 
            e.type === 'choice' ? e.note : e.subject
          ).join(', ')}
        - Deadlines: Regular - ${pdfData?.deadlines?.regular || '31st December, 2024'}, Extension - ${pdfData?.deadlines?.extension || '28th February, 2025'}

        User question: ${message}

        Instructions:
        - Use exact cut-off values.
        - If cut-offs are 'N/A', state they may vary and suggest contacting KNUST admissions.
        - Format response with bullet points.
        - For recommendations, suggest up to 4 programs with similar cut-offs (±3) and matching electives.
        - Do not infer data beyond what is provided.
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a KNUST admissions assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      responseText = completion.choices[0].message.content;
    } else {
      const prompt = `
        You are a KNUST admissions assistant for freshers. Answer concisely. If the question is about a specific program but no program is identified, respond with: "Please specify a valid KNUST program or check the program name." For general questions, provide a helpful response.

        Deadlines: Regular - ${pdfData?.deadlines?.regular || '31st December, 2024'}, Extension - ${pdfData?.deadlines?.extension || '28th February, 2025'}

        User question: ${message}
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a KNUST admissions assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      responseText = completion.choices[0].message.content;
    }

    await admin.firestore().collection('faqs').add({
      question: message,
      answer: responseText,
      frequency: 1,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error('Error in /chat:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get all programs
router.get('/programs', authenticateToken, async (req, res) => {
  try {
    let programs = pdfData?.programs || [];
    if (programs.length === 0) {
      const snapshot = await programsCollection.get();
      programs = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    }
    if (programs.length === 0) {
      console.error('No programs found in pdfData or Firestore');
      return res.status(404).json({ error: 'No programs found' });
    }
    res.json(programs.map(p => ({
      id: p.docId,
      name: p.name,
      description: `A program offered by the ${p.college} at KNUST.`,
      requirements: `${p.coreRequirements.join(', ')}; Electives: ${p.electiveRequirementsStructured.map(e => e.type === 'choice' ? e.note : e.subject).join(', ')}`
    })));
  } catch (error) {
    console.error('Error fetching programs:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// Search programs
router.get('/programs/search', authenticateToken, async (req, res) => {
  try {
    let results = pdfData?.programs || [];
    if (results.length === 0) {
      const snapshot = await programsCollection.get();
      results = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    }

    const { query, college } = req.query;

    if (college.length > 0) {
      results = results.filter(p => 
        p.college.toLowerCase().includes(college.toLowerCase())
      );
    }

    if (query) {
      results = results.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (results.length === 0) {
      console.error('No programs match the criteria:', { query, college });
      return res.status(404).json({ error: 'No programs found' });
    }

    res.json({ results: results.map(p => ({
      id: p.docId,
      name: p.name,
      description: `A program offered by the ${p.college} at KNUST.`,
      requirements: `${p.coreRequirements.join(', ')}; Electives: ${p.electiveRequirementsStructured.map(e => e.type === 'choice' ? e.note : e.subject).join(', ')}`
    })) });
  } catch (error) {
    console.error('Error searching programs:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to search programs' });
  }
});

// Recommend programs based on grades
router.post('/recommend', authenticateToken, async (req, res) => {
  const { grades, gender } = req.body;
  if (!grades || typeof grades !== 'object') {
    console.error('Invalid grades object:', { grades });
    return res.status(400).json({ error: 'Invalid grades object' });
  }

  try {
    const aggregate = calculateAggregate(grades);
    let programs = pdfData?.programs || [] || [];
    if (programs.length === 0) {
      const snapshot = await programsCollection.get();
      programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (programs.length === 0) {
      console.error('No programs available for recommendation');
      return res.status(404).json({ error: 'No programs found' });
    }

    let recommendations = programs
      .filter(program => {
        const cutoff = (gender && gender.toLowerCase() === 'male' && program.cutoffs.male !== 'N/A')
          ? program.cutoffs.male
          : (program.cutoffs.female !== 'N/A' ? program.cutoffs.female : program.cutoffs);
        const meetsCutoff = cutoff !== 'N/A' && aggregate <= cutoff;
        const electivesMatch = matchesElectives(grades.electives || [], program.electiveRequirementsStructured || []);
        const genderMatch = !gender || program.cutoffs[gender.toLowerCase()] !== 'N/A';
        return meetsCutoff && electivesMatch && genderMatch;
      })
      .map(program => ({
        name: program.name,
        college: program.college,
        cutoff: (gender && gender.toLowerCase() === 'male' && program.cutoffs.male !== 'N/A')
          ? program.cutoffs.male
          : (program.cutoffs.female !== 'N/A' ? program.cutoffs.female : program.cutoffs),
        cutoffSource: program.cutoffSource,
        coreRequirements: program.coreRequirements,
        electiveRequirements: program.electiveRequirementsStructured,
        fees: program.fees,
      }))
      .sort((a, b) => Math.abs(a.cutoff - aggregate) - Math.abs(b.cutoff - aggregate));

    recommendations = recommendations.filter((rec, index, self) =>
      index === recommendations.findIndex(r => r.name === rec.name)
    );

    if (recommendations.length < 4) {
      const additional = programs
        .filter(program => !recommendations.some(rec => rec.name === program.name))
        .filter(program => matchesElectives(grades.electives || [], program.electiveRequirementsStructured || []))
        .filter(program => !gender || program.cutoffs[gender.toLowerCase()] !== 'N/A')
        .map(program => ({
          name: program.name,
          college: program.college,
          cutoff: (gender && gender.toLowerCase() === 'male' && program.cutoffs.male !== 'N/A')
            ? program.cutoffs.male
            : (program.cutoffs.female !== 'N/A' ? program.cutoffs.female : program.cutoffs),
          cutoffSource: program.cutoffSource,
          coreRequirements: program.coreRequirements,
          electiveRequirements: program.electiveRequirementsStructured,
          fees: program.fees,
        }))
        .sort((a, b) => (a.cutoff === 'N/A' ? 999 : a.cutoff) - (b.cutoff === 'N/A' ? 999 : b.cutoff))
        .slice(0, 4 - recommendations.length);
      recommendations = [...recommendations, ...additional];
    }

    const warnings = [];
    if (recommendations.some(r => r.cutoffSource === 'missing')) {
      warnings.push('Some programs have no specified cut-off for 2024/2025. Contact KNUST admissions for official cut-offs.');
    }

    await admin.firestore().collection('recommendations').add({
      uid: req.user.uid,
      grades,
      aggregate,
      recommendations,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ aggregate, recommendations: recommendations.slice(0, 4), warnings });
  } catch (error) {
    console.error('Error in /recommend:', error);
    res.status(400).json({ error: 'Invalid grades format or server error' });
  }
});

// Calculate aggregate
router.post('/calculate-aggregate', authenticateToken, async (req, res) => {
  const { grades } = req.body;
  if (!grades || typeof grades !== 'object') {
    console.error('Invalid grades object');
    return res.status(400).json({ error: 'Valid grades object required' });
  }

  try {
    const aggregate = calculateAggregate(grades);
    res.json({ aggregate });
  } catch (error) {
    console.error('Error calculating aggregate:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ error: 'Invalid grades format' });
  }
});

// Get FAQs
router.get('/faqs', authenticateToken, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('faqs').orderBy('frequency', 'desc').limit(10).get();
    const faqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching FAQs:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Get specific FAQ
router.get('/faq/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await admin.firestore().collection('faqs').doc(req.params.id).get();
    if (!doc.exists) {
      console.error('FAQ not found:', req.params.id);
      return res.status(404).json({ error: 'FAQ not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching FAQ:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch FAQ' });
  }
});

// Create FAQ
router.post('/faqs', authenticateToken, async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    console.error('Missing question or answer');
    return res.status(400).json({ error: 'Question and answer required' });
  }

  try {
    const docRef = await admin.firestore().collection('faqs').add({
      question,
      answer,
      frequency: 1,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Error adding FAQ:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to add FAQ' });
  }
});

// Update FAQ
router.put('/faqs/:id', authenticateToken, async (req, res) => {
  const { question, answer } = req.body;
  if (!question && !answer) {
    console.error('Missing question and answer');
    return res.status(400).json({ error: 'Question or answer required' });
  }

  try {
    const docRef = admin.firestore().collection('faqs').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('FAQ not found:', req.params.id);
      return res.status(404).json({ error: 'FAQ not found' });
    }

    const updateData = {};
    if (question) updateData.question = question;
    if (answer) updateData.answer = answer;
    updateData.timestamp = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update(updateData);

    res.json({ id: req.params.id, ...updateData });
  } catch (error) {
    console.error('Error updating FAQ:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

// Delete FAQ
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = admin.firestore().collection('faqs').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('FAQ not found:', req.params.id);
      return res.status(404).json({ error: 'FAQ not found' });
    }

    await docRef.delete();
    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// Get user recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('recommendations')
      .where('uid', '==', req.user.uid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    const recommendations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Saved Programs Endpoints
router.get('/saved-programs', authenticateToken, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('savedPrograms')
      .where('uid', '==', req.user.uid)
      .orderBy('savedAt', 'desc')
      .get();
    const savedPrograms = snapshot.docs.map(doc => ({
      id: doc.id,
      programName: doc.data().programName,
      course: doc.data().course,
      savedAt: doc.data().savedAt.toDate().toISOString()
    }));
    res.json(savedPrograms);
  } catch (error) {
    console.error('Error fetching saved programs:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch saved programs' });
  }
});

router.post('/saved-programs', authenticateToken, async (req, res) => {
  const { programName, course } = req.body;
  if (!programName || !course) {
    console.error('Missing programName or course');
    return res.status(400).json({ error: 'programName and course required' });
  }

  try {
    // Verify program exists
    const program = (pdfData?.programs || []).find(p => p.name === programName);
    if (!program) {
      console.error('Program not found:', programName);
      return res.status(404).json({ error: 'Program not found' });
    }

    const docRef = await admin.firestore().collection('savedPrograms').add({
      uid: req.user.uid,
      programName,
      course,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ 
      id: docRef.id, 
      programName, 
      course, 
      savedAt: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error saving program:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to save program' });
  }
});

router.delete('/saved-programs/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = admin.firestore().collection('savedPrograms').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.error('Saved program not found:', req.params.id);
      return res.status(404).json({ error: 'Saved program not found' });
    }
    if (doc.data().uid !== req.user.uid) {
      console.error('Unauthorized attempt to delete saved program:', req.params.id);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await docRef.delete();
    res.json({ message: 'Saved program deleted successfully' });
  } catch (error) {
    console.error('Error deleting saved program:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to delete saved program' });
  }
});

// Support Endpoint
router.post('/support', authenticateToken, async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    console.error('Missing subject or message');
    return res.status(400).json({ error: 'Subject and message required' });
  }

  try {
    await admin.firestore().collection('supportInquiries').add({
      uid: req.user.uid,
      subject,
      message,
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ message: 'Support inquiry submitted successfully' });
  } catch (error) {
    console.error('Error submitting support inquiry:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to submit support inquiry' });
  }
});

// About Endpoint
router.get('/about', async (req, res) => {
  try {
    const aboutData = {
      appName: 'KNUST Chatbot',
      version: '1.0.0',
      description: 'A chatbot application to assist prospective KNUST students with program selection, admissions information, and more.',
      contact: {
        email: 'support@knustchatbot.com',
        phone: '+233 123 456 789',
        website: 'https://knustchatbot.com'
      },
      lastUpdated: '2025-06-23'
    };
    res.json(aboutData);
  } catch (error) {
    console.error('Error fetching about data:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch about data' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;