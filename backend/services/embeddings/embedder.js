require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { encoding_for_model } = require('tiktoken');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = 'code-embeddings';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,

});
function chunkText(text, maxTokens = 1000, overlap = 100) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxTokens, text.length);
    let chunk = text.slice(start, end);

    chunks.push(chunk);
    start += maxTokens - overlap;
  }

  return chunks;
}

async function embedAndStore(items) {
  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectors = [];
    const embeddings = [];

    for (let i = 0; i < items.length; i++) {
      const { text, metadata } = items[i];
      const chunks = chunkText(text, 1500, 200);

      for (let j = 0; j < chunks.length; j++) {
        const chunk = chunks[j];

        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });

        const embedding = response?.data?.[0]?.embedding;
        if (!embedding) {
          throw new Error('No embedding found');
        }

        vectors.push({
          id: `code-${i}-chunk-${j}`,
          values: embedding,
          metadata: {
            ...metadata,
            content: chunk,
            snippet: chunk.slice(0, 200),
            chunkIndex: j
          }
        });

        embeddings.push(embedding);
      } // <- inner for loop
    } // <- outer for loop

    await index.upsert(vectors);
    console.log(`✅ Stored ${vectors.length} embeddings in Pinecone.`);
    return embeddings;

  } catch (err) { // this was erroring
    console.error('❌ Embedding/store error:', err.response?.data || err.message || err);
    return null;
  }
}
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response?.data?.[0]?.embedding;
}


module.exports = { embedAndStore,getEmbedding };
