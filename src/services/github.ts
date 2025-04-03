
export interface GitHubRepository {
  id: number;
  name: string;
  description: string;
  language: string;
  stargazers_count: number;
  html_url: string;
  private: boolean;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

class GitHubService {
  private token: string | null = null;
  private clientId = "YOUR_GITHUB_CLIENT_ID"; // Replace with your GitHub OAuth App client ID

  constructor() {
    // Initialize token from localStorage if available
    this.token = localStorage.getItem('github_token');
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('github_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('github_token');
  }

  getAuthUrl(): string {
    const redirectUri = `${window.location.origin}/github-callback`;
    const scope = 'repo user';
    return `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    // In a real application, this should be handled by your backend
    // Since the client secret should not be exposed in frontend code
    
    // This is a placeholder for demonstration - in production, you would:
    // 1. Send the code to your backend
    // 2. Have backend exchange it for a token using client_id and client_secret
    // 3. Return the token to frontend
    
    try {
      // Simulating a backend request for demonstration purposes
      console.log('Exchanging code for token:', code);
      
      // For demo purposes, we'll return a mock token
      // In a real app, replace this with an actual fetch to your backend
      return Promise.resolve(`github_token_${Date.now()}`);
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw new Error('Failed to authenticate with GitHub');
    }
  }

  async fetchUserProfile(): Promise<GitHubUser> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json();
  }

  async fetchRepositories(): Promise<GitHubRepository[]> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    return response.json();
  }
}

export const githubService = new GitHubService();
