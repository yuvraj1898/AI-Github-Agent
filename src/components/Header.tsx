
import React from 'react';
import { Github, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header = () => {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">GitHub Agent</h1>
        </div>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Github className="h-4 w-4" />
          Connect GitHub
        </Button>
      </div>
    </header>
  );
};

export default Header;
