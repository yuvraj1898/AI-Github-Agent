import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGitHub } from '@/contexts/GitHubContext';
import RepositoryFiles from '@/components/RepositoryFiles';
import CodeModificationChat from '@/components/CodeModificationChat';
import CodebaseAnalyzer from '@/components/CodebaseAnalyzer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
const RepositoryView: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const { user } = useGitHub();
  const [activeTab, setActiveTab] = useState('files');

 
  const [isEmbedding, setIsEmbedding] = useState(true);

  // useEffect(() => {
  //   const embedRepo = async () => {
  //     try {
  //       const repoUrl = `https://github.com/${owner}/${repo}`;
  //       await axios.post('http://localhost:3000/process-repo', { repoUrl });
  //     } catch (error) {
  //       console.error('❌ Error embedding:', error);
  //     } finally {
  //       setIsEmbedding(false);
  //     }
  //   };
  
  //   embedRepo();
  // }, [owner, repo]);

  if (!owner || !repo) {
    return <div>Repository not found</div>;
  }

  return (
    <div className="container-fluid mx-auto py-8 space-y-6 px-4 min-h-screen">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">
          {owner}/{repo}
        </h1>
      </div>
      {isEmbedding && <p className="text-muted-foreground">Embedding codebase in background...</p>}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3">
          <RepositoryFiles owner={owner} repo={repo} />
        </div>
        <div className="col-span-9">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Files
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="files" className="h-[calc(100vh-12rem)]">
              <div className="grid grid-rows-2 gap-6 h-full">
                {/* Content area for file preview or other repository information */}
                {/* <div className="border rounded-lg p-4 min-h-[calc(50vh-8rem)]">
                  <p className="text-muted-foreground">Select a file to view its contents</p>
                </div> */}
                
                {/* Codebase Analysis */}
                <div >
                  <CodebaseAnalyzer owner={owner} repo={repo} />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="h-[calc(100vh-12rem)]">
              <CodeModificationChat />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default RepositoryView; 