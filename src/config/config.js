require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        maxTokens: 1000
    },
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
        indexName: process.env.PINECONE_INDEX_NAME || 'code-embeddings'
    },
    github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    analysis: {
        maxFileSize: 100000, // bytes
        maxTokensPerChunk: 12000,
        supportedLanguages: ['javascript', 'typescript', 'python', 'java']
    }
}; 