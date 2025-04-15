import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Code, RefreshCw } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface CodeDiff {
  before: string;
  after: string;
  filePath: string;
}

const CodeModificationChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [codeDiffs, setCodeDiffs] = useState<CodeDiff[]>([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [repoId, setRepoId] = useState<string | null>(null); 

  // Load history when component mounts
  useEffect(() => {
    // Dynamically generate repoId based on owner and repo
    const generateRepoId = (owner: string, repo: string) => {
      const repoString = `${owner}-${repo}`;
      return repoString; // You can use the repoString or hash it for uniqueness
    };

    if (owner && repo) {
      const generatedRepoId = generateRepoId(owner, repo);
      setRepoId(generatedRepoId); // Set the repoId state dynamically
    }
  }, [owner, repo]);
  
  useEffect(() => {
    if (repoId) {
      fetchChatHistory();
    }
  }, []);
  
  const fetchChatHistory = async () => {
    const savedHistory = localStorage.getItem(repoId || '');
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      setMessages(parsedHistory.messages);
      setCodeDiffs(parsedHistory.codeDiffs || []);
    }
  };
  
  const handleSendMessage = async () => {
    if (!input.trim() || !repoId) return;
  
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
      timestamp: new Date(),
    };
  
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
  
    try {
      const response = await axios.post('http://localhost:3000/api/chat/ask', {
        question: input,
        messageHistory: newMessages,
        repoId,
      });
  
      if (response.data) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.data.answer || "I couldn't process your request.",
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
  
        if (response.data.codeDiffs && Array.isArray(response.data.codeDiffs)) {
          setCodeDiffs(response.data.codeDiffs);
        }
  
        // Save the new history to localStorage
        const updatedHistory = {
          messages: [...newMessages, aiMessage],
          codeDiffs: response.data.codeDiffs,
        };
        localStorage.setItem(repoId, JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: "Sorry, there was an error processing your request.",
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <CardHeader className="p-4 border-b bg-muted/10">
        <CardTitle className="text-lg">Code Modification Assistant</CardTitle>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="px-4 py-2 border-b">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="diffs" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Code Diffs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Ask the AI to help you modify your code.</p>
                  <p className="text-sm mt-2">Example: "Add error handling to this function"</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-100" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <CardFooter className="p-4 border-t">
            <div className="flex w-full gap-2">
              <Input
                placeholder="Ask the AI to modify your code..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <Button onClick={handleSendMessage} disabled={isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </TabsContent>

        <TabsContent value="diffs" className="flex-1 p-0 m-0">
          <ScrollArea className="h-full">
            {codeDiffs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No code modifications yet.</p>
                <p className="text-sm mt-2">Ask the AI to help you modify your code.</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {codeDiffs.map((diff, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="p-3 bg-muted/10">
                      <CardTitle className="text-sm font-medium">
                        {diff.filePath}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 divide-x">
                        <div className="p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Before
                          </div>
                          <pre className="text-xs bg-muted/30 p-2 rounded-md overflow-x-auto">
                            <code>{diff.before}</code>
                          </pre>
                        </div>
                        <div className="p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            After
                          </div>
                          <pre className="text-xs bg-muted/30 p-2 rounded-md overflow-x-auto">
                            <code>{diff.after}</code>
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeModificationChat;
