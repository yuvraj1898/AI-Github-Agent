
import React, { useState, useEffect } from 'react';
import { Search, FolderGit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitHub } from '@/contexts/GitHubContext';
import { Button } from '@/components/ui/button';

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-600',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-blue-400',
  Vue: 'bg-green-400',
  Rust: 'bg-orange-600',
  Java: 'bg-red-600',
  PHP: 'bg-purple-500',
  Ruby: 'bg-red-400',
  C: 'bg-gray-600',
  'C#': 'bg-green-800',
  'C++': 'bg-pink-600',
  HTML: 'bg-orange-500',
  CSS: 'bg-blue-500',
};

interface RepositoryListProps {
  onSelectionChange: (selectedIds: number[]) => void;
}

const RepositoryList: React.FC<RepositoryListProps> = ({ onSelectionChange }) => {
  const { repositories, loading, fetchRepositories, isAuthenticated } = useGitHub();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepositories, setSelectedRepositories] = useState<number[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRepositories();
    }
  }, [isAuthenticated, fetchRepositories]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRepositorySelect = (id: number) => {
    setSelectedRepositories(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(repoId => repoId !== id)
        : [...prev, id];
      
      onSelectionChange(newSelection);
      return newSelection;
    });
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/20 rounded-lg h-[400px]">
        <FolderGit2 className="h-12 w-12 text-primary/40 mb-4" />
        <h3 className="text-xl font-medium mb-2">Connect to GitHub</h3>
        <p className="text-muted-foreground text-center mb-4">
          Connect your GitHub account to access and select your repositories.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          className="pl-10"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {selectedRepositories.length} repositories selected
        </div>
        {!loading && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchRepositories()}
          >
            Refresh
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : repositories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg h-[400px]">
          <FolderGit2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No repositories found</h3>
          <p className="text-muted-foreground text-center">
            You don't have any repositories or we couldn't access them.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRepositories.map(repo => (
              <Card 
                key={repo.id} 
                className={`repository-card ${selectedRepositories.includes(repo.id) ? 'selected' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id={`repo-${repo.id}`}
                        checked={selectedRepositories.includes(repo.id)}
                        onCheckedChange={() => handleRepositorySelect(repo.id)}
                      />
                      <div className="flex flex-col">
                        <label 
                          htmlFor={`repo-${repo.id}`}
                          className="font-medium cursor-pointer flex items-center gap-2"
                        >
                          <FolderGit2 className="h-4 w-4 text-primary" />
                          {repo.name}
                        </label>
                        {repo.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {repo.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {repo.language && (
                      <>
                        <div className={`w-3 h-3 rounded-full ${languageColors[repo.language] || 'bg-gray-400'}`} />
                        <span className="text-xs text-muted-foreground">{repo.language}</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">⭐ {repo.stargazers_count}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default RepositoryList;
