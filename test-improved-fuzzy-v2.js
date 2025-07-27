const Fuse = require('fuse.js');
const { validPrograms, cutOffAggregates } = require('./data');

// Initialize fuzzy search for programs
const fuseOptions = {
    keys: ['name'],
    threshold: 0.4, // More strict matching
    distance: 100, 
    includeScore: true
};

const programFuse = new Fuse(
    validPrograms.map(program => ({ name: program })),
    fuseOptions
);

/**
 * Improved fuzzy search for program names
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
function extractProgramFromQuery(message) {
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
    const fuzzyResults = fuzzySearchPrograms(message, 3);
    if (fuzzyResults.length > 0) {
        // Show fuzzy results for debugging
        console.log("Fuzzy results:", fuzzyResults);
        
        // More strict threshold for accepting fuzzy results
        if (fuzzyResults[0].score < 0.3) {
            return fuzzyResults[0].program;
        }
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
        const specialData = cutOffAggregates[specialCase];
        if (specialData) {
            return {
                name: specialCase,
                cutoff: specialData
            };
        }
    }
    
    // Try exact match
    let match = validPrograms.find(p => p === programName);
    
    // If no exact match, try case-insensitive match
    if (!match) {
        match = validPrograms.find(p => p.toLowerCase() === programName.toLowerCase());
    }
    
    // If no match found, return null
    if (!match) return null;
    
    const cutoff = cutOffAggregates[match];
    return {
        name: match,
        cutoff
    };
}

// Test queries
const queries = [
    "what is the cut-off for Computer Science",
    "Computer Science cutoff",
    "BSc Computer Science",
    "Computer Science",
    "I want to apply for Computer Science",
    "Tell me about the cut off for computer science",
    "Is the aggregate for computer science 7?",
    "computer science requirements"
];

console.log("=== TESTING IMPROVED PROGRAM EXTRACTION ===");
queries.forEach(query => {
    console.log(`\nQuery: "${query}"`);
    
    // Test improved extraction
    const extractedProgram = extractProgramFromQuery(query);
    console.log("Extracted Program:", extractedProgram);
    
    // Test program data lookup
    if (extractedProgram) {
        const programData = getProgramData(extractedProgram);
        console.log("Program Data:", programData);
    }
});
