const express = require('express');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');
const router = express.Router();
const axios = require('axios');
// Import pdfData from server.js, helpers from utils.js, and validPrograms from data.js
const { pdfData } = require('./server');
const { findProgramByName } = require('./utils');
const { validPrograms } = require('./data');
// Import new chatbot utilities
const {
    isAdmissionQuery,
    isCareerAcademicQuery,
    checkNonAdmissionQuery,
    fuzzySearchPrograms,
    findProgramWithFuzzySearch,
    suggestProgramMatches,
    extractProgramName,
    getProgramData,
    findSimilarPrograms,
    generateDatasetResponse,
    checkEligibilityByBackground,
    appendAdmissionRequirements,
    saveChatMessage
} = require('./chatbot-utils');

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

// Log Firebase API key for debugging (first 10 chars only)
console.log('🔑 Firebase API Key configured:', FIREBASE_API_KEY ? FIREBASE_API_KEY.substring(0, 10) + '...' : 'NOT SET');

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
    
    // Get user data from Firestore to check role
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    req.user = {
      ...decodedToken,
      role: userData.role || 'user',
      ...userData
    };
    next();
  } catch (error) {
    console.error('Error verifying token:', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Admin middleware - requires admin role
const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
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
      name: `${firstName} ${lastName}`,
      email,
      role: 'user',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      loginCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    console.log('🔐 Attempting signin for:', email);
    console.log('🌐 Using Firebase API Key:', FIREBASE_API_KEY.substring(0, 10) + '...');
    
    // Verify email and password using Firebase Auth REST API
    const authResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );

    console.log('✅ Firebase auth successful for:', email);

    // Get user by email for additional info
    const user = await admin.auth().getUserByEmail(email);

    // Update lastLogin timestamp and increment login count
    try {
      await admin.firestore().collection('users').doc(user.uid).update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        loginCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('📝 Updated login tracking for:', email);
    } catch (updateError) {
      console.warn('⚠️ Failed to update login tracking:', updateError.message);
      // Don't fail the signin if tracking update fails
    }

    res.json({
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      },
      idToken: authResponse.data.idToken,
      refreshToken: authResponse.data.refreshToken,
      message: 'Sign-in successful',
    });
  } catch (error) {
    console.error('❌ Error signing in:', {
      message: error.message,
      email: email,
      firebaseApiKey: FIREBASE_API_KEY ? 'SET' : 'NOT SET',
      errorResponse: error.response?.data,
      status: error.response?.status,
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
    // Generate password reset link (this will send email automatically if configured)
    const link = await admin.auth().generatePasswordResetLink(email);
    
    // For development, you might want to log the link
    if (process.env.NODE_ENV === 'development') {
      console.log('Password reset link generated:', link);
    }
    
    res.json({ 
      message: 'Password reset email sent successfully. Please check your inbox.',
      ...(process.env.NODE_ENV === 'development' && { resetLink: link })
    });
  } catch (error) {
    console.error('Error generating reset link:', {
      message: error.message,
      code: error.code,
    });
    
    // Provide more specific error messages
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'No user found with this email address' });
    } else if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    res.status(400).json({ error: 'Failed to send password reset email' });
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

// Enhanced Chat endpoint with dataset-scoped responses
router.post('/chat', authenticateToken, ensureDatasetOnly, async (req, res) => {
  const { message, sender } = req.body;
  if (!message || !sender) {
    console.error('Missing message or sender');
    return res.status(400).json({ error: 'Message and sender are required' });
  }

  try {
    // Step 1: Check for non-admission queries first
    const nonAdmissionResponse = checkNonAdmissionQuery(message);
    if (nonAdmissionResponse) {        await admin.firestore().collection('faqs').add({
          question: message,
          answer: nonAdmissionResponse,
          frequency: 1,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Save to chat history
        await saveChatMessage(req.user.uid, message, nonAdmissionResponse);
        
        return res.json({ response: nonAdmissionResponse });
    }

    // Step 2: Check if this is a career/academic query (not admission-related)
    const isCareerAcademic = isCareerAcademicQuery(message);
    console.log('Is career/academic query:', isCareerAcademic);

    // Step 3: Extract program name using fuzzy search
    const extractedProgram = extractProgramName(message);
    console.log('Extracted program:', extractedProgram);

    // Step 4: Check if this is an admission-related query
    const isAdmissionRelated = isAdmissionQuery(message);
    console.log('Is admission related:', isAdmissionRelated);

    // Step 5: Handle career/academic queries about specific programs
    if (extractedProgram && isCareerAcademic) {
        console.log('Processing career/academic query about', extractedProgram);
        
        // Use GPT to answer career/academic questions with program context
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a knowledgeable academic advisor for KNUST. The user is asking about career opportunities, job prospects, or academic content related to ${extractedProgram}. Provide helpful, informative responses about:
                    - Career opportunities and job prospects
                    - Skills and knowledge gained from the program
                    - Industries and sectors graduates work in
                    - General academic content and what students learn
                    
                    Keep responses informative but concise. Focus on real-world applications and career paths.`
                },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 400
        });

        const response = completion.choices[0].message.content;
        
        await admin.firestore().collection('faqs').add({
            question: message,
            answer: response,
            frequency: 1,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Save to chat history
        const uid = req.user?.uid || req.body.sender || 'anonymous';
        await saveChatMessage(uid, message, response);
        
        return res.json({ response });
    }

    // Step 6: Handle program-specific admission queries
    // Step 6: Handle program-specific admission queries
    if (extractedProgram && isAdmissionRelated) {
      console.log('Processing program-specific admission query');
      const programData = getProgramData(extractedProgram);
      console.log('Program data found:', !!programData);
      
      if (programData) {
        // Generate response directly from dataset for admission queries
        let response = generateDatasetResponse(message, programData);
        console.log('Generated dataset response length:', response.length);
        
        // Add similar programs for recommendation queries
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('similar') || lowerMessage.includes('recommend') || lowerMessage.includes('like')) {
          const similarPrograms = findSimilarPrograms(programData.cutoff, 3, 4, extractedProgram);
          if (similarPrograms.length > 0) {
            response += `\n\n🔍 **Similar Programs (Cut-off ±3):**\n`;
            similarPrograms.forEach(program => {
              const programCutoff = getProgramData(program)?.cutoff;
              const cutoffText = programCutoff ? ` (Cut-off: ${programCutoff})` : '';
              response += `• ${program}${cutoffText}\n`;
            });
          }
        }
        
        // Check for eligibility questions
        if (lowerMessage.includes('can i pursue') || lowerMessage.includes('can i study') || lowerMessage.includes('eligible')) {
          const backgroundMatch = message.match(/(general arts|business|science|visual arts|home economics|technical|vocational)/i);
          if (backgroundMatch) {
            const eligibility = checkEligibilityByBackground(backgroundMatch[0], extractedProgram);
            if (eligibility) {
              response += `\n\n✅ **Eligibility Check:**\n`;
              response += eligibility.eligible 
                ? `Yes, you can pursue this program with your ${backgroundMatch[0]} background.\n`
                : `Your ${backgroundMatch[0]} background may not meet the specific subject requirements.\n`;
              
              response += `\n📚 **Required Subjects:**\n`;
              eligibility.requirements.forEach(req => {
                if (typeof req === 'string') {
                  response += `• ${req}\n`;
                } else if (Array.isArray(req)) {
                  response += `• Choose one: ${req.join(' OR ')}\n`;
                }
              });
            }
          }
        }
        
        await admin.firestore().collection('faqs').add({
          question: message,
          answer: response,
          frequency: 1,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Save to chat history
        const uid = req.user?.uid || req.body.sender || 'anonymous';
        await saveChatMessage(uid, message, response);
        
        return res.json({ response });
      }
    }

    // Step 7: Check if multiple programs match (ambiguous query)
    if (!extractedProgram && isAdmissionRelated) {
      const suggestions = suggestProgramMatches(message, 3);
      if (suggestions.length > 1) {
        const response = `I found multiple programs that might match your query. Did you mean one of these?\n\n${suggestions.map((program, index) => `${index + 1}. ${program}`).join('\n')}\n\nPlease specify which program you're interested in.`;
        
        await admin.firestore().collection('faqs').add({
          question: message,
          answer: response,
          frequency: 1,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Save to chat history
        const uid = req.user?.uid || req.body.sender || 'anonymous';
        await saveChatMessage(uid, message, response);
        
        return res.json({ response });
      }
    }

    // Step 8: Handle general queries with GPT but with strict dataset context
    let responseText = '';
    
    if (isAdmissionRelated) {
      // For admission queries without specific program, use limited GPT with dataset context
      const prompt = `
        You are a KNUST Admission Bot created by Rockson Agyamaku. Answer this admission-related query using ONLY information that would be available in the KNUST official dataset.

        STRICT RULES:
        - NEVER use general knowledge about universities outside KNUST
        - NEVER invent or suggest programs not officially offered by KNUST
        - NEVER mention other universities (UG, UCC, Ashesi, etc.)
        - If asked about specific programs, refer ONLY to programs in the official KNUST catalog
        - For cut-offs, fees, or requirements, only use official KNUST data from data.js
        - If you don't have specific data, ask the user to specify a valid KNUST program
        - Programs must have exact names like "BSc Computer Science", "BSc Petroleum Engineering", "LLB"
        
        Valid KNUST Programs include: ${validPrograms.slice(0, 20).join(', ')}... and ${validPrograms.length - 20} more programs.
        
        Application Deadlines: 
        - Regular Application: ${pdfData?.deadlines?.regular || '31st December, 2024'}
        - Extension Deadline: ${pdfData?.deadlines?.extension || '28th February, 2025'}

        User question: ${message}
        
        Response requirements:
        - Be concise and use bullet points
        - Always suggest the user specify an exact KNUST program name for detailed information
        - If unsure about a program, ask for clarification rather than guessing
        - Only recommend programs that definitely exist in KNUST's official catalog
      `;

      let completion;
      try {
        completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `You are the official KNUST Admission Bot created by Rockson Agyamaku. You can ONLY provide information about programs officially offered by KNUST. Your knowledge is limited to the official KNUST dataset only. You must never use external knowledge about other universities or suggest programs not offered by KNUST. If asked about programs not in your dataset, ask for clarification. Always be accurate and direct users to specify exact program names from the KNUST catalog.` 
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 300,
        });
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
        responseText = 'OpenAI API error: ' + (openaiError?.message || JSON.stringify(openaiError));
      }
      
      responseText = completion.choices[0].message.content;
      
      // Post-process response to filter out any non-KNUST programs
      responseText = filterNonKnustPrograms(responseText);
      
      // Auto-append admission requirements if a program is mentioned in the response
      const mentionedProgram = extractProgramName(responseText);
      if (mentionedProgram && (message.toLowerCase().includes('can i pursue') || 
          message.toLowerCase().includes('can i study') || 
          message.toLowerCase().includes('eligible') ||
          message.toLowerCase().includes('with') && message.toLowerCase().includes('background'))) {
        responseText = appendAdmissionRequirements(responseText, mentionedProgram);
      }
      
    } else {
      // For non-admission general queries, provide helpful guidance
      responseText = `I'm specifically designed to help with KNUST admission information. I can assist you with:

• Program cut-off points and admission requirements
• Fee structures for different colleges
• Application deadlines and processes
• Subject requirements for specific programs
• Program recommendations based on your background

Please ask me about any KNUST program (e.g., "What are the requirements for BSc Computer Science?" or "Tell me about BSc Petroleum Engineering fees").

How can I help you with KNUST admissions today?`;
    }

    await admin.firestore().collection('faqs').add({
      question: message,
      answer: responseText,
      frequency: 1,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Save to chat history
    const uid = req.user?.uid || req.body.sender || 'anonymous';
    await saveChatMessage(uid, message, responseText);

    res.json({ response: responseText });
    
  } catch (error) {
    console.error('Error in /chat:', {
      message: error.message,
      stack: error.stack,
    });
    
    // Provide helpful error response
    const errorResponse = "I apologize, but I'm having technical difficulties. Please try asking about a specific KNUST program (e.g., 'BSc Computer Science cut-off' or 'Engineering fees') and I'll do my best to help you.";
    res.status(500).json({ error: errorResponse });
  }
});

// Middleware to filter responses and ensure only KNUST programs are mentioned
function ensureDatasetOnly(req, res, next) {
    const originalJson = res.json;
    
    res.json = function(data) {
        if (data && data.response) {
            // Filter out any non-KNUST programs from the response
            data.response = filterNonKnustPrograms(data.response);
        }
        return originalJson.call(this, data);
    };
    
    next();
}

// Helper function to filter out non-KNUST programs from GPT responses
function filterNonKnustPrograms(responseText) {
    if (!responseText) return responseText;
    
    // List of common non-KNUST program keywords to filter out
    const nonKnustKeywords = [
        'University of Ghana', 'UG', 'Legon',
        'University of Cape Coast', 'UCC',
        'University for Development Studies', 'UDS',
        'Ashesi University', 'Central University',
        'Presbyterian University', 'Methodist University',
        'BSc Software Engineering', // KNUST doesn't offer this specific program
        'BSc Information Technology', // Not in KNUST list
        'BSc Cybersecurity', // Not in KNUST list
        'Bachelor of Information Technology',
        'Bachelor of Software Engineering'
    ];
    
    let filteredText = responseText;
    
    // Remove references to non-KNUST institutions
    nonKnustKeywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        filteredText = filteredText.replace(regex, '[KNUST equivalent program]');
    });
    
    // If response contains program recommendations, verify they exist in validPrograms
    const programMentions = filteredText.match(/(?:BSc|BA|BFA|BEd|LLB|PharmD|DVM|BDS|BHM|Doctor of)\s+[\w\s\/\(\)]+/gi);
    
    if (programMentions) {
        programMentions.forEach(mention => {
            const isValidKnustProgram = validPrograms.some(program => 
                program.toLowerCase().includes(mention.toLowerCase()) ||
                mention.toLowerCase().includes(program.toLowerCase())
            );
            
            if (!isValidKnustProgram) {
                // Replace with closest KNUST program or generic text
                const closestMatch = findProgramWithFuzzySearch(mention);
                if (closestMatch) {
                    filteredText = filteredText.replace(mention, closestMatch);
                } else {
                    filteredText = filteredText.replace(mention, '[KNUST program - please specify]');
                }
            }
        });
    }
    
    return filteredText;
}

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

// Enhanced Search programs with proper college filtering and fuzzy search
router.get('/programs/search', authenticateToken, async (req, res) => {
  try {
    const { query, college } = req.query;
    
    console.log('Search request:', { query, college });
    
    // Start with all valid programs from data.js
    let results = validPrograms.map(programName => {
      const programData = getProgramData(programName);
      return {
        name: programName,
        college: programData.college,
        cutoff: programData.cutoff,
        fees: programData.fees,
        requirements: programData.requirements
      };
    });

    console.log('Total programs before filtering:', results.length);

    // Filter by college first if specified
    if (college && college.trim() !== '') {
      const collegeFilter = college.toLowerCase().trim();
      results = results.filter(program => 
        program.college && program.college.toLowerCase().includes(collegeFilter)
      );
      console.log(`Programs after college filter "${college}":`, results.length);
    }

    // Then filter by search query if specified
    if (query && query.trim() !== '') {
      const searchQuery = query.toLowerCase().trim();
      
      // Use multiple search strategies for better results
      const exactMatches = results.filter(program => 
        program.name.toLowerCase().includes(searchQuery)
      );
      
      // Use fuzzy search for additional matches if exact matches are few
      let fuzzyMatches = [];
      if (exactMatches.length < 3) {
        const fuzzyResults = fuzzySearchPrograms(query, 10);
        fuzzyMatches = fuzzyResults
          .map(result => results.find(program => program.name === result.program))
          .filter(program => program && !exactMatches.some(exact => exact.name === program.name));
      }
      
      results = [...exactMatches, ...fuzzyMatches];
      console.log(`Programs after search query "${query}":`, results.length);
    }

    if (results.length === 0) {
      console.log('No programs match the criteria:', { query, college });
      return res.status(404).json({ 
        error: 'No programs found',
        message: 'Try adjusting your search terms or removing filters',
        searchCriteria: { query, college }
      });
    }

    // Sort results by relevance (exact matches first, then by cut-off)
    results.sort((a, b) => {
      if (query) {
        const aExact = a.name.toLowerCase().includes(query.toLowerCase());
        const bExact = b.name.toLowerCase().includes(query.toLowerCase());
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      return a.cutoff - b.cutoff; // Then by competitiveness
    });

    // Format response for mobile app
    const formattedResults = results.map(program => ({
      id: program.name.replace(/\s+/g, '_').toLowerCase(), // Create unique ID
      name: program.name,
      description: `A program offered by ${program.college} at KNUST.`,
      college: program.college,
      cutoff: program.cutoff,
      requirements: program.requirements ? 
        `Core: Mathematics, English, Science; Electives: ${
          Array.isArray(program.requirements) ? 
          program.requirements.map(req => 
            Array.isArray(req) ? req.join(' OR ') : req
          ).join(', ') : 
          'Please contact admissions'
        }` : 
        'Requirements not specified',
      fees: program.fees
    }));

    console.log('Returning', formattedResults.length, 'programs');

    res.json({ 
      results: formattedResults,
      total: formattedResults.length,
      searchCriteria: { query, college }
    });
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

// ============================================================================
// ADMIN PANEL ENDPOINTS
// ============================================================================

// Auth endpoints for admin panel
router.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In Firebase, tokens are stateless, so we just return success
    // In production, you might want to maintain a blacklist of tokens
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

router.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name || req.user.email,
      createdAt: req.user.createdAt
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// User management endpoints
router.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = admin.firestore().collection('users');
    
    if (search) {
      // Search by email or name
      query = query.where('email', '>=', search)
                   .where('email', '<=', search + '\uf8ff');
    }
    
    const snapshot = await query.limit(parseInt(limit)).offset(offset).get();
    const users = [];
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        email: userData.email || 'N/A',
        name: userData.name || userData.firstName && userData.lastName ? 
          `${userData.firstName} ${userData.lastName}` : userData.email || 'Unknown',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        role: userData.role || 'user',
        createdAt: userData.createdAt ? userData.createdAt.toDate().toISOString() : null,
        lastLogin: userData.lastLogin ? userData.lastLogin.toDate().toISOString() : null,
        loginCount: userData.loginCount || 0,
        isActive: userData.isActive !== false,
        updatedAt: userData.updatedAt ? userData.updatedAt.toDate().toISOString() : null
      });
    });
    
    // Get total count
    const totalSnapshot = await admin.firestore().collection('users').get();
    const total = totalSnapshot.size;
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await admin.firestore().collection('users').doc(id).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    res.json({
      id: userDoc.id,
      ...userData
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await admin.firestore().collection('users').doc(id).update(updateData);
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete user from Firebase Auth
    await admin.auth().deleteUser(id);
    
    // Delete user document from Firestore
    await admin.firestore().collection('users').doc(id).delete();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Dashboard analytics
router.get('/api/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get user count
    const usersSnapshot = await admin.firestore().collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    // Get chat count
    const chatsSnapshot = await admin.firestore().collection('chat_history').get();
    const totalChats = chatsSnapshot.size;
    
    // Get FAQ count
    const faqsSnapshot = await admin.firestore().collection('faqs').get();
    const totalFaqs = faqsSnapshot.size;
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentChatsSnapshot = await admin.firestore()
      .collection('chat_history')
      .where('timestamp', '>=', sevenDaysAgo)
      .get();
    const recentChats = recentChatsSnapshot.size;
    
    res.json({
      totalUsers,
      totalChats,
      totalFaqs,
      totalPrograms: validPrograms.length,
      recentChats,
      activeUsers: totalUsers // Simplified - could track active sessions
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Analytics endpoints
router.get('/api/analytics/popular-programs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get chat history and analyze for program mentions
    const chatsSnapshot = await admin.firestore().collection('chat_history').get();
    const programCounts = {};
    
    chatsSnapshot.forEach(doc => {
      const data = doc.data();
      const message = data.message?.toLowerCase() || '';
      
      // Count mentions of each program
      validPrograms.forEach(program => {
        if (message.includes(program.toLowerCase())) {
          programCounts[program] = (programCounts[program] || 0) + 1;
        }
      });
    });
    
    // Sort by popularity
    const popularPrograms = Object.entries(programCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, parseInt(limit))
      .map(([program, count]) => ({
        program,
        mentions: count,
        percentage: ((count / chatsSnapshot.size) * 100).toFixed(1)
      }));
    
    res.json({ popularPrograms });
  } catch (error) {
    console.error('Error fetching popular programs:', error);
    res.status(500).json({ error: 'Failed to fetch popular programs' });
  }
});

router.get('/api/analytics/usage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    
    const chatsSnapshot = await admin.firestore()
      .collection('chat_history')
      .where('timestamp', '>=', daysAgo)
      .orderBy('timestamp')
      .get();
    
    // Group by day
    const dailyUsage = {};
    chatsSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp?.toDate?.()?.toISOString?.()?.split('T')[0] || 'unknown';
      dailyUsage[date] = (dailyUsage[date] || 0) + 1;
    });
    
    const usageData = Object.entries(dailyUsage)
      .map(([date, count]) => ({ date, chats: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({
      period: parseInt(period),
      totalChats: chatsSnapshot.size,
      dailyUsage: usageData,
      averageDaily: (chatsSnapshot.size / parseInt(period)).toFixed(1)
    });
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    res.status(500).json({ error: 'Failed to fetch usage analytics' });
  }
});

// Chat monitoring
router.get('/api/chats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = admin.firestore().collection('chat_history').orderBy('timestamp', 'desc');
    
    if (userId) {
      query = query.where('uid', '==', userId);
    }
    
    const snapshot = await query.limit(parseInt(limit)).offset(offset).get();
    const chats = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!search || data.message?.toLowerCase().includes(search.toLowerCase())) {
        chats.push({
          id: doc.id,
          userId: data.uid,
          message: data.message,
          response: data.response,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null
        });
      }
    });
    
    res.json({
      chats: search ? chats.filter(chat => 
        chat.message?.toLowerCase().includes(search.toLowerCase())
      ) : chats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.get('/api/chats/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const chatDoc = await admin.firestore().collection('chat_history').doc(id).get();
    
    if (!chatDoc.exists) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const chatData = chatDoc.data();
    res.json({
      id: chatDoc.id,
      ...chatData,
      timestamp: chatData.timestamp?.toDate?.()?.toISOString() || null
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// System health check
router.get('/api/system/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        firestore: 'healthy',
        firebase_auth: 'healthy',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured'
      },
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024
      },
      uptime: process.uptime()
    };
    
    // Test Firestore connection
    try {
      await admin.firestore().collection('health_check').doc('test').set({ timestamp: new Date() });
      await admin.firestore().collection('health_check').doc('test').delete();
    } catch (firestoreError) {
      health.services.firestore = 'error';
      health.status = 'degraded';
    }
    
    res.json(health);
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to get system health' 
    });
  }
});

// Program management for admin
router.put('/api/programs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cutoff, college, requirements, fees } = req.body;
    
    // For now, return not implemented since programs are in data.js
    // In future, move programs to Firestore for dynamic updates
    res.status(501).json({ 
      error: 'Program updates not implemented yet',
      message: 'Programs are currently stored in data.js file. Future versions will support database updates.'
    });
  } catch (error) {
    console.error('Error updating program:', error);
    res.status(500).json({ error: 'Failed to update program' });
  }
});

router.get('/api/users/:id/chat-history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const snapshot = await admin.firestore()
      .collection('chat_history')
      .where('uid', '==', id)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit))
      .offset(offset)
      .get();
    
    const chats = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      chats.push({
        id: doc.id,
        message: data.message,
        response: data.response,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null
      });
    });
    
    res.json({
      chats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user chat history:', error);
    res.status(500).json({ error: 'Failed to fetch user chat history' });
  }
});

// =======================
// USER DATA MANAGEMENT ENDPOINTS
// =======================

// Fix/migrate existing user data - Force deployment update
router.post('/api/admin/users/fix-data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Starting user data migration...');
    
    const usersSnapshot = await admin.firestore().collection('users').get();
    let updatedCount = 0;
    
    const batch = admin.firestore().batch();
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const updates = {};
      
      // Add missing fields with default values
      if (!userData.role) updates.role = 'user';
      if (!userData.isActive) updates.isActive = true;
      if (!userData.name && userData.firstName && userData.lastName) {
        updates.name = `${userData.firstName} ${userData.lastName}`;
      }
      if (!userData.loginCount) updates.loginCount = 0;
      if (!userData.updatedAt) updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updatedCount++;
      }
    });
    
    await batch.commit();
    
    console.log(`✅ Updated ${updatedCount} user records`);
    res.json({ 
      message: 'User data migration completed successfully',
      updatedUsers: updatedCount,
      totalUsers: usersSnapshot.size
    });
  } catch (error) {
    console.error('Error fixing user data:', error);
    res.status(500).json({ error: 'Failed to fix user data' });
  }
});

// Get user login analytics
router.get('/api/analytics/user-logins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('lastLogin', '>=', daysAgo)
      .get();
    
    const loginData = {
      totalActiveUsers: usersSnapshot.size,
      period: parseInt(period),
      loginFrequency: {},
      averageLoginsPerUser: 0
    };
    
    let totalLogins = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const loginCount = userData.loginCount || 0;
      totalLogins += loginCount;
      
      // Group by login frequency
      if (loginCount === 0) {
        loginData.loginFrequency['never'] = (loginData.loginFrequency['never'] || 0) + 1;
      } else if (loginCount <= 5) {
        loginData.loginFrequency['1-5'] = (loginData.loginFrequency['1-5'] || 0) + 1;
      } else if (loginCount <= 20) {
        loginData.loginFrequency['6-20'] = (loginData.loginFrequency['6-20'] || 0) + 1;
      } else {
        loginData.loginFrequency['20+'] = (loginData.loginFrequency['20+'] || 0) + 1;
      }
    });
    
    loginData.averageLoginsPerUser = usersSnapshot.size > 0 ? 
      (totalLogins / usersSnapshot.size).toFixed(1) : 0;
    
    res.json(loginData);
  } catch (error) {
    console.error('Error fetching login analytics:', error);
    res.status(500).json({ error: 'Failed to fetch login analytics' });
  }
});

// Get user registration analytics
router.get('/api/analytics/user-registrations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('createdAt', '>=', daysAgo)
      .orderBy('createdAt')
      .get();
    
    // Group registrations by day
    const dailyRegistrations = {};
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const date = userData.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || 'unknown';
      dailyRegistrations[date] = (dailyRegistrations[date] || 0) + 1;
    });
    
    const registrationData = Object.entries(dailyRegistrations)
      .map(([date, count]) => ({ date, registrations: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({
      period: parseInt(period),
      totalNewUsers: usersSnapshot.size,
      dailyRegistrations: registrationData,
      averageDaily: (usersSnapshot.size / parseInt(period)).toFixed(1)
    });
  } catch (error) {
    console.error('Error fetching registration analytics:', error);
    res.status(500).json({ error: 'Failed to fetch registration analytics' });
  }
});

// Create user by admin
router.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'user' } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, firstName, and lastName are required' });
    }
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
    }
    
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false,
    });
    
    // Create user document in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      role,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
      loginCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.uid // Track who created this user
    });
    
    res.status(201).json({ 
      uid: userRecord.uid, 
      message: 'User created successfully by admin',
      user: {
        uid: userRecord.uid,
        email,
        name: `${firstName} ${lastName}`,
        role,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error creating user by admin:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Bulk user operations
router.post('/api/admin/users/bulk-action', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, userIds } = req.body;
    
    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'Action and userIds array are required' });
    }
    
    if (userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user ID is required' });
    }
    
    const results = {
      success: [],
      failed: [],
      total: userIds.length
    };
    
    for (const userId of userIds) {
      try {
        switch (action) {
          case 'activate':
            await admin.firestore().collection('users').doc(userId).update({
              isActive: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            results.success.push(userId);
            break;
            
          case 'deactivate':
            await admin.firestore().collection('users').doc(userId).update({
              isActive: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            results.success.push(userId);
            break;
            
          case 'delete':
            // Delete from Firebase Auth
            await admin.auth().deleteUser(userId);
            // Delete from Firestore
            await admin.firestore().collection('users').doc(userId).delete();
            results.success.push(userId);
            break;
            
          case 'make-admin':
            await admin.firestore().collection('users').doc(userId).update({
              role: 'admin',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            results.success.push(userId);
            break;
            
          case 'make-user':
            await admin.firestore().collection('users').doc(userId).update({
              role: 'user',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            results.success.push(userId);
            break;
            
          default:
            results.failed.push({ userId, error: 'Invalid action' });
        }
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }
    
    res.json({
      message: `Bulk ${action} completed`,
      results
    });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
});

module.exports = router;