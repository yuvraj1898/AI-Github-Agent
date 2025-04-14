require('dotenv/config');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

const EMBEDDING_MODEL = 'text-embedding-3-small';
const COMPLETION_MODEL = 'gpt-4'; // or gpt-3.5-turbo

/**
 * Answer a question by querying the Pinecone index and getting a response from OpenAI.
 * 
 * @param {string} question - The question to answer.
 * @param {string} repoId - The repository ID to filter the Pinecone query.
 * @returns {Promise<string>} - The answer generated by OpenAI.
 */
async function answerQuestion(question, repoId, history = []) {
  const questionEmbedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });

  const queryEmbedding = questionEmbedding.data[0].embedding;

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

  // Convert history to messages for chat
  const chatHistoryMessages = history.map((msg) => ({
    role: msg.sender === 'ai' ? 'assistant' : 'user',
    content: msg.content
  }));

  const systemPrompt = {
    role: 'system',
    content: 'You are a senior software engineer who explains code clearly.',
  };

  const userPrompt = {
    role: 'user',
    content: `
Based on the following context from codebase, answer the question in detail:

${contextText}

Question: ${question}
`
  };

  const chat = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [systemPrompt, ...chatHistoryMessages, userPrompt],
    temperature: 0.2,
  });

  return chat.choices[0].message.content;
}

module.exports = { answerQuestion };
