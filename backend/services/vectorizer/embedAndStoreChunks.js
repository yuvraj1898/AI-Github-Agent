
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { v4: uuidv4 } = require('uuid');
const { walkAndChunkDirectory } = require('../chunkers/chunkerRouter');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Embed and store code chunks in Pinecone.
 * 
 * @param {string} repoPath - The path to the repository.
 * @param {string} repoId - The unique identifier for the repository.
 */
async function embedAndStoreChunks(repoPath, repoId) {
  const chunks = await walkAndChunkDirectory(repoPath);
  const vectors = [];

  for (const chunk of chunks) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk.code,
      });

      const vector = {
        id: uuidv4(),
        values: response.data[0].embedding,
        metadata: {
          repoId, // 🔑 Added to distinguish which repo this chunk belongs to
          filePath: chunk.filePath,
          name: chunk.name,
          type: chunk.type,
          language: chunk.language,
          code: chunk.code,
          calls: chunk.calls,
          imports: chunk.imports,
        },
      };

      vectors.push(vector);
    } catch (err) {
      console.error(`Error embedding chunk from ${chunk.filePath}:`, err);
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
}

module.exports = { embedAndStoreChunks };
