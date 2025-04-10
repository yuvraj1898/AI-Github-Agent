const Groq = require('groq-sdk');
const githubService = require('./githubService');
const fs = require('fs').promises;
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { encode } = require('gpt-tokenizer');
const { HfInference } = require('@huggingface/inference');

class FileService {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
        this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
        this.embeddingsCache = new Map(); // Cache for file embeddings
        this.astCache = new Map(); // Cache for AST analysis
        this.embeddingsDir = path.join(process.cwd(), 'embeddings');
        this.ensureEmbeddingsDir();
        this.tempDir = path.join(process.cwd(), 'temp_repos');
    }

    /**
     * Ensure the embeddings directory exists
     */
    async ensureEmbeddingsDir() {
        try {
            await fs.mkdir(this.embeddingsDir, { recursive: true });
        } catch (error) {
            console.error('Error creating embeddings directory:', error);
        }
    }

    /**
     * Create embeddings for the entire codebase
     * @param {string} repoUrl - GitHub repository URL
     * @returns {Promise<Object>} - Embeddings for the codebase
     */
    async createCodebaseEmbeddings(repoUrl) {
        let repoPath = null;
        try {
            // Clone the repository
            repoPath = await githubService.cloneRepository(repoUrl);
            
            // Get all code files
            const files = await githubService.getAllFiles(repoPath);
            
            // Get file contents for all files
            const filesWithContent = await Promise.all(
                files.map(async (file) => {
                    try {
                        const content = await fs.readFile(file, 'utf-8');
                        // Convert absolute path to relative path
                        const relativePath = path.relative(repoPath, file);
                        return {
                            path: relativePath,
                            content
                        };
                    } catch (error) {
                        console.error(`Error reading file ${file}:`, error);
                        return {
                            path: path.relative(repoPath, file),
                            content: ''
                        };
                    }
                })
            );

            // Filter out files with empty content
            const validFiles = filesWithContent.filter(file => file.content.length > 0);
            
            // Create embeddings for each file
            const embeddings = await this.generateEmbeddingsForFiles(validFiles);
            
            // Save embeddings to disk
            await this.saveEmbeddings(repoUrl, embeddings);
            
            return {
                embeddings,
                message: 'Embeddings created successfully'
            };
        } catch (error) {
            console.error('Error creating codebase embeddings:', error);
            throw error;
        } finally {
            // Always clean up the repository, even if there's an error
            if (repoPath) {
                try {
                    await githubService.cleanup(repoPath);
                } catch (cleanupError) {
                    console.error('Error cleaning up repository:', cleanupError);
                }
            }
        }
    }

    /**
     * Generate embeddings for a list of files
     * @param {Array} files - List of files with their content
     * @returns {Promise<Array>} - Embeddings for the files
     */
    async generateEmbeddingsForFiles(files) {
        const embeddings = [];
        
        for (const file of files) {
            try {
                // Check if we already have embeddings for this file
                if (this.embeddingsCache.has(file.path)) {
                    console.log(`Using cached embeddings for ${file.path}`);
                    embeddings.push({
                        path: file.path,
                        embedding: this.embeddingsCache.get(file.path)
                    });
                    continue;
                }
                
                console.log(`Generating embeddings for ${file.path}`);
                
                // Generate embeddings using Hugging Face
                const embedding = await this.hf.featureExtraction({
                    model: 'sentence-transformers/all-MiniLM-L6-v2',
                    inputs: file.content
                });
                
                // Cache the embedding
                this.embeddingsCache.set(file.path, embedding);
                
                embeddings.push({
                    path: file.path,
                    embedding
                });
            } catch (error) {
                console.error(`Error generating embeddings for ${file.path}:`, error);
            }
        }
        
        return embeddings;
    }

    /**
     * Save embeddings to disk
     * @param {string} repoUrl - GitHub repository URL
     * @param {Array} embeddings - Embeddings for the files
     */
    async saveEmbeddings(repoUrl, embeddings) {
        try {
            // Create a hash of the repo URL to use as the filename
            const repoHash = Buffer.from(repoUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
            const embeddingsPath = path.join(this.embeddingsDir, `${repoHash}.json`);
            
            // Save embeddings to disk
            await fs.writeFile(embeddingsPath, JSON.stringify(embeddings));
            console.log(`Saved embeddings to ${embeddingsPath}`);
        } catch (error) {
            console.error('Error saving embeddings:', error);
        }
    }

    /**
     * Load embeddings from disk
     * @param {string} repoUrl - GitHub repository URL
     * @returns {Promise<Array>} - Embeddings for the files
     */
    async loadEmbeddings(repoUrl) {
        try {
            // Create a hash of the repo URL to use as the filename
            const repoHash = Buffer.from(repoUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
            const embeddingsPath = path.join(this.embeddingsDir, `${repoHash}.json`);
            
            // Check if embeddings file exists
            try {
                await fs.access(embeddingsPath);
            } catch (error) {
                console.log(`No embeddings found for ${repoUrl}`);
                return null;
            }
            
            // Load embeddings from disk
            const embeddingsData = await fs.readFile(embeddingsPath, 'utf-8');
            const embeddings = JSON.parse(embeddingsData);
            
            // Cache the embeddings
            embeddings.forEach(item => {
                this.embeddingsCache.set(item.path, item.embedding);
            });
            
            console.log(`Loaded embeddings for ${embeddings.length} files`);
            return embeddings;
        } catch (error) {
            console.error('Error loading embeddings:', error);
            return null;
        }
    }

    /**
     * Analyze AST for a file
     * @param {string} filePath - Path to the file
     * @param {string} content - Content of the file
     * @returns {Object} - AST analysis results
     */
    analyzeAST(filePath, content) {
        // Check if we already have AST analysis for this file
        if (this.astCache.has(filePath)) {
            console.log(`Using cached AST analysis for ${filePath}`);
            return this.astCache.get(filePath);
        }
        
        console.log(`Analyzing AST for ${filePath}`);
        
        try {
            // Parse the file content
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'decorators-legacy']
            });
            
            // Extract information from the AST
            const analysis = {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                variables: []
            };
            
            // Traverse the AST
            traverse(ast, {
                // Extract imports
                ImportDeclaration(path) {
                    analysis.imports.push({
                        source: path.node.source.value,
                        specifiers: path.node.specifiers.map(specifier => {
                            if (t.isImportDefaultSpecifier(specifier)) {
                                return { type: 'default', local: specifier.local.name };
                            } else if (t.isImportSpecifier(specifier)) {
                                return { type: 'named', local: specifier.local.name, imported: specifier.imported.name };
                            } else if (t.isImportNamespaceSpecifier(specifier)) {
                                return { type: 'namespace', local: specifier.local.name };
                            }
                        })
                    });
                },
                
                // Extract exports
                ExportNamedDeclaration(path) {
                    if (path.node.declaration) {
                        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
                            analysis.exports.push({
                                type: 'function',
                                name: path.node.declaration.id.name
                            });
                        } else if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
                            analysis.exports.push({
                                type: 'class',
                                name: path.node.declaration.id.name
                            });
                        } else if (t.isVariableDeclaration(path.node.declaration)) {
                            path.node.declaration.declarations.forEach(declaration => {
                                if (t.isIdentifier(declaration.id)) {
                                    analysis.exports.push({
                                        type: 'variable',
                                        name: declaration.id.name
                                    });
                                }
                            });
                        }
                    }
                },
                
                // Extract functions
                FunctionDeclaration(path) {
                    if (path.node.id) {
                        analysis.functions.push({
                            name: path.node.id.name,
                            params: path.node.params.map(param => {
                                if (t.isIdentifier(param)) {
                                    return param.name;
                                }
                                return null;
                            }).filter(Boolean)
                        });
                    }
                },
                
                // Extract classes
                ClassDeclaration(path) {
                    if (path.node.id) {
                        const methods = [];
                        path.node.body.body.forEach(member => {
                            if (t.isClassMethod(member) && member.key) {
                                methods.push({
                                    name: member.key.name || member.key.value,
                                    kind: member.kind
                                });
                            }
                        });
                        
                        analysis.classes.push({
                            name: path.node.id.name,
                            methods
                        });
                    }
                },
                
                // Extract variables
                VariableDeclarator(path) {
                    if (t.isIdentifier(path.node.id)) {
                        analysis.variables.push({
                            name: path.node.id.name
                        });
                    }
                }
            });
            
            // Cache the AST analysis
            this.astCache.set(filePath, analysis);
            
            return analysis;
        } catch (error) {
            console.error(`Error analyzing AST for ${filePath}:`, error);
            return {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                variables: []
            };
        }
    }

    /**
     * Find relevant files based on user question using embeddings
     * @param {string} repoUrl - GitHub repository URL
     * @param {string} question - User question
     * @returns {Promise<Array>} - Relevant files
     */
    async findRelevantFilesWithEmbeddings(repoUrl, question) {
        try {
            // Load embeddings for the repository
            let embeddings = await this.loadEmbeddings(repoUrl);
            
            // If no embeddings found, create them
            if (!embeddings) {
                console.log(`No embeddings found for ${repoUrl}, creating them now`);
                const result = await this.createCodebaseEmbeddings(repoUrl);
                embeddings = result.embeddings;
            }
            
            // Generate embedding for the question
            const questionEmbedding = await this.hf.featureExtraction({
                model: 'sentence-transformers/all-MiniLM-L6-v2',
                inputs: question
            });
            
            // Calculate similarity between question and each file
            const similarities = embeddings.map(item => {
                const similarity = this.cosineSimilarity(questionEmbedding, item.embedding);
                return {
                    path: item.path,
                    similarity
                };
            });
            
            // Sort by similarity (highest first)
            similarities.sort((a, b) => b.similarity - a.similarity);
            
            // Return the top 5 most relevant files
            return similarities.slice(0, 5).map(item => item.path);
        } catch (error) {
            console.error('Error finding relevant files with embeddings:', error);
            return [];
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @returns {number} - Cosine similarity
     */
    cosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dotProduct / (norm1 * norm2);
    }

    /**
     * Answer questions about the codebase using embeddings and AST analysis
     * @param {string} repoUrl - GitHub repository URL
     * @param {string} question - User question
     * @returns {Promise<Object>} - Answer to the question
     */
    async answerCodebaseQuestion(repoUrl, question) {
        let repoPath = null;
        try {
            // Clone the repository
            repoPath = await githubService.cloneRepository(repoUrl);
            
            // Try to find relevant files based on the question using embeddings
            let relevantFilePaths = [];
            try {
                relevantFilePaths = await this.findRelevantFilesWithEmbeddings(repoUrl, question);
                console.log(`Found ${relevantFilePaths.length} relevant files using embeddings:`, relevantFilePaths);
            } catch (embeddingError) {
                console.error('Error finding relevant files with embeddings:', embeddingError);
                console.log('Falling back to simple file selection based on question keywords...');
                
                // Fallback: Get all files and filter based on question keywords
                const allFiles = await githubService.getAllFiles(repoPath);
                const questionKeywords = question.toLowerCase().split(/\s+/).filter(word => word.length > 3);
                
                // Score files based on keyword matches in their paths
                const scoredFiles = allFiles.map(file => {
                    const relativePath = path.relative(repoPath, file);
                    const score = questionKeywords.reduce((total, keyword) => {
                        return total + (relativePath.toLowerCase().includes(keyword) ? 2 : 0);
                    }, 0);
                    return { path: relativePath, score };
                });
                
                // Sort by score and take top 5
                relevantFilePaths = scoredFiles
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5)
                    .map(file => file.path);
                    
                console.log(`Found ${relevantFilePaths.length} relevant files using keyword matching:`, relevantFilePaths);
            }
            
            if (relevantFilePaths.length === 0) {
                // If still no files found, get all files and take the first 5
                const allFiles = await githubService.getAllFiles(repoPath);
                relevantFilePaths = allFiles
                    .map(file => path.relative(repoPath, file))
                    .slice(0, 5);
                console.log(`No relevant files found, using first 5 files:`, relevantFilePaths);
            }
            
            // Get file contents for relevant files
            const filesWithContent = await Promise.all(
                relevantFilePaths.map(async (filePath) => {
                    try {
                        const fullPath = path.join(repoPath, filePath);
                        const content = await fs.readFile(fullPath, 'utf-8');
                        return {
                            path: filePath,
                            content
                        };
                    } catch (error) {
                        console.error(`Error reading file ${filePath}:`, error);
                        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
                    }
                })
            );

            // Analyze the structure of each file
            const filesWithStructure = await Promise.all(
                filesWithContent.map(async (file) => {
                    try {
                        const structure = await this.analyzeFileStructure(file.content);
                        return {
                            ...file,
                            structure
                        };
                    } catch (error) {
                        console.error(`Error analyzing structure of ${file.path}:`, error);
                        return {
                            ...file,
                            structure: { error: error.message }
                        };
                    }
                })
            );

            // Generate answer using LLM
            const answer = await this.generateAnswerWithLLM(filesWithStructure, question);

            return {
                answer,
                relevantFiles: relevantFilePaths.map(path => ({
                    path,
                    relevance: "This file is relevant to your question based on its content and structure."
                }))
            };
        } catch (error) {
            console.error('Error answering codebase question:', error);
            throw error;
        } finally {
            // Always clean up the repository, even if there's an error
            if (repoPath) {
                try {
                    await githubService.cleanup(repoPath);
                } catch (cleanupError) {
                    console.error('Error cleaning up repository:', cleanupError);
                }
            }
        }
    }

    /**
     * Generate an answer to a question using LLM
     * @param {Array} files - Array of files with content and structure
     * @param {string} question - User question
     * @returns {Promise<string>} - Answer to the question
     */
    async generateAnswerWithLLM(files, question) {
        try {
            // Prepare the prompt for the LLM
            const fileContexts = files.map(file => {
                return `File: ${file.path}
Content:
${file.content.substring(0, 1000)}${file.content.length > 1000 ? '...' : ''}

Structure:
${JSON.stringify(file.structure, null, 2)}
`;
            }).join('\n\n');

            const prompt = `You are an expert code analyzer. Answer the following question about the codebase:

${fileContexts}

Question: ${question}

Provide a comprehensive answer based on the code above. Include specific references to the files and code sections that are relevant to your answer.`;

            // Call the LLM
            const response = await this.callLLM(prompt);
            
            return response;
        } catch (error) {
            console.error('Error generating answer with LLM:', error);
            throw new Error(`Failed to generate answer: ${error.message}`);
        }
    }

    /**
     * List all files in a repository
     * @param {string} repoUrl - GitHub repository URL
     * @returns {Promise<Array>} - List of files with their paths and content
     */
    async listRepositoryFiles(repoUrl) {
        let repoPath = null;
        try {
            // Clone the repository
            repoPath = await githubService.cloneRepository(repoUrl);
            
            // Get all code files
            const files = await githubService.getAllFiles(repoPath);
            
            // Get file contents and convert absolute paths to relative paths
            const filesWithContent = await Promise.all(
                files.map(async (file) => {
                    const content = await githubService.readFileContent(file);
                    // Convert absolute path to relative path
                    const relativePath = path.relative(repoPath, file);
                    return {
                        path: relativePath,
                        content: content || '',
                        selected: false
                    };
                })
            );

            return filesWithContent;
        } catch (error) {
            console.error('Error listing repository files:', error);
            throw error;
        } finally {
            // Always clean up the repository, even if there's an error
            if (repoPath) {
                try {
                    await githubService.cleanup(repoPath);
                } catch (cleanupError) {
                    console.error('Error cleaning up repository:', cleanupError);
                }
            }
        }
    }

    /**
     * Call the LLM with a prompt
     * @param {string} prompt - Prompt for the LLM
     * @returns {Promise<string>} - LLM response
     */
    async callLLM(prompt) {
        try {
            const completion = await this.groq.chat.completions.create({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert code analyzer. Provide detailed, accurate, and helpful answers about code."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 4000
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error calling LLM:', error);
            throw new Error(`Failed to call LLM: ${error.message}`);
        }
    }

    /**
     * Analyze the structure of a file
     * @param {string} content - File content
     * @returns {Promise<Object>} - File structure analysis
     */
    async analyzeFileStructure(content) {
        try {
            // Parse the file content
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'decorators-legacy']
            });
            
            // Extract information from the AST
            const structure = {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                variables: []
            };
            
            // Traverse the AST
            traverse(ast, {
                // Extract imports
                ImportDeclaration(path) {
                    structure.imports.push({
                        source: path.node.source.value,
                        specifiers: path.node.specifiers.map(specifier => {
                            if (t.isImportDefaultSpecifier(specifier)) {
                                return { type: 'default', local: specifier.local.name };
                            } else if (t.isImportSpecifier(specifier)) {
                                return { type: 'named', local: specifier.local.name, imported: specifier.imported.name };
                            } else if (t.isImportNamespaceSpecifier(specifier)) {
                                return { type: 'namespace', local: specifier.local.name };
                            }
                        })
                    });
                },
                
                // Extract exports
                ExportNamedDeclaration(path) {
                    if (path.node.declaration) {
                        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
                            structure.exports.push({
                                type: 'function',
                                name: path.node.declaration.id.name
                            });
                        } else if (t.isClassDeclaration(path.node.declaration) && path.node.declaration.id) {
                            structure.exports.push({
                                type: 'class',
                                name: path.node.declaration.id.name
                            });
                        } else if (t.isVariableDeclaration(path.node.declaration)) {
                            path.node.declaration.declarations.forEach(declaration => {
                                if (t.isIdentifier(declaration.id)) {
                                    structure.exports.push({
                                        type: 'variable',
                                        name: declaration.id.name
                                    });
                                }
                            });
                        }
                    }
                },
                
                // Extract functions
                FunctionDeclaration(path) {
                    if (path.node.id) {
                        structure.functions.push({
                            name: path.node.id.name,
                            params: path.node.params.map(param => {
                                if (t.isIdentifier(param)) {
                                    return param.name;
                                }
                                return null;
                            }).filter(Boolean)
                        });
                    }
                },
                
                // Extract classes
                ClassDeclaration(path) {
                    if (path.node.id) {
                        const methods = [];
                        path.node.body.body.forEach(member => {
                            if (t.isClassMethod(member) && member.key) {
                                methods.push({
                                    name: member.key.name || member.key.value,
                                    kind: member.kind
                                });
                            }
                        });
                        
                        structure.classes.push({
                            name: path.node.id.name,
                            methods
                        });
                    }
                },
                
                // Extract variables
                VariableDeclarator(path) {
                    if (t.isIdentifier(path.node.id)) {
                        structure.variables.push({
                            name: path.node.id.name
                        });
                    }
                }
            });
            
            return structure;
        } catch (error) {
            console.error('Error analyzing file structure:', error);
            return {
                error: error.message
            };
        }
    }
}

module.exports = new FileService(); 