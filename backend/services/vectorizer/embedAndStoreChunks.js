const { Pinecone } = require('@pinecone-database/pinecone');
const { v4: uuidv4 } = require('uuid');
const { walkAndChunkDirectory } = require('../chunkers/chunkerRouter');
const { spawn } = require('child_process');
require('dotenv').config();

const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX_NAME_CodeBert);
const path = require('path');

/**
 * Embed and store code chunks in Pinecone using Python CodeBERT.
 * 
 * @param {string} repoPath - The path to the repository.
 * @param {string} repoId - The unique identifier for the repository.
 */
async function embedAndStoreChunks(repoPath, repoId) {
  const chunks = await walkAndChunkDirectory(repoPath);

  return new Promise((resolve, reject) => {
    const pyScriptPath = path.resolve(__dirname, 'codebert_embed.py');
    const python = require('child_process').spawn('python3', [pyScriptPath]);

    let result = '';
    let error = '';

    python.stdout.on('data', (data) => {
      result += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', async (code) => {
      if (code !== 0 || error) {
        return reject(`Python error: ${error}`);
      }

      let enrichedChunks = JSON.parse(result);
      const vectors = [];

      for (const chunk of enrichedChunks) {
        if (chunk.embedding) {
          vectors.push({
            id: uuidv4(),
            values: chunk.embedding,
            metadata: {
              repoId,
              filePath: chunk.filePath,
              name: chunk.name,
              type: chunk.type,
              language: chunk.language,
              code: chunk.code,
              calls: chunk.calls,
              imports: chunk.imports,
            },
          });
        } else {
          console.error(`Skipping chunk due to embedding error: ${chunk.error}`);
        }
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        try {
          await index.upsert(batch);
          console.log(`✅ Upserted ${batch.length} vectors`);
        } catch (err) {
          console.error(`❌ Failed to upsert batch:`, err);
        }
      }

      resolve();
    });

    // Write chunks to Python's stdin
    python.stdin.write(JSON.stringify(chunks));
    python.stdin.end();
  });
}
/**
 * Embed a single input string using CodeBERT Python script.
 * @param {string} inputText - The input string to embed.
 * @returns {Promise<number[]>} - The embedding vector.
 */
async function getCodeBERTEmbedding(inputText) {
  const pyScriptPath = path.resolve(__dirname, 'codebert_embed.py');
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [pyScriptPath, '--single']);

    let result = '';
    let error = '';

    python.stdout.on('data', (data) => {
      result += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0 || error) {
        return reject(`Python error: ${error}`);
      }

      try {
        const output = JSON.parse(result);
        if (output.embedding) {
          resolve(output.embedding);
        } else {
          reject('No embedding found');
        }
      } catch (err) {
        reject(`JSON parse error: ${err.message}`);
      }
    });

    python.stdin.write(JSON.stringify({ input: inputText }));
    python.stdin.end();
  });
}
module.exports = { embedAndStoreChunks,getCodeBERTEmbedding };
