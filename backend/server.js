const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const simpleGit = require('simple-git');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
require('dotenv').config();
const repoAnalyzerService = require('./services/repoAnalyzerService');
const { processRepo } = require('./services/embeddings/generateEmbeddings');
const { askQuestion } = require('./services/embeddings/askQuestion');

const chatHistory = {
    messages: [],
    codeDiffs: []
  };
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
            // ...analysis,
            // summaryFile: path.relative(process.cwd(), analysis.summaryFile)
            summary: analysis, // ensure it's sent
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
    const { repoUrl } = req.body;
  
    if (!repoUrl) {
      return res.status(400).json({ error: 'Missing repoUrl in request body' });
    }
  
    try {
      console.log(`🔧 Processing repo: ${repoUrl}`);
      const result = await processRepo(repoUrl);
      res.json({ success: true, message: 'Repo processed and embedded!', ...result });
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.status(500).json({ success: false, error: error.message });
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
app.get('/api/chat/history', (req, res) => {
    res.json(chatHistory);
  });
  
  // Process a question and return AI response
  app.post('/api/chat/ask', async (req, res) => {
    try {
      const { question, messageHistory } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }
  
      console.log('Processing question:', question);
      console.log('Message history length:', messageHistory?.length || 0);
  
      // Save incoming message history if provided
      if (messageHistory && Array.isArray(messageHistory)) {
        chatHistory.messages = messageHistory;
      }
      
      // Ask the question to your AI
      console.log('Calling askQuestion function...');
      const answer = await askQuestion(question);
      
      if (!answer) {
        return res.status(500).json({ error: 'No answer returned from AI service' });
      }
      
      console.log('Answer received, processing response...');
      
      // Extract code diffs if present in the answer
      let codeDiff = null;
      const codeBlockMatch = answer.match(/```[\s\S]*?```/g);
      
      if (codeBlockMatch) {
        console.log('Code blocks found in response:', codeBlockMatch.length);
        
        // Simple parsing logic - enhance as needed
        const beforeCode = codeBlockMatch[0]?.replace(/```[\w]*\n/, '').replace(/```$/, '') || '';
        const afterCode = codeBlockMatch[1]?.replace(/```[\w]*\n/, '').replace(/```$/, '') || '';
        
        codeDiff = {
          before: beforeCode || '',
          after: afterCode || '',
          filePath: extractFilePath(answer) || 'unknown.js',
        };
        
        // Add to history
        chatHistory.codeDiffs.push(codeDiff);
      }
      
      // Update chat history with AI response
      const aiMessage = {
        id: Date.now().toString(),
        content: answer,
        sender: 'ai',
        timestamp: new Date()
      };
      
      chatHistory.messages.push(aiMessage);
      
      console.log('Sending successful response');
      res.json({
        answer,
        codeDiff
      });
    } catch (error) {
      console.error('Error processing question:', error);
      res.status(500).json({ 
        error: 'Failed to process your question', 
        details: error.message 
      });
    }
  });
  
  // Helper function to extract file path from AI response
  function extractFilePath(text) {
    const filePathMatch = text.match(/File:\s*([^\n]+)/);
    return filePathMatch ? filePathMatch[1].trim() : null;
  }

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});