const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const fs = require("fs");
const t = require("@babel/types");

/**
 * Helper to extract all function call names within a path
 * 
 * @param {NodePath} path - The Babel AST path of the node.
 * @returns {string[]} - Array of function call names.
 */
function extractCalls(path) {
  const calls = [];

  path.traverse({
    CallExpression(callPath) {
      if (t.isIdentifier(callPath.node.callee)) {
        calls.push(callPath.node.callee.name);
      } else if (t.isMemberExpression(callPath.node.callee) && t.isIdentifier(callPath.node.callee.property)) {
        calls.push(callPath.node.callee.property.name);
      }
    }
  });

  return calls;
}

/**
 * Chunk a TypeScript file into code chunks.
 * 
 * @param {string} filePath - The path to the TypeScript file to chunk.
 * @returns {Array} - Array of code chunks.
 */
function chunkTSFile(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  const chunks = [];
  const imports = [];

  traverse(ast, {
    enter(path) {
      // ✅ Import declarations (collect once)
      if (path.isImportDeclaration()) {
        imports.push(path.node.source.value);
      }
  
      // ✅ Function declarations (e.g., `function foo() {}`)
      if (path.isFunctionDeclaration()) {
        const name = path.node.id?.name || "anonymous";
        const body = code.slice(path.node.start, path.node.end);
        const calls = extractCalls(path);
        chunks.push({
          code: body,
          filePath,
          type: "function",
          name,
          language: "typescript",
          calls,
          imports,
        });
      }
  
      // ✅ Arrow functions or function expressions assigned to a variable
      if (path.isVariableDeclarator()) {
        const id = path.node.id;
        const init = path.node.init;
  
        if (
          t.isIdentifier(id) &&
          (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
        ) {
          const name = id.name;
          const body = code.slice(path.node.start, path.node.end);
          const calls = extractCalls(path);
          chunks.push({
            code: body,
            filePath,
            type: "function",
            name,
            language: "typescript",
            calls,
            imports,
          });
        }
      }
  
      // ✅ Class declarations
      if (path.isClassDeclaration()) {
        const name = path.node.id?.name || "anonymous";
        const body = code.slice(path.node.start, path.node.end);
        chunks.push({
          code: body,
          filePath,
          type: "class",
          name,
          language: "typescript",
          calls: [], // You can extract method calls here too if needed
          imports,
        });
      }
    }
  });

  return chunks;
}

module.exports = { chunkTSFile };
