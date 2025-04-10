import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { githubService, GitHubUser, GitHubRepository, GitHubRepositoryFile } from '@/services/github';
import { toast } from '@/hooks/use-toast';

interface GitHubContextProps {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepository[];
  loading: boolean;
  login: () => void;
  logout: () => void;
  fetchRepositories: () => Promise<void>;
  fetchRepositoryFiles: (owner: string, repo: string, path?: string) => Promise<GitHubRepositoryFile[]>;
}

const GitHubContext = createContext<GitHubContextProps | undefined>(undefined);

export const GitHubProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(githubService.isAuthenticated);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const initializeGitHub = async () => {
      if (githubService.isAuthenticated) {
        setLoading(true);
        try {
          const userProfile = await githubService.fetchUserProfile();
          setUser(userProfile);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to initialize GitHub session:', error);
          githubService.clearToken();
          setIsAuthenticated(false);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeGitHub();
  }, []);

  const login = () => {
    window.location.href = githubService.getAuthUrl();
  };

  const logout = () => {
    githubService.clearToken();
    setIsAuthenticated(false);
    setUser(null);
    setRepositories([]);
    toast({
      title: "Logged out",
      description: "You have been logged out of GitHub",
    });
  };

  const fetchRepositories = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const repos = await githubService.fetchRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch repositories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchRepositoryFiles = useCallback(async (owner: string, repo: string, path: string = '') => {
    if (!isAuthenticated) return [];

    try {
      return await githubService.fetchRepositoryFiles(owner, repo, path);
    } catch (error) {
      console.error('Failed to fetch repository files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch repository files",
        variant: "destructive",
      });
      return [];
    }
  }, [isAuthenticated]);

  // Fetch repositories only once when authenticated
  useEffect(() => {
    if (isAuthenticated && repositories.length === 0) {
      fetchRepositories();
    }
  }, [isAuthenticated, fetchRepositories, repositories.length]);

  return (
    <GitHubContext.Provider
      value={{
        isAuthenticated,
        user,
        repositories,
        loading,
        login,
        logout,
        fetchRepositories,
        fetchRepositoryFiles,
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
};

export const useGitHub = () => {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
};
