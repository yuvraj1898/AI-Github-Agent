require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const simpleGit = require('simple-git');
const { OpenAI } = require('openai');
const fs = require('fs-extra');
const path = require('path');
const compression = require('compression');
const repoAnalyzerService = require('./services/repoAnalyzerService');
const { embedAndStoreChunks } = require('./services/vectorizer/embedAndStoreChunks');
const { answerQuestion } = require('./services/answerQuestions');


const app = express();

// Enable compression
app.use(compression());

// Configure CORS
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Increase payload size limit
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

const CLIENT_ID = 'Ov23liJhNGTZSCc3nyi0';
const CLIENT_SECRET = '226473ce60cc802e7abc9d3e0e34e162e62b3cb8';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Function to read repository content
async function readRepositoryContent(repoPath) {
    const files = [];
    const git = simpleGit(repoPath);
    
    // Get all files in the repository
    const fileList = await git.raw(['ls-files']);
    const filePaths = fileList.split('\n').filter(Boolean);
    
    // Read content of each file
    for (const filePath of filePaths) {
        try {
            const content = fs.readFileSync(path.join(repoPath, filePath), 'utf8');
            files.push({
                path: filePath,
                content: content
            });
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    }
    
    return files;
}

app.post('/analyze', async (req, res) => {
    try {
        const { repoUrl } = req.body;
        
        if (!repoUrl) {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        const analysis = await repoAnalyzerService.analyzeRepository(repoUrl);
        
        // Return both the analysis and the path to the summary file
        res.json({
            success: true,
            summary: analysis,
            summaryFile: path.relative(process.cwd(), analysis.summaryFile)
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ 
            error: 'Error analyzing repository',
            details: error.message,
            stack: error.stack
        });
    }
});

// New endpoint to process repository
app.post('/process-repo', async (req, res) => {
    const { repoUrl, repoId } = req.body;

    if (!repoUrl || !repoId) {
        return res.status(400).json({ error: 'repoUrl and repoId are required' });
    }

    const repoName = repoUrl.split('/').pop()?.replace(/\.git$/, '') || `repo-${Date.now()}`;
    const repoPath = path.join(__dirname, 'cloned_repos', repoName);

    try {
        // Clean up existing clone (if any)
        await fs.remove(repoPath);

        // Clone repo using simple-git
        const git = simpleGit();
        console.log(`📥 Cloning ${repoUrl} into ${repoPath}...`);
        await git.clone(repoUrl, repoPath);

        // Embed and store vectors
        console.log('🔍 Embedding and storing code chunks...');
        await embedAndStoreChunks(repoPath, repoId);

        res.json({ success: true, message: '✅ Repo processed and vectors stored' });
    } catch (err) {
        console.error('❌ Error:', err.message);
        res.status(500).json({ error: 'Failed to process repo' });
    }
});

app.post('/auth/github/callback', async (req, res) => {
    const { code } = req.body;

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const tokenData = tokenResponse.data;
        const accessToken = tokenData.access_token;

        if (accessToken) {
            // Use this access token to fetch user details or other tasks.
            // Maybe generate a JWT and send it to the frontend for session management.
            res.json({ success: true, accessToken });
        } else {
            res.json({ success: false, error: 'Failed to get access token' });
        }
    } catch (error) {
        console.error('Error during GitHub authentication:', error);
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
});
const chatHistory = {};
app.get('/api/chat/history', (req, res) => {
  const { repoId } = req.query;
  if (!repoId) return res.status(400).json({ error: 'repoId required' });

  // Get history from in-memory store
  const history = chatHistoryStore[repoId] || { messages: [], codeDiffs: [] };
  res.json(history);
});

// Process a question and return AI response
app.post('/api/chat/ask', async (req, res) => {
  try {
    const { question, repoId } = req.body;
    if (!repoId) return res.status(400).json({ error: 'repoId is required' });

    // Initialize memory for repoId if not exists
    if (!chatHistory[repoId]) {
      chatHistory[repoId] = { messages: [], codeDiffs: [] };
    }

    // Use history in the prompt if needed
    const history = chatHistory[repoId].messages;

    const answer = await answerQuestion(question, repoId, history); // pass history to OpenAI

    const aiMessage = {
      id: Date.now().toString(),
      content: answer?.text || answer || "I couldn't process your request.",
      sender: 'ai',
      timestamp: new Date()
    };

    chatHistory[repoId].messages.push({ sender: 'user', content: question, timestamp: new Date() });
    chatHistory[repoId].messages.push(aiMessage);

    if (answer?.codeDiffs && Array.isArray(answer.codeDiffs)) {
      chatHistory[repoId].codeDiffs = answer.codeDiffs;
    }

    res.json({
      answer: aiMessage.content,
      codeDiffs: answer.codeDiffs || []
    });
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ error: 'Failed to process your question', details: error.message });
  }
});

// Helper function to extract file path from AI response

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
