let pdfData = require('./data').pdfData;

function findProgramByName(programName) {
  return pdfData.programs.find(program => 
    program.name.toLowerCase() === programName.toLowerCase()
  );
}

function findProgramById(programId) {
  return pdfData.programs.find(program => program.id === programId);
}

module.exports = {
  findProgramByName,
  findProgramById
};