
import React, { useState } from 'react';
import { Wand2, Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface AIPromptProps {
  selectedRepositories: number[];
  onCodeGenerated: (code: string) => void;
}

const AIPrompt: React.FC<AIPromptProps> = ({ selectedRepositories, onCodeGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async () => {
    if (selectedRepositories.length === 0) {
      toast({
        title: "No repositories selected",
        description: "Please select at least one repository to use as context.",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please enter a prompt for the AI to generate code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Simulate AI code generation with a timeout
    setTimeout(() => {
      // Mock generated code based on the prompt
      const generatedCode = `// Generated code based on your repositories
// Prompt: ${prompt}

function processData(data) {
  // This is a sample implementation
  const result = data.map(item => {
    return {
      id: item.id,
      processed: true,
      value: item.value * 2
    };
  });
  
  return result;
}

// Usage example:
// const data = [{ id: 1, value: 10 }, { id: 2, value: 20 }];
// const processed = processData(data);
// console.log(processed);`;

      onCodeGenerated(generatedCode);
      setIsLoading(false);
      
      toast({
        title: "Code generated",
        description: "AI has generated code based on your prompt and selected repositories.",
      });
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          AI Prompt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea 
          placeholder="Describe the code you want to generate... (e.g., 'Create a function that processes an array of data objects')"
          className="min-h-[120px]"
          value={prompt}
          onChange={handlePromptChange}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={isLoading || !prompt.trim()}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Generate Code
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AIPrompt;
