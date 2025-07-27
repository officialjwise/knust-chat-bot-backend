const { 
    fuzzySearchPrograms, 
    getProgramData 
} = require('./chatbot-utils');
const { validPrograms } = require('./data');

// Test the new search logic
function testSearch(query, college) {
    console.log(`\n🔍 Testing search: query="${query}", college="${college}"`);
    console.log("=".repeat(60));
    
    // Start with all valid programs
    let results = validPrograms.map(programName => {
        const programData = getProgramData(programName);
        return {
            name: programName,
            college: programData.college,
            cutoff: programData.cutoff
        };
    });

    console.log(`📊 Total programs: ${results.length}`);

    // Filter by college first if specified
    if (college && college.trim() !== '') {
        const collegeFilter = college.toLowerCase().trim();
        results = results.filter(program => 
            program.college && program.college.toLowerCase().includes(collegeFilter)
        );
        console.log(`📚 After college filter "${college}": ${results.length} programs`);
        
        // Show which colleges matched
        const matchedColleges = [...new Set(results.map(p => p.college))];
        console.log(`   Matched colleges: ${matchedColleges.join(', ')}`);
    }

    // Then filter by search query if specified
    if (query && query.trim() !== '') {
        const searchQuery = query.toLowerCase().trim();
        
        // Exact matches
        const exactMatches = results.filter(program => 
            program.name.toLowerCase().includes(searchQuery)
        );
        
        console.log(`🎯 Exact matches for "${query}": ${exactMatches.length}`);
        exactMatches.forEach(program => {
            console.log(`   - ${program.name} (${program.college}) - Cut-off: ${program.cutoff}`);
        });
        
        // Fuzzy matches if needed
        let fuzzyMatches = [];
        if (exactMatches.length < 3) {
            const fuzzyResults = fuzzySearchPrograms(query, 10);
            fuzzyMatches = fuzzyResults
                .map(result => results.find(program => program.name === result.program))
                .filter(program => program && !exactMatches.some(exact => exact.name === program.name));
            
            console.log(`🔎 Additional fuzzy matches: ${fuzzyMatches.length}`);
            fuzzyMatches.forEach(program => {
                console.log(`   - ${program.name} (${program.college}) - Cut-off: ${program.cutoff}`);
            });
        }
        
        results = [...exactMatches, ...fuzzyMatches];
    }

    console.log(`✅ Final results: ${results.length} programs`);
    return results;
}

// Test cases
console.log("🧪 TESTING ENHANCED SEARCH FUNCTIONALITY");
console.log("=".repeat(80));

// Test case 1: Search for "computer" without college filter
testSearch("computer", "");

// Test case 2: Search for "computer" with College of Engineering filter
testSearch("computer", "College of Engineering");

// Test case 3: Search for "computer" with College of Science filter  
testSearch("computer", "College of Science");

// Test case 4: Search for "engineering" with College of Engineering filter
testSearch("engineering", "College of Engineering");

// Test case 5: No query, just College of Science filter
testSearch("", "College of Science");

// Test case 6: Invalid college filter
testSearch("computer", "College of Magic");
