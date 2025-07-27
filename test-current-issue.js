const { 
    extractProgramName, 
    getProgramData, 
    handleSpecialCases,
    isAdmissionQuery,
    generateDatasetResponse 
} = require('./chatbot-utils');

// Test the exact queries that are failing
const testQueries = [
    "What is the cut-off for Computer Science?",
    "Tell me about computer science program"
];

console.log("=== TESTING CURRENT ISSUE ===");

testQueries.forEach(query => {
    console.log(`\nQuery: "${query}"`);
    console.log("Is admission query:", isAdmissionQuery(query));
    
    const specialCase = handleSpecialCases(query);
    console.log("Special case result:", specialCase);
    
    const extractedProgram = extractProgramName(query);
    console.log("Extracted program:", extractedProgram);
    
    if (extractedProgram) {
        const programData = getProgramData(extractedProgram);
        console.log("Program data:", programData);
        
        if (programData) {
            const response = generateDatasetResponse(query, extractedProgram, programData);
            console.log("Generated response:", response.substring(0, 200) + "...");
        }
    }
});
