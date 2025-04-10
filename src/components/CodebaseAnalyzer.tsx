import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, RefreshCw } from 'lucide-react';
import { useGitHub } from '@/contexts/GitHubContext';

interface CodebaseSummary {
  aiSummary: string;
  codeAnalysis: {
    dependencies: string[];
    issues: {
      type: string;
      severity: string;
      location: any;
    }[];
    mainComponents: {
      name: string;
      file: string;
      methodCount: number;
    }[];
    metrics: {
      averageComplexity: number;
      averageMaintainability: number;
      totalLinesOfCode: number;
    };
    patterns: {
      type: string;
      location: any;
    }[];
    totalClasses: number;
    totalFiles: number;
  };
}


interface GitHubFile {
  path: string;
  type: string;
  content?: string;
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_FILES_PER_BATCH = 10;

const CodebaseAnalyzer: React.FC<{ owner: string; repo: string }> = ({ owner, repo }) => {
  const { fetchRepositoryFiles } = useGitHub();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summary, setSummary] = useState<CodebaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [analyzedFiles, setAnalyzedFiles] = useState<string[]>([]);

  const analyzeCodebase = async () => {
    setIsAnalyzing(true);
    setError(null);
    setFileCount(0);
    setAnalyzedFiles([]);
    
    try {
      // First, get all files in the repository
      const files = await fetchAllFiles(owner, repo);
      setFileCount(files.length);
      
      // Process files in batches to avoid rate limiting
      const fileContents: { path: string; content: string }[] = [];
      
      for (let i = 0; i < files.length; i += MAX_FILES_PER_BATCH) {
        const batch = files.slice(i, i + MAX_FILES_PER_BATCH);
        const batchPromises = batch.map(async (file) => {
          try {
            const content = await fetchFileContent(owner, repo, file.path);
            setAnalyzedFiles(prev => [...prev, file.path]);
            return { path: file.path, content };
          } catch (err) {
            console.error(`Error fetching content for ${file.path}:`, err);
            return { path: file.path, content: '' };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        fileContents.push(...batchResults);
      }
      
      // Filter out files with no content and large files
      const validFiles = fileContents
        .filter(file => file.content)
        .map(file => ({
          ...file,
          content: file.content.length > MAX_FILE_SIZE 
            ? file.content.substring(0, MAX_FILE_SIZE) + '... (truncated)'
            : file.content
        }));
      
      // Generate summary using OpenAI
      const summary = await generateSummary(validFiles);
      setSummary(summary);
    } catch (err) {
      console.error('Error analyzing codebase:', err);
      setError('Failed to analyze the codebase. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  function parseSummarySections(summary: string) {
    const sections = summary.split(/\n### /).filter(Boolean);
  
    return sections.map(section => {
      const [titleLine, ...rest] = section.split('\n');
      const title = titleLine.trim();
      const content = rest.join('\n').trim();
      return { title, content };
    });
  }
  const fetchAllFiles = async (owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> => {
    const files = await fetchRepositoryFiles(owner, repo, path);
    const allFiles: GitHubFile[] = [];
    
    for (const file of files) {
      if (file.type === 'dir') {
        const subFiles = await fetchAllFiles(owner, repo, file.path);
        allFiles.push(...subFiles);
      } else {
        allFiles.push(file);
      }
    }
    
    return allFiles;
  };

  const fetchFileContent = async (owner: string, repo: string, path: string): Promise<string> => {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${localStorage.getItem('github_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }
      
      const data = await response.json();
      return atob(data.content);
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error);
      return '';
    }
  };

  const generateSummary = async (
    files: { path: string; content: string }[]
  ): Promise<CodebaseSummary> => {
    try {
      const response = await fetch('http://localhost:3000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: `https://github.com/${owner}/${repo}.git`,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to generate summary: ${response.status} ${response.statusText}`
        );
      }
  
      const data = await response.json();
      console.log(data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate summary');
      }
  
      // Use structured fields from response
      const aiSummary = data.summary?.aiSummary || '';
      const codeAnalysis = data.summary?.codeAnalysis || {
        dependencies: [],
        issues: [],
        mainComponents: [],
        metrics: {
          averageComplexity: 0,
          averageMaintainability: 0,
          totalLinesOfCode: 0,
        },
        patterns: [],
        totalClasses: 0,
        totalFiles: 0,
      };
  
      return {
        aiSummary,
        codeAnalysis,
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate codebase summary');
    }
  };
  

  // Helper functions to extract sections from the summary text
 

  return (
    <Card className="h-auto">
      <CardHeader className="p-4 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Codebase Analysis
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={analyzeCodebase}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Analyze
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100%-57px)]">
          {isAnalyzing ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Analyzing codebase...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {analyzedFiles.length} of {fileCount} files processed
                </p>
              </div>
              <div className="space-y-2">
                {analyzedFiles.slice(-5).map((file, index) => (
                  <div key={index} className="text-xs text-muted-foreground truncate">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={analyzeCodebase}
              >
                Try Again
              </Button>
            </div>
          ) : summary ? (
            <div className="p-6 space-y-6">
  {/* AI Summary */}

  {parseSummarySections(summary.aiSummary).map((section, index) => (
  <section key={index} className="mb-6">
    <h3 className="text-base font-semibold text-foreground mb-2">{section.title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
      {section.content}
    </p>
  </section>
))}

  {/* Main Components */}
  <section>
    <h3 className="text-base font-semibold text-foreground mb-2">Main Components</h3>
    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      {summary.codeAnalysis.mainComponents.map((comp, index) => (
        <li key={index}>
          <span className="font-medium text-foreground">{comp.name}</span> ({comp.methodCount} methods) in <code className="text-xs bg-muted px-1 py-0.5 rounded">{comp.file}</code>
        </li>
      ))}
    </ul>
  </section>

  {/* Dependencies */}
  <section>
  <h3 className="text-base font-semibold text-foreground mb-2">Dependencies</h3>
  <div className="flex flex-wrap gap-2">
    {summary.codeAnalysis.dependencies.map((dep, index) => (
      <div
        key={index}
        className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary font-medium shadow-sm transition hover:bg-primary/10"
      >
        <span className="truncate">{dep}</span>
      </div>
    ))}
  </div>
</section>  

  {/* Metrics */}
  <section>
    <h3 className="text-base font-semibold text-foreground mb-2">Metrics</h3>
    <div className="text-sm text-muted-foreground space-y-1">
      <div>Avg. Complexity: <span className="font-medium text-foreground">{summary.codeAnalysis.metrics.averageComplexity}</span></div>
      <div>Avg. Maintainability: <span className="font-medium text-foreground">{summary.codeAnalysis.metrics.averageMaintainability}</span></div>
      <div>Total Lines of Code: <span className="font-medium text-foreground">{summary.codeAnalysis.metrics.totalLinesOfCode}</span></div>
    </div>
  </section>
</div>


          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <p>Click "Analyze" to generate a summary of this codebase.</p>
              <p className="text-sm mt-2">
                This will analyze all files in the repository and provide insights about the codebase.
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default CodebaseAnalyzer; 