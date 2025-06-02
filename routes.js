const express = require('express');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');
const router = express.Router();

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

// Authenticate Firebase token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// User signup
router.post('/signup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || !firstName || !lastName) {
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
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// User signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await admin.auth().getUserByEmail(email);
    const customToken = await admin.auth().createCustomToken(user.uid);
    res.json({ uid: user.uid, customToken, message: 'Use customToken to get ID token via Firebase REST API' });
  } catch (error) {
    console.error('Error signing in:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    console.log('Password reset link:', link);
    res.json({ message: 'Password reset link sent to email' });
  } catch (error) {
    console.error('Error generating reset link:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { oobCode, newPassword } = req.body;
  if (!oobCode || !newPassword) return res.status(400).json({ error: 'Reset code and new password required' });

  try {
    const email = await admin.auth().verifyPasswordResetCode(oobCode);
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(400).json({ error: error.message });
  }
});

// Chat endpoint with improved program name extraction
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, sender } = req.body;
  if (!message || !sender) return res.status(400).json({ error: 'Message and sender are required' });

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
    console.error('Error in /chat:', error);
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
      return res.status(404).json({ error: 'No programs found' });
    }
    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
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

    if (college) {
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
      return res.status(404).json({ error: 'No programs match the criteria' });
    }

    res.json({ results });
  } catch (error) {
    console.error('Error searching programs:', error);
    res.status(500).json({ error: 'Failed to search programs' });
  }
});

// Recommend programs based on grades
router.post('/recommend', authenticateToken, async (req, res) => {
  const { grades, gender } = req.body;
  if (!grades || typeof grades !== 'object') {
    return res.status(400).json({ error: 'Valid grades object required' });
  }

  try {
    const aggregate = calculateAggregate(grades);
    let programs = pdfData?.programs || [];
    if (programs.length === 0) {
      const snapshot = await programsCollection.get();
      programs = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    }

    if (programs.length === 0) {
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
      index === self.findIndex(r => r.name === rec.name)
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
  if (!grades || typeof grades !== 'object') return res.status(400).json({ error: 'Valid grades object required' });

  try {
    const aggregate = calculateAggregate(grades);
    res.json({ aggregate });
  } catch (error) {
    console.error('Error calculating aggregate:', error);
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
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// Get specific FAQ
router.get('/faq/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await admin.firestore().collection('faqs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ error: 'Failed to fetch FAQ' });
  }
});

// Create FAQ
router.post('/faqs', authenticateToken, async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });

  try {
    const docRef = await admin.firestore().collection('faqs').add({
      question,
      answer,
      frequency: 1,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Error adding FAQ:', error);
    res.status(500).json({ error: 'Failed to add FAQ' });
  }
});

// Update FAQ
router.put('/faqs/:id', authenticateToken, async (req, res) => {
  const { question, answer } = req.body;
  if (!question && !answer) return res.status(400).json({ error: 'Question or answer required' });

  try {
    const docRef = admin.firestore().collection('faqs').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'FAQ not found' });

    const updateData = {};
    if (question) updateData.question = question;
    if (answer) updateData.answer = answer;
    updateData.timestamp = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update(updateData);

    res.json({ id: req.params.id, ...updateData });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

// Delete FAQ
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = admin.firestore().collection('faqs').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'FAQ not found' });

    await docRef.delete();
    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
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
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;