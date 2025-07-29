const Fuse = require('fuse.js');
const { validPrograms, cutOffAggregates, collegeFees, electiveRequirements, programToCollege } = require('./data');

// Keywords that indicate admission-related queries that must use dataset only
const ADMISSION_KEYWORDS = [
    'cut off', 'cutoff', 'cut-off', 'aggregate', 'requirements', 'admission', 'fees', 'fee',
    'college of science', 'college of engineering', 'college of agriculture', 'college of health', 
    'college of humanities', 'college of art', 'bsc', 'ba', 'llb', 'pharmd', 'dvm', 'bds', 
    'bhm', 'bfa', 'bed', 'doctor of', 'electives', 'subjects', 'shs', 'wassce', 'novdec', 
    'entry', 'apply', 'application', 'qualify', 'eligible', 'eligibility'
];

// Keywords that indicate career/academic questions (not admission-related)
const CAREER_ACADEMIC_KEYWORDS = [
    'career', 'careers', 'job', 'jobs', 'employment', 'work', 'profession', 'professional',
    'opportunities', 'opportunity', 'future', 'prospects', 'salary', 'income', 'earning',
    'what can i do with', 'what can you do with', 'field', 'industry', 'sector',
    'graduate', 'after graduation', 'course content', 'curriculum', 'modules', 'subjects covered',
    'learn', 'study', 'taught', 'skills', 'knowledge', 'about the program', 'about the course',
    'tell me about', 'describe', 'explain', 'overview', 'introduction to'
];

// Non-admission queries that should have hardcoded responses
const NON_ADMISSION_QUERIES = [
    {
        patterns: [/who created you/i, /who made you/i, /who built you/i, /who developed you/i],
        response: "I was created by Rockson Agyamaku to assist with KNUST admission information."
    },
    {
        patterns: [/what are you/i, /who are you/i],
        response: "I am a KNUST Admission Bot created by Rockson Agyamaku to help prospective students with admission information, program details, and requirements."
    },
    {
        patterns: [/hello/i, /hi/i, /hey/i, /good morning/i, /good afternoon/i, /good evening/i],
        response: "Hello! I'm here to help you with KNUST admission information. You can ask me about program cut-offs, fees, admission requirements, or any other admission-related questions."
    }
];

// Initialize fuzzy search for programs
const fuseOptions = {
    keys: ['name'],
    threshold: 0.4, // Lower = more strict matching
    distance: 100,
    includeScore: true
};

const programFuse = new Fuse(
    validPrograms.map(program => ({ name: program })),
    fuseOptions
);

/**
 * Check if a query is about career/academic content (not admission-related)
 */
function isCareerAcademicQuery(query) {
    const lowerQuery = query.toLowerCase();
    return CAREER_ACADEMIC_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Check if a query is admission-related and should use dataset only
 * Now excludes career/academic questions even if they mention programs
 */
function isAdmissionQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // First check if it's a career/academic question
    if (isCareerAcademicQuery(query)) {
        return false;
    }
    
    // Then check for admission keywords
    return ADMISSION_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Check for non-admission queries and return hardcoded response if found
 */
function checkNonAdmissionQuery(query) {
    for (const queryType of NON_ADMISSION_QUERIES) {
        for (const pattern of queryType.patterns) {
            if (pattern.test(query)) {
                return queryType.response;
            }
        }
    }
    return null;
}

/**
 * Fuzzy search for program names
 */
function fuzzySearchPrograms(query, maxResults = 5) {
    const results = programFuse.search(query);
    return results
        .slice(0, maxResults)
        .map(result => ({
            program: result.item.name,
            score: result.score
        }));
}

/**
 * Find program with fuzzy matching
 */
function findProgramWithFuzzySearch(query) {
    // First try exact match
    const exactMatch = validPrograms.find(program => 
        program.toLowerCase() === query.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Then try fuzzy search
    const fuzzyResults = fuzzySearchPrograms(query, 1);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.3) {
        return fuzzyResults[0].program;
    }

    return null;
}

/**
 * Suggest multiple program matches if query is ambiguous
 */
function suggestProgramMatches(query, maxSuggestions = 3) {
    const fuzzyResults = fuzzySearchPrograms(query, maxSuggestions * 2);
    
    // Filter for reasonable matches (score < 0.6)
    const goodMatches = fuzzyResults.filter(result => result.score < 0.6);
    
    if (goodMatches.length > 1) {
        return goodMatches.slice(0, maxSuggestions).map(result => result.program);
    }
    
    return [];
}

/**
 * Special case handling for common program names
 */
function handleSpecialCases(query) {
    query = query.toLowerCase();
    
    // Special case for Computer Science
    if ((query.includes('computer') && query.includes('science')) || 
        (query.includes('computer') && query.includes('program'))) {
        return 'BSc Computer Science';
    }
    
    return null;
}

/**
 * Extract program name from user query with improved logic
 */
function extractProgramName(message) {
    // First check for special cases
    const specialCase = handleSpecialCases(message);
    if (specialCase) {
        return specialCase;
    }
    
    // Check if any program name is directly in the message
    for (const program of validPrograms) {
        if (message.toLowerCase().includes(program.toLowerCase())) {
            return program;
        }
    }
    
    // Try with just the program name portion (without BSc, BA, etc.)
    for (const program of validPrograms) {
        const nameParts = program.split(' ');
        if (nameParts.length > 1) {
            const withoutPrefix = nameParts.slice(1).join(' ');
            if (message.toLowerCase().includes(withoutPrefix.toLowerCase())) {
                return program;
            }
        }
    }
    
    // Use fuzzy search as last resort
    const results = fuzzySearchPrograms(message, 3);
    if (results.length > 0 && results[0].score < 0.3) {
        return results[0].program;
    }
    
    return null;
}

/**
 * Get program data from the dataset
 */
function getProgramData(programName) {
    if (!programName) return null;
    
    // Check for special cases first
    const specialCase = handleSpecialCases(programName);
    if (specialCase) {
        programName = specialCase;
    }
    
    // Try exact match first
    let match = validPrograms.find(p => p === programName);
    
    // If no exact match, try case-insensitive match
    if (!match) {
        match = validPrograms.find(p => p.toLowerCase() === programName.toLowerCase());
    }
    
    // If still no match, try partial match for programs like "Computer Science" without the "BSc"
    if (!match) {
        for (const program of validPrograms) {
            const nameParts = program.split(' ');
            if (nameParts.length > 1) {
                const withoutPrefix = nameParts.slice(1).join(' ');
                if (programName.toLowerCase() === withoutPrefix.toLowerCase()) {
                    match = program;
                    break;
                }
            }
        }
    }
    
    if (!match) return null;
    
    const college = programToCollege[match];
    const cutoff = cutOffAggregates[match];
    const fees = collegeFees[college];
    const requirements = electiveRequirements[match];
    
    return {
        name: match,
        college,
        cutoff,
        fees,
        requirements
    };
}

/**
 * Find programs with similar cut-offs for recommendations
 */
function findSimilarPrograms(targetCutoff, tolerance = 3, maxResults = 4, excludeProgram = null) {
    if (!targetCutoff || typeof targetCutoff !== 'number') return [];

    const similarPrograms = [];
    
    for (const [program, cutoff] of Object.entries(cutOffAggregates)) {
        if (typeof cutoff === 'number' && 
            Math.abs(cutoff - targetCutoff) <= tolerance &&
            program !== excludeProgram) {
            similarPrograms.push({
                name: program,
                cutoff: cutoff,
                difference: Math.abs(cutoff - targetCutoff)
            });
        }
    }

    return similarPrograms
        .sort((a, b) => a.difference - b.difference)
        .slice(0, maxResults)
        .map(p => p.name);
}

/**
 * Generate response directly from dataset (bypass GPT)
 */
function generateDatasetResponse(query, programData) {
    const lowerQuery = query.toLowerCase();
    
    // Cut-off specific queries
    if (lowerQuery.includes('cut off') || lowerQuery.includes('cutoff') || lowerQuery.includes('aggregate')) {
        let response = `**${programData.name}**\n\n`;
        response += `🎯 **Cut-off Point:** ${programData.cutoff}\n`;
        response += `🏫 **College:** ${programData.college}\n\n`;
        
        if (programData.requirements) {
            response += `📚 **Required SHS Subjects:**\n`;
            if (Array.isArray(programData.requirements)) {
                programData.requirements.forEach(req => {
                    if (typeof req === 'string') {
                        response += `• ${req}\n`;
                    } else if (Array.isArray(req)) {
                        response += `• Choose one: ${req.join(' OR ')}\n`;
                    }
                });
            }
        }
        
        return response;
    }
    
    // Fees specific queries
    if (lowerQuery.includes('fee') && programData.fees) {
        let response = `**${programData.name} - Fees**\n\n`;
        response += `💰 **Regular Freshers:** GHS ${programData.fees.regular_freshers}\n`;
        response += `💰 **Fee-Paying Freshers:** GHS ${programData.fees.fee_paying_freshers}\n`;
        response += `🏠 **Residential Freshers:** GHS ${programData.fees.residential_freshers}\n`;
        return response;
    }
    
    // Requirements specific queries
    if (lowerQuery.includes('requirement') || lowerQuery.includes('subject') || lowerQuery.includes('elective')) {
        let response = `**${programData.name} - Admission Requirements**\n\n`;
        response += `🎯 **Cut-off Point:** ${programData.cutoff}\n\n`;
        
        if (programData.requirements) {
            response += `📚 **Required SHS Subjects:**\n`;
            if (Array.isArray(programData.requirements)) {
                programData.requirements.forEach(req => {
                    if (typeof req === 'string') {
                        response += `• ${req}\n`;
                    } else if (Array.isArray(req)) {
                        response += `• Choose one: ${req.join(' OR ')}\n`;
                    }
                });
            }
        }
        
        return response;
    }
    
    // General program info
    let response = `**${programData.name}**\n\n`;
    response += `🎯 **Cut-off Point:** ${programData.cutoff}\n`;
    response += `🏫 **College:** ${programData.college}\n\n`;
    
    if (programData.fees) {
        response += `💰 **Fees:**\n`;
        response += `• Regular Freshers: GHS ${programData.fees.regular_freshers}\n`;
        response += `• Fee-Paying Freshers: GHS ${programData.fees.fee_paying_freshers}\n`;
        response += `• Residential Freshers: GHS ${programData.fees.residential_freshers}\n\n`;
    }
    
    if (programData.requirements) {
        response += `📚 **Required SHS Subjects:**\n`;
        if (Array.isArray(programData.requirements)) {
            programData.requirements.forEach(req => {
                if (typeof req === 'string') {
                    response += `• ${req}\n`;
                } else if (Array.isArray(req)) {
                    response += `• Choose one: ${req.join(' OR ')}\n`;
                }
            });
        }
    }
    
    return response;
}

/**
 * Check if user background matches program requirements
 */
function checkEligibilityByBackground(userBackground, programName) {
    const requirements = electiveRequirements[programName];
    if (!requirements) return null;
    
    const lowerBackground = userBackground.toLowerCase();
    let isEligible = false;
    let matchedSubjects = [];
    
    // Check if user background contains required subjects
    for (const req of requirements) {
        if (typeof req === 'string') {
            if (lowerBackground.includes(req.toLowerCase())) {
                isEligible = true;
                matchedSubjects.push(req);
            }
        } else if (Array.isArray(req)) {
            for (const subject of req) {
                if (lowerBackground.includes(subject.toLowerCase())) {
                    isEligible = true;
                    matchedSubjects.push(subject);
                    break;
                }
            }
        }
    }
    
    return {
        eligible: isEligible,
        matchedSubjects: matchedSubjects,
        requirements: requirements
    };
}

/**
 * Auto-append admission requirements for guidance queries
 */
function appendAdmissionRequirements(response, programName) {
    if (!programName) return response;
    
    const programData = getProgramData(programName);
    if (!programData) return response;
    
    let appendedResponse = response;
    
    // Add cut-off and requirements if not already in response
    if (!response.toLowerCase().includes('cut-off') && !response.toLowerCase().includes('cutoff')) {
        appendedResponse += `\n\n📋 **${programName} - Admission Details:**\n`;
        appendedResponse += `🎯 **Cut-off Point:** ${programData.cutoff}\n`;
        appendedResponse += `🏫 **College:** ${programData.college}\n`;
        
        if (programData.requirements) {
            appendedResponse += `\n📚 **Required SHS Subjects:**\n`;
            if (Array.isArray(programData.requirements)) {
                programData.requirements.forEach(req => {
                    if (typeof req === 'string') {
                        appendedResponse += `• ${req}\n`;
                    } else if (Array.isArray(req)) {
                        appendedResponse += `• Choose one: ${req.join(' OR ')}\n`;
                    }
                });
            }
        }
        
        if (programData.fees) {
            appendedResponse += `\n💰 **Fees:**\n`;
            appendedResponse += `• Regular Freshers: GHS ${programData.fees.regular_freshers}\n`;
            appendedResponse += `• Fee-Paying Freshers: GHS ${programData.fees.fee_paying_freshers}\n`;
        }
    }
    
    return appendedResponse;
}

/**
 * Save chat message to Firestore for chat history
 */
async function saveChatMessage(uid, message, response) {
    const admin = require('firebase-admin');
    await admin.firestore().collection('chat_history').add({
        uid,
        message,
        response,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}

module.exports = {
    isAdmissionQuery,
    isCareerAcademicQuery,
    checkNonAdmissionQuery,
    fuzzySearchPrograms,
    findProgramWithFuzzySearch,
    suggestProgramMatches,
    extractProgramName,
    handleSpecialCases,
    getProgramData,
    findSimilarPrograms,
    generateDatasetResponse,
    checkEligibilityByBackground,
    appendAdmissionRequirements,
    saveChatMessage,
    ADMISSION_KEYWORDS,
    CAREER_ACADEMIC_KEYWORDS
};
