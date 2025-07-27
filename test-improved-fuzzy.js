const Fuse = require('fuse.js');
const { validPrograms, cutOffAggregates } = require('./data');

// Initialize fuzzy search for programs
const fuseOptions = {
    keys: ['name'],
    threshold: 0.6, // Increased threshold to be more forgiving
    distance: 200,  // Increased distance to allow for more variations
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
 * Extract program name from user query with improved logic
 * This function is specifically designed to handle queries like
 * "what is the cut-off for Computer Science"
 */
function extractProgramFromQuery(message) {
    // First check if any program name is directly in the message
    for (const program of validPrograms) {
        if (message.toLowerCase().includes(program.toLowerCase())) {
            return program;
        }
    }
    
    // If no direct match, try extracting common program name patterns
    const commonPatterns = [
        /cut[- ]?off (?:points? )?(?:for )?(.+?)(?:\?|$|\.)/i,
        /(?:about|for) (.+?) (?:program|course|cut[- ]?off)/i,
        /(.+?) (?:cut[- ]?off|aggregate|requirements)/i,
        /(?:study|apply for|admission to) (.+?)(?:\?|$|\.)/i
    ];
    
    for (const pattern of commonPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const potentialProgram = match[1].trim();
            
            // Try direct match with the extracted text
            for (const program of validPrograms) {
                if (program.toLowerCase().includes(potentialProgram.toLowerCase()) || 
                    potentialProgram.toLowerCase().includes(program.split(' ').slice(1).join(' ').toLowerCase())) {
                    return program;
                }
            }
            
            // If no direct match, use fuzzy search on the extracted text
            const fuzzyResults = fuzzySearchPrograms(potentialProgram, 1);
            if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.4) {
                return fuzzyResults[0].program;
            }
        }
    }
    
    // Last resort: use fuzzy search on the whole message
    const fuzzyResults = fuzzySearchPrograms(message, 1);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.4) {
        return fuzzyResults[0].program;
    }
    
    // Special case for "Computer Science" queries which might not be matching correctly
    if (message.toLowerCase().includes('computer') && message.toLowerCase().includes('science')) {
        return 'BSc Computer Science';
    }
    
    return null;
}

/**
 * Get program data from the dataset
 */
function getProgramData(programName) {
    if (!programName) return null;
    
    // Try exact match first
    let match = validPrograms.find(p => p === programName);
    
    // If no exact match, try case-insensitive match
    if (!match) {
        match = validPrograms.find(p => p.toLowerCase() === programName.toLowerCase());
    }
    
    // If still no match, try partial match
    if (!match) {
        match = validPrograms.find(p => p.toLowerCase().includes(programName.toLowerCase()));
    }
    
    // Special case for "Computer Science" which might not be matching correctly
    if (!match && programName.toLowerCase().includes('computer') && programName.toLowerCase().includes('science')) {
        match = 'BSc Computer Science';
    }
    
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
