const { embedAndStore, getEmbedding } = require('./embedder');
const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "pcsk_2pkc92_LRqfKySub3RCLPeAuWRL2FfmK7jRTHVaKqzunuM8kmAZFMmmJj9nBtFCJ47Tffy";
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'code-embeddings';

console.log("🔑 OPENAI_API_KEY loaded:", OPENAI_API_KEY ? "✅ Yes" : "❌ No");
console.log("🌲 PINECONE config:", PINECONE_INDEX_NAME ? "✅ Yes" : "❌ No");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});
const index = pinecone.Index(PINECONE_INDEX_NAME);

// Function to extract code blocks from AI response
function extractCodeBlocks(text) {
  const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'javascript';
    const code = match[2].trim();
    codeBlocks.push({
      language,
      code
    });
  }
  
  return codeBlocks;
}

// Function to parse file path from context or AI response
function parseFilePath(text) {
  const filePathRegex = /\/\/\s*File:\s*([^\n]+)/;
  const match = text.match(filePathRegex);
  return match ? match[1].trim() : 'unknown.js';
}

async function askQuestion(question, messageHistory = []) {
  try {
    // Step 1: Embed the question
    const questionEmbedding = await getEmbedding(question);
    
    if (!questionEmbedding || !questionEmbedding[0]) {
      throw new Error('❌ Failed to embed the question');
    }
    
    // Step 2: Query Pinecone
    const queryResponse = await index.query({
      vector: questionEmbedding,
      topK: 3,
      includeMetadata: true,
    });
    
    const matches = queryResponse.matches || [];
    
    if (matches.length === 0) {
      return "I couldn't find any relevant code to help with your question.";
    }
    
    // Step 3: Build context from top matches
    const contextSnippets = matches.map(match => {
      const filePath = match.metadata?.filePath || 'unknown';
      const content = match.metadata?.content || '';
      return `// File: ${filePath}\n${content}\n\n`;
    });
    
    // Step 4: Include message history for context
    const chatHistory = messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    // Build the complete prompt with instructions for code modification
    const systemPrompt = `
You are a code modification assistant specialized in helping users understand and modify code.
When asked to modify code:
1. Always provide a clear explanation of what changes you're making and why
2. If modifying code, provide BOTH the original code AND the modified version in separate code blocks
3. When appropriate, format your response with "Before:" and "After:" sections
4. For substantial changes, explain the modifications step by step
5. Always include the file path at the beginning of code blocks

The user is working with a React-based code chat interface that has chat messages and code diffs.
`;

    // Final messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { 
        role: 'user', 
        content: `QUESTION: "${question}"\n\nCODE CONTEXT:\n${contextSnippets.join('\n')}` 
      }
    ];
    
    // Step 5: Ask OpenAI
    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
    });
    
    const answer = res.choices?.[0]?.message?.content || '❌ No answer returned';
    console.log('🧠 AI Answer:\n', answer);
    
    return answer;
  } catch (err) {
    console.error('🔥 askQuestion error:', err.message || err);
    return `I encountered an error: ${err.message || 'Unknown error'}`;
  }
}

module.exports = { askQuestion, extractCodeBlocks, parseFilePath };