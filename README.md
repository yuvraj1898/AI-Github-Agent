# AI Code Analyzer

An advanced code analysis tool that uses AI to analyze and understand codebases. The tool provides comprehensive insights into code structure, complexity, patterns, and potential issues.

## Features

- **Code Analysis**
  - Language-specific analysis (JavaScript/TypeScript support)
  - Cyclomatic complexity calculation
  - Design pattern detection
  - Security vulnerability scanning
  - Dependency analysis

- **AI-Powered Insights**
  - Code embeddings for semantic search
  - AI-generated code summaries
  - Pattern recognition
  - Recommendations for improvement

- **Vector Storage**
  - Efficient storage of code embeddings
  - Similar code search
  - Metadata management

## Prerequisites

- Node.js (v14 or higher)
- OpenAI API key
- Pinecone API key
- GitHub credentials (optional)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-code-analyzer.git
   cd ai-code-analyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your API keys and credentials

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Send a POST request to analyze a repository:
   ```bash
   curl -X POST http://localhost:3000/analyze \
     -H "Content-Type: application/json" \
     -d '{"repoUrl": "https://github.com/username/repo.git"}'
   ```

## API Endpoints

### POST /analyze
Analyzes a GitHub repository and returns comprehensive insights.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/username/repo.git"
}
```

**Response:**
```json
{
  "analysis": {
    "files": [...],
    "metrics": {
      "totalFiles": 10,
      "languageDistribution": {...},
      "complexity": {...}
    }
  },
  "summary": "..."
}
```

## Project Structure

```
src/
├── analyzers/          # Language-specific analyzers
├── services/           # Core services
├── utils/             # Utility functions
├── config/            # Configuration
└── server.js          # Main server file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for providing the GPT and embedding models
- Pinecone for vector storage
- Babel for JavaScript parsing
