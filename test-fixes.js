const {
    extractProgramName,
    getProgramData,
    handleSpecialCases,
    fuzzySearchPrograms
} = require('./chatbot-utils');

// Test queries for Computer Science
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

console.log("=== TESTING FIXED COMPUTER SCIENCE EXTRACTION ===");
queries.forEach(query => {
    console.log(`\nQuery: "${query}"`);
    
    // Test extraction
    const extractedProgram = extractProgramName(query);
    console.log("Extracted Program:", extractedProgram);
    
    // Test program data lookup
    if (extractedProgram) {
        const programData = getProgramData(extractedProgram);
        console.log("Program Data:", JSON.stringify(programData, null, 2));
    }
});
