const { 
    isAdmissionQuery, 
    isCareerAcademicQuery, 
    extractProgramName,
    getProgramData,
    generateDatasetResponse,
    checkNonAdmissionQuery
} = require('./chatbot-utils');

// Simulate the complete chat endpoint logic
async function simulateChatEndpoint(message) {
    console.log(`\n🤖 Processing: "${message}"`);
    console.log("─".repeat(60));

    // Step 1: Check for non-admission queries first
    const nonAdmissionResponse = checkNonAdmissionQuery(message);
    if (nonAdmissionResponse) {
        console.log("✅ Step 1: Non-admission hardcoded response");
        console.log("📤 Response:", nonAdmissionResponse);
        return;
    }

    // Step 2: Check if this is a career/academic query
    const isCareerAcademic = isCareerAcademicQuery(message);
    console.log(`📊 Step 2: Career/academic query: ${isCareerAcademic}`);

    // Step 3: Extract program name
    const extractedProgram = extractProgramName(message);
    console.log(`🎯 Step 3: Extracted program: ${extractedProgram}`);

    // Step 4: Check if this is an admission-related query
    const isAdmissionRelated = isAdmissionQuery(message);
    console.log(`📋 Step 4: Admission query: ${isAdmissionRelated}`);

    // Step 5: Handle career/academic queries about specific programs
    if (extractedProgram && isCareerAcademic) {
        console.log("✅ Step 5: Career/academic query about specific program");
        console.log("🤖 Would use GPT for career information about", extractedProgram);
        console.log("📤 Response: [GPT-generated career information]");
        return;
    }

    // Step 6: Handle program-specific admission queries
    if (extractedProgram && isAdmissionRelated) {
        console.log("✅ Step 6: Program-specific admission query");
        const programData = getProgramData(extractedProgram);
        if (programData) {
            const response = generateDatasetResponse(message, programData);
            console.log("📊 Using dataset response");
            console.log("📤 Response:", response.substring(0, 200) + "...");
            return;
        }
    }

    // Step 7: Handle general queries
    if (isAdmissionRelated) {
        console.log("✅ Step 7: General admission query");
        console.log("🤖 Would use GPT with strict dataset context");
    } else {
        console.log("✅ Step 7: General non-admission query");
        console.log("📤 Would provide helpful guidance");
    }
}

// Test the problematic scenarios
async function runTests() {
    console.log("🧪 TESTING COMPLETE CHAT LOGIC");
    console.log("=".repeat(80));

    const testCases = [
        "What are some of the career opportunities in computer science?", // Should be career GPT
        "What is the cut-off for Computer Science?", // Should be dataset
        "Tell me about computer science program", // Should be career GPT
        "Computer Science fees", // Should be dataset
        "Hello", // Should be hardcoded
        "Who created you?", // Should be hardcoded
        "What programs does KNUST offer?", // Should be general admission GPT
        "How do I apply to KNUST?" // Should be general admission GPT
    ];

    for (const testCase of testCases) {
        await simulateChatEndpoint(testCase);
    }
}

runTests();
