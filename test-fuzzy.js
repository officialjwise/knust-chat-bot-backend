const Fuse = require('fuse.js');
const { validPrograms, cutOffAggregates } = require('./data');

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
 * Extract program name from user query
 */
function extractProgramName(message) {
    // Use fuzzy search on the whole message
    const results = fuzzySearchPrograms(message, 1);
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
    // Find exact match, case-insensitive
    const match = validPrograms.find(p => p.toLowerCase() === programName.toLowerCase());
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
    "I want to apply for Computer Science"
];

console.log("=== TESTING FUZZY SEARCH FOR COMPUTER SCIENCE ===");
queries.forEach(query => {
    console.log(`\nQuery: "${query}"`);
    
    // Test fuzzy search
    const fuzzyResults = fuzzySearchPrograms(query, 3);
    console.log("Fuzzy Search Results:", fuzzyResults);
    
    // Test program extraction
    const extractedProgram = extractProgramName(query);
    console.log("Extracted Program:", extractedProgram);
    
    // Test program data lookup
    if (extractedProgram) {
        const programData = getProgramData(extractedProgram);
        console.log("Program Data:", programData);
    }
});

// Test direct program lookup
console.log("\n=== TESTING DIRECT PROGRAM LOOKUP ===");
const directProgram = "BSc Computer Science";
const directData = getProgramData(directProgram);
console.log(`Direct lookup for "${directProgram}":`, directData);
