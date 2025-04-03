
import React, { useState } from 'react';
import Header from '@/components/Header';
import RepositoryList from '@/components/RepositoryList';
import AIPrompt from '@/components/AIPrompt';
import CodePreview from '@/components/CodePreview';
import { Separator } from '@/components/ui/separator';

const Index = () => {
  const [selectedRepositories, setSelectedRepositories] = useState<number[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleSelectionChange = (selectedIds: number[]) => {
    setSelectedRepositories(selectedIds);
  };

  const handleCodeGenerated = (code: string) => {
    setGeneratedCode(code);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <h2 className="text-2xl font-bold mb-6">AI Repository Assistant</h2>
        <p className="text-muted-foreground mb-8">
          Select repositories to use as context, then provide a prompt for the AI to generate code based on your repositories.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold mb-4">Your Repositories</h3>
            <RepositoryList onSelectionChange={handleSelectionChange} />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Generate Code</h3>
            <AIPrompt 
              selectedRepositories={selectedRepositories} 
              onCodeGenerated={handleCodeGenerated} 
            />
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <CodePreview code={generatedCode} />
      </main>
      
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>GitHub Agent &copy; {new Date().getFullYear()} | Powered by AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
