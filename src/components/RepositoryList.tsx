
import React, { useState } from 'react';
import { Search, FolderGit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

// Mock data for repositories
const mockRepositories = [
  { id: 1, name: 'react-portfolio', language: 'TypeScript', stars: 45, description: 'My personal portfolio built with React' },
  { id: 2, name: 'node-api', language: 'JavaScript', stars: 32, description: 'RESTful API built with Node.js and Express' },
  { id: 3, name: 'python-ml', language: 'Python', stars: 78, description: 'Machine learning experiments with Python' },
  { id: 4, name: 'go-microservices', language: 'Go', stars: 23, description: 'Microservices architecture with Go' },
  { id: 5, name: 'vue-dashboard', language: 'Vue', stars: 56, description: 'Admin dashboard built with Vue.js' },
  { id: 6, name: 'rust-game', language: 'Rust', stars: 19, description: '2D game built with Rust and WebAssembly' },
];

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-600',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Go: 'bg-blue-400',
  Vue: 'bg-green-400',
  Rust: 'bg-orange-600',
};

interface RepositoryListProps {
  onSelectionChange: (selectedIds: number[]) => void;
}

const RepositoryList: React.FC<RepositoryListProps> = ({ onSelectionChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepositories, setSelectedRepositories] = useState<number[]>([]);

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

  const filteredRepositories = mockRepositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <div className="text-sm text-muted-foreground">
        {selectedRepositories.length} repositories selected
      </div>

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
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {repo.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-3 h-3 rounded-full ${languageColors[repo.language] || 'bg-gray-400'}`} />
                  <span className="text-xs text-muted-foreground">{repo.language}</span>
                  <span className="text-xs text-muted-foreground ml-auto">⭐ {repo.stars}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RepositoryList;
