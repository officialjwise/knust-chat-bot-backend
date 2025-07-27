// Test script for the enhanced chatbot functionality
const {
    isAdmissionQuery,
    checkNonAdmissionQuery,
    fuzzySearchPrograms,
    findProgramWithFuzzySearch,
    suggestProgramMatches,
    extractProgramName,
    getProgramData,
    findSimilarPrograms,
    generateDatasetResponse,
    checkEligibilityByBackground
} = require('./chatbot-utils');

console.log('🧪 Testing Enhanced KNUST Chatbot Functionality\n');

// Test 1: Non-admission queries
console.log('1. Testing non-admission query detection:');
const testQueries1 = [
    'Who created you?',
    'What are you?',
    'Hello',
    'BSc Computer Science cut off',
    'Engineering fees'
];

testQueries1.forEach(query => {
    const response = checkNonAdmissionQuery(query);
    console.log(`Query: "${query}" → ${response ? 'Non-admission' : 'Admission-related'}`);
});

console.log('\n2. Testing admission query detection:');
testQueries1.forEach(query => {
    const isAdmission = isAdmissionQuery(query);
    console.log(`Query: "${query}" → ${isAdmission ? 'Admission query' : 'Not admission query'}`);
});

// Test 2: Fuzzy search
console.log('\n3. Testing fuzzy search:');
const testQueries2 = [
    'computer science',
    'petroleum',
    'civil eng',
    'economics',
    'law',
    'nursing'
];

testQueries2.forEach(query => {
    const results = fuzzySearchPrograms(query, 3);
    console.log(`Query: "${query}"`);
    results.forEach(result => {
        console.log(`  → ${result.program} (score: ${result.score.toFixed(3)})`);
    });
});

// Test 3: Program extraction
console.log('\n4. Testing program name extraction:');
const testQueries3 = [
    'What is the cut off for BSc Computer Science?',
    'Tell me about petroleum engineering fees',
    'I want to study civil engineering',
    'Can I pursue economics with general arts?',
    'Law requirements'
];

testQueries3.forEach(query => {
    const extracted = extractProgramName(query);
    console.log(`Query: "${query}" → ${extracted || 'No program found'}`);
});

// Test 4: Program suggestions
console.log('\n5. Testing program suggestions:');
const testQueries4 = [
    'computer',
    'engineer',
    'business'
];

testQueries4.forEach(query => {
    const suggestions = suggestProgramMatches(query, 3);
    console.log(`Query: "${query}" → Suggestions: ${suggestions.join(', ') || 'None'}`);
});

// Test 5: Similar programs
console.log('\n6. Testing similar programs:');
const testProgram = 'BSc Computer Science';
const programData = getProgramData(testProgram);
if (programData) {
    const similar = findSimilarPrograms(programData.cutoff, 3, 4, testProgram);
    console.log(`Similar to ${testProgram} (cutoff ${programData.cutoff}):`);
    similar.forEach(program => {
        const data = getProgramData(program);
        console.log(`  → ${program} (cutoff: ${data?.cutoff})`);
    });
}

// Test 6: Dataset response generation
console.log('\n7. Testing dataset response generation:');
if (programData) {
    const response = generateDatasetResponse('What is the cut off for BSc Computer Science?', programData);
    console.log('Generated response:');
    console.log(response);
}

console.log('\n✅ Testing completed!');
