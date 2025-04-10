const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

class GitHubService {
    constructor() {
        this.git = simpleGit();
        this.tempDir = path.join(process.cwd(), 'temp_repos');
    }

    async cloneRepository(repoUrl) {
        try {
            // Create temp directory if it doesn't exist
            await fs.mkdir(this.tempDir, { recursive: true });
            
            // Generate a unique directory name based on repo URL
            const repoName = repoUrl.split('/').pop().replace('.git', '');
            const repoPath = path.join(this.tempDir, repoName);

            // Clean up existing directory if it exists
            try {
                await fs.rm(repoPath, { recursive: true, force: true });
            } catch (error) {
                console.warn(`Warning: Could not clean up directory ${repoPath}:`, error);
            }

            // Clone the repository
            await this.git.clone(repoUrl, repoPath);
            
            return repoPath;
        } catch (error) {
            console.error('Error cloning repository:', error);
            throw error;
        }
    }

    async getAllFiles(repoPath, extensions = [
        // Web files
        '.html', '.htm', '.css', '.scss', '.sass', '.less',
        // JavaScript/TypeScript
        '.js', '.jsx', '.ts', '.tsx',
        // Python
        '.py', '.pyw', '.pyi',
        // Java
        '.java',
        // C/C++
        '.c', '.cpp', '.h', '.hpp',
        // Other common files
        '.json', '.yaml', '.yml', '.xml', '.md', '.txt',
        '.env', '.config', '.conf'
    ]) {
        const files = [];
        console.log(`Scanning repository at ${repoPath} for files with extensions:`, extensions);
        
        async function traverse(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules, .git, and other common directories to ignore
                    if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
                        await traverse(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        console.log(`Found file: ${fullPath}`);
                        files.push(fullPath);
                    }
                }
            }
        }

        await traverse(repoPath);
        console.log(`Total files found: ${files.length}`);
        return files;
    }

    async readFileContent(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return null;
        }
    }

    async cleanup(repoPath) {
        try {
            await fs.rm(repoPath, { recursive: true, force: true });
        } catch (error) {
            console.error('Error cleaning up repository:', error);
        }
    }

    async findAndReadReadme(repoPath) {
        try {
            // Common README filenames
            const readmeFiles = [
                'README.md',
                'README.txt',
                'README',
                'readme.md',
                'readme.txt',
                'readme'
            ];
            
            // First check in the root directory
            const rootFiles = await fs.readdir(repoPath);
            for (const readmeFile of readmeFiles) {
                if (rootFiles.includes(readmeFile)) {
                    const readmePath = path.join(repoPath, readmeFile);
                    const content = await this.readFileContent(readmePath);
                    return { path: readmePath, content };
                }
            }
            
            // If not found in root, search recursively
            async function findReadme(dir) {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                        const fullPath = path.join(dir, entry.name);
                        const result = await findReadme(fullPath);
                        if (result) return result;
                    } else if (entry.isFile()) {
                        const fileName = entry.name.toLowerCase();
                        if (readmeFiles.some(readme => readme.toLowerCase() === fileName)) {
                            const fullPath = path.join(dir, entry.name);
                            const content = await fs.readFile(fullPath, 'utf-8');
                            return { path: fullPath, content };
                        }
                    }
                }
                return null;
            }
            
            return await findReadme(repoPath);
        } catch (error) {
            console.error('Error finding README file:', error);
            return null;
        }
    }
}

module.exports = new GitHubService(); 