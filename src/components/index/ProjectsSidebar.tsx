import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Plus, LogOut, User, CheckCircle, Clock, FileText, Loader2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  acres: number;
  plots: number;
}

interface ProjectsSidebarProps {
  projects: Project[];
  isLoading: boolean;
  user: any;
  onNewProject: () => void;
  onSignOut: () => void;
}

const statusColors = {
  draft: 'text-muted-foreground',
  in_progress: 'text-warning',
  completed: 'text-success',
  archived: 'text-muted-foreground',
};

export function ProjectsSidebar({
  projects,
  isLoading,
  user,
  onNewProject,
  onSignOut,
}: ProjectsSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="w-80 h-full border-r border-border/50 bg-background flex-shrink-0 overflow-y-auto">
      <div className="h-full glass-panel border-r border-border/50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg">VipimoAI</h1>
            <p className="text-xs text-muted-foreground">Land Surveyor's Co-Pilot</p>
          </div>
        </div>

        {/* Projects List */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {isLoading ? 'Loading...' : `Projects (${projects.length})`}
              </h2>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={onNewProject}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-4">No projects yet</p>
                <Button 
                  size="sm"
                  onClick={onNewProject}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/workspace/${project.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${statusColors[project.status as keyof typeof statusColors]}`}>
                        {project.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : project.status === 'in_progress' ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {project.client_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{project.acres} ac</span>
                          <span>•</span>
                          <span>{project.plots} plots</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/50">
          {user ? (
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 w-full hover:bg-secondary/50 p-2 rounded-lg transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">View Profile</p>
                </div>
                <User className="h-4 w-4 text-muted-foreground" />
              </button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onSignOut} 
                className="w-full justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              Sign In to Create Projects
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
