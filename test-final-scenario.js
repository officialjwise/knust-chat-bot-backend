const express = require('express');
const { 
    isAdmissionQuery, 
    isCareerAcademicQuery, 
    extractProgramName,
    getProgramData,
    generateDatasetResponse
} = require('./chatbot-utils');

// Test the exact scenario that was failing
const testMessage = "What are some of the career opportunities in computer science?";

console.log("=== TESTING CAREER QUERY SCENARIO ===");
console.log(`Query: "${testMessage}"\n`);

// Step 1: Check query classification
console.log("1. Query Classification:");
const isCareer = isCareerAcademicQuery(testMessage);
const isAdmission = isAdmissionQuery(testMessage);
const extractedProgram = extractProgramName(testMessage);

console.log(`   - Is career/academic query: ${isCareer}`);
console.log(`   - Is admission query: ${isAdmission}`);
console.log(`   - Extracted program: ${extractedProgram}`);

// Step 2: Test the flow logic
console.log("\n2. Expected Flow:");
if (extractedProgram && isCareer) {
    console.log("   ✅ Should use GPT for career information about", extractedProgram);
    console.log("   ❌ Should NOT return dataset cut-off information");
} else if (extractedProgram && isAdmission) {
    console.log("   ✅ Should return dataset information");
    const programData = getProgramData(extractedProgram);
    if (programData) {
        console.log("   📊 Program data available:", programData.name);
        const response = generateDatasetResponse(testMessage, programData);
        console.log("   📝 Generated response preview:", response.substring(0, 100) + "...");
    }
} else {
    console.log("   ⚠️  Unexpected flow - check logic");
}

console.log("\n3. Test Result:");
if (isCareer && !isAdmission && extractedProgram) {
    console.log("   ✅ PASS: Query correctly classified as career question");
    console.log("   ✅ PASS: Should trigger GPT career response, not dataset response");
} else {
    console.log("   ❌ FAIL: Query classification needs adjustment");
}

// Test admission query for comparison
console.log("\n" + "=".repeat(50));
const admissionMessage = "What is the cut-off for Computer Science?";
console.log(`\nComparison - Admission Query: "${admissionMessage}"`);

const isCareer2 = isCareerAcademicQuery(admissionMessage);
const isAdmission2 = isAdmissionQuery(admissionMessage);
const extractedProgram2 = extractProgramName(admissionMessage);

console.log(`   - Is career/academic query: ${isCareer2}`);
console.log(`   - Is admission query: ${isAdmission2}`);
console.log(`   - Extracted program: ${extractedProgram2}`);

if (!isCareer2 && isAdmission2 && extractedProgram2) {
    console.log("   ✅ PASS: Admission query correctly classified");
} else {
    console.log("   ❌ FAIL: Admission query classification needs adjustment");
}
