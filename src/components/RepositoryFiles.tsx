import React, { useState, useEffect } from 'react';
import { useGitHub } from '@/contexts/GitHubContext';
import { GitHubRepositoryFile } from '@/services/github';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File, Folder, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RepositoryFilesProps {
  owner: string;
  repo: string;
}

interface FileTreeNode extends GitHubRepositoryFile {
  children?: FileTreeNode[];
  isExpanded?: boolean;
}

const RepositoryFiles: React.FC<RepositoryFilesProps> = ({ owner, repo }) => {
  const { fetchRepositoryFiles } = useGitHub();
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const loadFiles = async (path: string = '') => {
    setLoading(true);
    try {
      const files = await fetchRepositoryFiles(owner, repo, path);
      const filesWithChildren = files.map(file => ({
        ...file,
        children: file.type === 'dir' ? [] : undefined,
        isExpanded: false
      }));
      setFiles(filesWithChildren);
      setCurrentPath(path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [owner, repo]);

  const handleFileClick = async (file: FileTreeNode) => {
    if (file.type === 'dir') {
      const updatedFiles = files.map(f => {
        if (f.path === file.path) {
          return {
            ...f,
            isExpanded: !f.isExpanded
          };
        }
        return f;
      });
      setFiles(updatedFiles);

      if (!file.isExpanded) {
        const children = await fetchRepositoryFiles(owner, repo, file.path);
        const childrenWithState = children.map(child => ({
          ...child,
          children: child.type === 'dir' ? [] : undefined,
          isExpanded: false
        }));

        const newFiles = files.map(f => {
          if (f.path === file.path) {
            return {
              ...f,
              children: childrenWithState,
              isExpanded: true
            };
          }
          return f;
        });
        setFiles(newFiles);
      }
    } else {
      setSelectedFile(file.path);
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      loadFiles(previousPath);
    }
  };

  const renderFileTree = (files: FileTreeNode[], level: number = 0) => {
    return files.map((file) => (
      <div key={file.path}>
        <div
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
            selectedFile === file.path && "bg-accent",
            level > 0 && "ml-4"
          )}
          onClick={() => handleFileClick(file)}
        >
          {file.type === 'dir' ? (
            file.isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
          {file.type === 'dir' ? (
            <Folder className="h-4 w-4 text-primary" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{file.name}</span>
          {file.type === 'file' && file.size && (
            <span className="text-xs text-muted-foreground ml-auto">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
        {file.type === 'dir' && file.isExpanded && file.children && (
          <div className="ml-2">
            {renderFileTree(file.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden min-h-[calc(100vh-12rem)]">
      {/* File Explorer Header */}
      <div className="p-2 border-b bg-muted/10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Folder className="h-4 w-4 text-primary" />
          {owner}/{repo}
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {renderFileTree(files)}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RepositoryFiles; 