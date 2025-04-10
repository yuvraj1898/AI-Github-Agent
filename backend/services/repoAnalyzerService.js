const Groq = require('groq-sdk');
const githubService = require('./githubService');
const codeAnalyzerService = require('./codeAnalyzerService');
const fs = require('fs').promises;
const path = require('path');

const Openai=require('openai');

class RepoAnalyzerService {
    constructor() {
        this.groq = new Groq({
            apiKey:process.env.GROQ_API_KEY,
        });
        this.openai=new Openai({
            apiKey:process.env.OPENAI_API_KEY,
        });
        this.summariesDir = path.join(process.cwd(), 'summaries');
    }

    async analyzeRepository(repoUrl) {
        try {
            // Create summaries directory if it doesn't exist
            await fs.mkdir(this.summariesDir, { recursive: true });
            
            // Clone the repository
            const repoPath = await githubService.cloneRepository(repoUrl);
            
            // Find and read README file
            const readmeInfo = await githubService.findAndReadReadme(repoPath);
            const readmeContent = readmeInfo ? readmeInfo.content : null;
            
            // Get all code files
            const files = await githubService.getAllFiles(repoPath);
            
            // Analyze each file
            const analyses = await Promise.all(
                files.map(async (file) => {
                    const content = await githubService.readFileContent(file);
                    if (content) {
                        return codeAnalyzerService.analyzeFile(file, content);
                    }
                    return null;
                })
            );

            // Generate code analysis summary
            const codeSummary = await codeAnalyzerService.generateSummary(analyses);

            // Generate AI-powered summary using Groq
            const aiSummary = await this.generateAISummary(codeSummary, repoUrl, readmeContent);

            // Save summary to file
            const summaryText = this.formatSummary(repoUrl, codeSummary, aiSummary, readmeContent);
            const fileName = `summary_${Date.now()}.txt`;
            const filePath = path.join(this.summariesDir, fileName);
            await fs.writeFile(filePath, summaryText, 'utf-8');

            // Cleanup
            await githubService.cleanup(repoPath);

            return {
                codeAnalysis: codeSummary,
                aiSummary,
                summaryFile: filePath
            };
        } catch (error) {
            console.error('Error analyzing repository:', error);
            throw error;
        }
    }

    formatSummary(repoUrl, codeSummary, aiSummary, readmeContent) {
        // Check if README is very large and might need truncation
        const isReadmeLarge = readmeContent && readmeContent.length > 10000;
        const readmeSection = readmeContent 
            ? `## README Content
\`\`\`markdown
${isReadmeLarge ? this.truncateContent(readmeContent, 5000) : readmeContent}
\`\`\`
${isReadmeLarge ? '\n*Note: README content has been truncated in this report. The full content was used for analysis.*\n' : ''}`
            : '';

        return `# Code Repository Analysis Report
============================

## Repository Information
- **URL**: ${repoUrl}
- **Analysis Date**: ${new Date().toISOString()}

${readmeSection}

## Main Purpose
This is a code analysis tool that provides comprehensive technical analysis and insights for code repositories.
It can clone repositories, analyze their code, and generate detailed technical reports.

## Core Features
1. **Repository Analysis**
   - Supports JavaScript/TypeScript and Python codebases
   - Analyzes code structure, dependencies, and patterns
   - Generates comprehensive technical reports

2. **Code Parsing**
   - Uses Babel parser for JavaScript/TypeScript
   - Custom parsing for Python files
   - AST-based analysis for accurate code understanding

3. **AI-Powered Analysis**
   - Uses Groq's AI model (llama-4-scout-17b)
   - Generates intelligent insights and recommendations
   - Provides architectural and design pattern analysis

4. **File Management**
   - Repository cloning and file operations
   - File content analysis and parsing
   - Dependency tracking and management

5. **Summary Generation**
   - Creates detailed technical reports
   - Includes code metrics and analysis
   - Provides AI-generated insights

## Technical Stack
1. **Backend**
   - Node.js with Express
   - RESTful API architecture
   - Asynchronous processing

2. **Frontend**
   - React with TailwindCSS
   - Modern UI/UX design
   - Responsive interface

3. **AI & Analysis**
   - Groq API for code analysis
   - Babel parser and traverse
   - Custom code analysis algorithms

4. **Database**
   - Pinecone for embeddings
   - Code search and retrieval
   - Vector-based similarity search

## Key Components
1. **Services**
   - RepoAnalyzerService: Main analysis orchestrator
   - CodeAnalyzerService: Code parsing and analysis
   - githubService: Repository operations

2. **API Endpoints**
   - /analyze: Repository analysis
   - /list-files: File listing
   - /summary/:filename: Summary retrieval
   - /api/chat: Chat functionality

## Analysis Capabilities
1. **Code Structure Analysis**
   - Total Files: ${codeSummary.totalFiles}
   - Total Functions: ${codeSummary.totalFunctions}
   - Total Classes: ${codeSummary.totalClasses}

2. **Code Metrics**
   - Total Lines of Code: ${codeSummary.metrics.totalLinesOfCode}
   - Average Function Complexity: ${codeSummary.metrics.averageComplexity.toFixed(2)}
   - Maintainability Index: ${codeSummary.metrics.averageMaintainability.toFixed(2)}

3. **Dependencies**
${codeSummary.dependencies.map(dep => `   - ${dep}`).join('\n')}

4. **Main Components**
${codeSummary.mainComponents.map(comp => 
    `   - ${comp.name} (${comp.methodCount} methods, complexity: ${comp.complexity}) in ${comp.file}`
).join('\n')}

5. **Design Patterns**
${codeSummary.patterns.length > 0 
    ? codeSummary.patterns.map(pattern => 
        `   - ${pattern.type} (${pattern.location.line ? `Line ${pattern.location.line}` : 'Multiple locations'})`
    ).join('\n')
    : '   - No specific design patterns detected'
}

6. **Code Issues**
${codeSummary.issues.length > 0
    ? codeSummary.issues.map(issue => 
        `   - ${issue.type} (${issue.severity}) at ${issue.location.line ? `Line ${issue.location.line}` : 'Multiple locations'}`
    ).join('\n')
    : '   - No significant issues detected'
}

## AI-Generated Analysis
${aiSummary}

---
Generated by AI Code Analyzer on ${new Date().toISOString()}
`;
    }

    /**
     * Truncates content to stay within token limits
     * @param {string} content - The content to truncate
     * @param {number} maxTokens - Maximum number of tokens to allow
     * @returns {string} - Truncated content
     */
    truncateContent(content, maxTokens = 4000) {
        if (!content) return '';
        
        // Rough estimate: 1 token ≈ 4 characters for English text
        const maxChars = maxTokens * 4;
        
        if (content.length <= maxChars) {
            return content;
        }
        
        // Truncate to the maximum allowed characters
        let truncated = content.substring(0, maxChars);
        
        // Try to end at a paragraph or sentence if possible
        const lastParagraph = truncated.lastIndexOf('\n\n');
        const lastSentence = truncated.lastIndexOf('. ');
        
        if (lastParagraph > maxChars * 0.7) {
            truncated = truncated.substring(0, lastParagraph);
        } else if (lastSentence > maxChars * 0.7) {
            truncated = truncated.substring(0, lastSentence + 1);
        }
        
        return truncated + '\n\n[Content truncated due to length...]';
    }

    async generateAISummary(codeSummary, repoUrl, readmeContent) {
        // Truncate README content to stay within token limits
       console.log(codeSummary);
       

        
        const truncatedReadme = readmeContent ? this.truncateContent(readmeContent, 2000) : null;
        
        const prompt = `You are an expert software architect and code reviewer. Analyze this codebase and provide a comprehensive technical assessment.

        Repository URL: ${repoUrl}
        
        ${truncatedReadme ? `README Content:
        \`\`\`markdown
        ${truncatedReadme}
        \`\`\`
        
        ` : ''}
        
        Code Analysis Summary:
        - Total Files: ${codeSummary.totalFiles}
        - Total Functions: ${codeSummary.totalFunctions}
        - Total Classes: ${codeSummary.totalClasses}
        - Total Lines of Code: ${codeSummary.metrics.totalLinesOfCode}
        - Average Function Complexity: ${codeSummary.metrics.averageComplexity.toFixed(2)}
        - Average Maintainability Index: ${codeSummary.metrics.averageMaintainability.toFixed(2)}
        
        Dependencies: ${codeSummary.dependencies.join(', ')}
        
        Main Components:
        ${codeSummary.mainComponents.map(comp => 
            `- ${comp.name} (${comp.methodCount} methods, complexity: ${comp.complexity}) in ${comp.file}`
        ).join('\n')}

        Design Patterns Detected:
        ${codeSummary.patterns.map(pattern => 
            `- ${pattern.type} (${pattern.location.line ? `Line ${pattern.location.line}` : 'Multiple locations'})`
        ).join('\n')}

        Code Issues and Warnings:
        ${codeSummary.issues.map(issue => 
            `- ${issue.type} (${issue.severity}) at ${issue.location.line ? `Line ${issue.location.line}` : 'Multiple locations'}`
        ).join('\n')}

        Please provide a detailed analysis with the following sections:
        
        1. Main Purpose: What is the main purpose of this repository? What problem does it solve?   
        
        2. Core Features: what are the main features ?

        3. Key Components:what are the key components which handle the functionality ?

        4: Output:what is the output ?

        5:User Interface:what is the user interface? the flow of the application example with some diagram ?
        
        6. TECHNICAL STACK: Detail the technologies, frameworks, and libraries used.
        
        7. CODE QUALITY: Assess the code quality based on the metrics provided (complexity, maintainability, etc.).
        
        8. DESIGN PATTERNS: Analyze the use of design patterns and suggest improvements.
        
        9. CODE ISSUES: Address the identified issues and provide specific solutions.
        
        10. STRENGTHS: What are the notable strengths of this codebase?
        
        11. IMPROVEMENT OPPORTUNITIES: What areas could be improved? Consider scalability, maintainability, and best practices.
        
        12. RECOMMENDATIONS: Provide specific, actionable recommendations for enhancing the codebase.
        .`;

        try {
            const completion = await this.groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert software architect and code reviewer with deep knowledge of software engineering principles, design patterns, and best practices. Provide detailed, technical analyses of codebases with actionable insights."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating AI summary:', error);
            throw error;
        }
    }
}

module.exports = new RepoAnalyzerService(); 