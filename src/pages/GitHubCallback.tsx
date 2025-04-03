
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { githubService } from '@/services/github';
import { toast } from '@/hooks/use-toast';

const GitHubCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setError(error);
        toast({
          title: "Authentication Error",
          description: `GitHub authentication failed: ${error}`,
          variant: "destructive",
        });
        return;
      }

      if (!code) {
        setError('No code parameter found in URL');
        toast({
          title: "Authentication Error",
          description: "No authorization code received from GitHub",
          variant: "destructive",
        });
        return;
      }

      try {
        // In a real application, you'd exchange this code for an access token
        // using your backend since you don't want to expose your client secret in frontend code
        
        // IMPORTANT: This is a placeholder. In a real app, you would:
        // 1. Send the code to your backend
        // 2. Have your backend exchange it for a token using your client secret
        // 3. Return the token to your frontend
        
        // For the demo, we're simulating the token exchange
        // In a real app, replace this with an actual API call to your backend
        const mockToken = `mock_${Math.random().toString(36).substring(2, 15)}`;
        githubService.setToken(mockToken);
        
        toast({
          title: "Authentication Successful",
          description: "You're now connected to GitHub!",
        });
        
        navigate('/');
      } catch (error) {
        console.error('Error exchanging code for token:', error);
        setError('Failed to authenticate with GitHub');
        toast({
          title: "Authentication Error",
          description: "Failed to complete GitHub authentication",
          variant: "destructive",
        });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">
          {error ? 'Authentication Error' : 'Authenticating with GitHub...'}
        </h1>
        {error ? (
          <div className="text-destructive mb-4">{error}</div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Please wait while we complete your authentication...</p>
          </div>
        )}
        {error && (
          <button
            onClick={() => navigate('/')}
            className="w-full mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Return to Home
          </button>
        )}
      </div>
    </div>
  );
};

export default GitHubCallback;
