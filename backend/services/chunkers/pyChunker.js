const { execSync } = require("child_process");
const path = require("path");

/**
 * Chunk a Python file into code chunks.
 * 
 * @param {string} filePath - The path to the Python file to chunk.
 * @returns {Array} - An array of code chunks.
 */
function chunkPyFile(filePath) {
  const scriptPath = path.resolve(__dirname, "py_chunker.py");
  const result = execSync(`python3 "${scriptPath}" "${filePath}"`, {
    encoding: "utf-8",
  });
  return JSON.parse(result);
}

module.exports = { chunkPyFile };
