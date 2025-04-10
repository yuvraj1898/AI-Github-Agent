const { PineconeClient } = require('@pinecone-database/pinecone');
const config = require('../config/config');

class VectorStore {
    constructor() {
        this.pinecone = new PineconeClient();
        this.index = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.pinecone.init({
                apiKey: config.pinecone.apiKey,
                environment: config.pinecone.environment
            });

            this.index = this.pinecone.Index(config.pinecone.indexName);
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing Pinecone:', error);
            throw error;
        }
    }

    async storeCodeEmbedding(filePath, embedding, metadata = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.index.upsert({
                vectors: [{
                    id: filePath,
                    values: embedding,
                    metadata: {
                        ...metadata,
                        timestamp: Date.now()
                    }
                }]
            });
        } catch (error) {
            console.error('Error storing code embedding:', error);
            throw error;
        }
    }

    async findSimilarCode(embedding, topK = 5) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const results = await this.index.query({
                vector: embedding,
                topK,
                includeMetadata: true
            });
            return results.matches;
        } catch (error) {
            console.error('Error finding similar code:', error);
            throw error;
        }
    }

    async deleteEmbedding(filePath) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.index.delete1({
                ids: [filePath]
            });
        } catch (error) {
            console.error('Error deleting embedding:', error);
            throw error;
        }
    }

    async updateMetadata(filePath, metadata) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const current = await this.index.fetch({
                ids: [filePath]
            });

            if (current.vectors[filePath]) {
                await this.index.upsert({
                    vectors: [{
                        id: filePath,
                        values: current.vectors[filePath].values,
                        metadata: {
                            ...current.vectors[filePath].metadata,
                            ...metadata,
                            timestamp: Date.now()
                        }
                    }]
                });
            }
        } catch (error) {
            console.error('Error updating metadata:', error);
            throw error;
        }
    }
}

module.exports = VectorStore; 