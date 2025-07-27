const { 
    isAdmissionQuery, 
    isCareerAcademicQuery, 
    extractProgramName 
} = require('./chatbot-utils');

// Test queries
const testQueries = [
    "What is the cut-off for Computer Science?", // Should be admission query
    "What are some of the career opportunities in computer science?", // Should be career query
    "Tell me about computer science program", // Should be career query
    "Computer Science fees", // Should be admission query
    "What can I do with BSc Computer Science degree?", // Should be career query
    "BSc Computer Science admission requirements", // Should be admission query
];

console.log("=== TESTING IMPROVED QUERY CLASSIFICATION ===\n");

testQueries.forEach(query => {
    console.log(`Query: "${query}"`);
    console.log(`  - Is admission query: ${isAdmissionQuery(query)}`);
    console.log(`  - Is career/academic query: ${isCareerAcademicQuery(query)}`);
    console.log(`  - Extracted program: ${extractProgramName(query)}`);
    console.log("");
});
