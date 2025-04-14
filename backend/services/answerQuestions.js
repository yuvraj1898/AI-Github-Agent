require('dotenv/config');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

const EMBEDDING_MODEL = 'text-embedding-3-small';
const COMPLETION_MODEL = 'gpt-4'; // or 'gpt-3.5-turbo'

async function answerQuestion(question, repoId) {
  // Step 1: Embed the question
  const questionEmbedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });

  const queryEmbedding = questionEmbedding.data[0].embedding;

  // Step 2: Query Pinecone
  const pineconeResponse = await index.query({
    vector: queryEmbedding,
    topK: 10,
    filter: { repoId },
    includeMetadata: true,
  });

  const contextText = (pineconeResponse.matches || [])
    .map((match) => {
      const file = match.metadata.filePath;
      const func = match.metadata.name;
      const code = match.metadata.code || '[No code available]';
      return `File: ${file}\nFunction: ${func}\n\n${code}`;
    })
    .join('\n\n');

  // Step 3: Construct the prompt
  const prompt = `
You are a code assistant analyzing a codebase.
Based on the following context from files, answer the question in detail:

${contextText}

Question: ${question}
Answer:
`;

  // Step 4: Get response from OpenAI
    const chat = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineer who explains code clearly.',
        },
        {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
  });

  return chat.choices[0].message.content;
}

module.exports = {
  answerQuestion,
};
