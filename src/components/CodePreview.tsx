
import React, { useState } from 'react';
import { Save, Copy, Check, XCircle } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface CodePreviewProps {
  code: string;
}

const CodePreview: React.FC<CodePreviewProps> = ({ code }) => {
  const [fileName, setFileName] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Code has been copied to your clipboard.",
      });
    });
  };

  const handleSave = () => {
    if (!fileName.trim()) {
      toast({
        title: "Filename required",
        description: "Please enter a filename to save the generated code.",
        variant: "destructive",
      });
      return;
    }

    // Create a blob and download the file
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.includes('.') ? fileName : `${fileName}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File saved",
      description: `Code has been saved as "${a.download}".`,
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Generated Code</CardTitle>
      </CardHeader>
      <CardContent>
        {code ? (
          <pre className="code-preview">{code}</pre>
        ) : (
          <div className="flex items-center justify-center h-[200px] border border-dashed rounded-md border-muted-foreground/50">
            <p className="text-muted-foreground">Generated code will appear here</p>
          </div>
        )}
      </CardContent>
      {code && (
        <CardFooter className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 w-full">
            <Input
              placeholder="Enter filename to save (e.g. process.js)"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleCopy}>
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save File
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default CodePreview;
