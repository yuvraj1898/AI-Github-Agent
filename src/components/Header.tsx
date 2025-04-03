
import React from 'react';
import { Github, Code2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHub } from '@/contexts/GitHubContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const { isAuthenticated, user, login, logout } = useGitHub();

  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">GitHub Agent</h1>
        </div>
        
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.name || user.login}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarImage src={user.avatar_url} alt={user.login} />
                  <AvatarFallback>{user.login.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
            onClick={login}
          >
            <Github className="h-4 w-4" />
            Connect GitHub
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
