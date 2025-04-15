const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chunkTSFile } = require("./tsChunker");

function chunkPyFile(filePath) {
    const scriptPath = path.resolve(__dirname, "py_ast_parser.py");
    const result = spawnSync("python3", [scriptPath, filePath]);

    if (result.error) throw result.error;
    if (result.stderr.length > 0) throw new Error(result.stderr.toString());

    return JSON.parse(result.stdout.toString());
}

function chunkFileByExtension(filePath) {
    const ext = path.extname(filePath);
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        return chunkTSFile(filePath);
    } else if (ext === ".py") {
        return chunkPyFile(filePath);
    } else {
        throw new Error(`Unsupported file type: ${ext}`);
    }
}

function walkAndChunkDirectory(dirPath) {
    let chunks = [];

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            chunks = chunks.concat(walkAndChunkDirectory(fullPath));
        } else if ([".ts", ".tsx", ".js", ".jsx", ".py"].includes(path.extname(fullPath))) {
            try {
                chunks = chunks.concat(chunkFileByExtension(fullPath));
            } catch (err) {
                console.warn(`Skipping file ${fullPath}: ${err}`);
            }
        }
    }

    return chunks;
}

module.exports = {
    chunkPyFile,
    chunkFileByExtension,
    walkAndChunkDirectory
};
