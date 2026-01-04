import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, MessageSquare, Send } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface WorkspaceChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  input: string;
  onInputChange: (input: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isProcessing: boolean;
}

export function WorkspaceChat({
  open,
  onOpenChange,
  messages,
  input,
  onInputChange,
  onSubmit,
  isProcessing,
}: WorkspaceChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="absolute bottom-24 right-4 z-[1000]">
      {/* Chat Panel */}
      <div className={`transition-all duration-300 ${open ? 'mb-2' : 'h-0 overflow-hidden'}`}>
        <div className="glass-panel rounded-xl w-80 overflow-hidden">
          {/* Chat Header */}
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Vipimo Co-Pilot</p>
                <p className="text-xs text-muted-foreground">AI Assistant</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1 hover:bg-secondary rounded">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="h-64 p-3">
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <form onSubmit={onSubmit} className="p-3 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Ask Vipimo..."
                className="bg-secondary/50 text-sm"
                disabled={isProcessing}
              />
              <Button type="submit" size="icon" className="shrink-0" disabled={isProcessing}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Chat Toggle Button */}
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="glass-panel rounded-full p-4 hover:bg-secondary/80 transition-colors shadow-glow"
        >
          <MessageSquare className="h-6 w-6 text-primary" />
        </button>
      )}
    </div>
  );
}
