const { 
    extractProgramName, 
    getProgramData, 
    handleSpecialCases,
    isAdmissionQuery,
    generateDatasetResponse 
} = require('./chatbot-utils');

// Test with the exact function signature
const query = "What is the cut-off for Computer Science?";
const extractedProgram = extractProgramName(query);
const programData = getProgramData(extractedProgram);

console.log("Query:", query);
console.log("Extracted program:", extractedProgram);
console.log("Program data:", programData);

// Test calling generateDatasetResponse with correct parameters
if (programData) {
    console.log("\n=== Testing generateDatasetResponse ===");
    const response = generateDatasetResponse(query, programData);
    console.log("Response:", response);
}
