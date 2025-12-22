import { AlertTriangle, ArrowRight, CheckCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AISuggestion } from '@/types/survey';

interface SuggestionsPanel {
  suggestions: AISuggestion[];
  onApplySuggestion?: (suggestion: AISuggestion) => void;
}

export function SuggestionsPanel({ suggestions, onApplySuggestion }: SuggestionsPanel) {
  if (suggestions.length === 0) {
    return null;
  }

  const getIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-survey-warning" />;
      case 'resize':
        return <RefreshCw className="h-4 w-4 text-survey-accent" />;
      case 'extract_full':
        return <CheckCircle className="h-4 w-4 text-survey-success" />;
      case 'alternative_layout':
        return <Lightbulb className="h-4 w-4 text-survey-primary" />;
      default:
        return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (type: AISuggestion['type']) => {
    switch (type) {
      case 'warning':
        return 'destructive';
      case 'resize':
        return 'secondary';
      case 'extract_full':
        return 'default';
      case 'alternative_layout':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-survey-primary" />
          AI Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2"
          >
            <div className="flex items-start gap-2">
              {getIcon(suggestion.type)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getBadgeVariant(suggestion.type)} className="text-xs">
                    {suggestion.type.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.message}</p>
              </div>
            </div>

            {/* Show suggested values if available */}
            {(suggestion.suggested_width || suggestion.suggested_depth || suggestion.suggested_count) && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
                {suggestion.suggested_width && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Width:</span>{' '}
                    <span className="font-mono text-survey-primary">
                      {suggestion.suggested_width.toFixed(1)}m
                    </span>
                  </div>
                )}
                {suggestion.suggested_depth && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Depth:</span>{' '}
                    <span className="font-mono text-survey-primary">
                      {suggestion.suggested_depth.toFixed(1)}m
                    </span>
                  </div>
                )}
                {suggestion.suggested_count && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Plots:</span>{' '}
                    <span className="font-mono text-survey-accent">
                      {suggestion.suggested_count}
                    </span>
                  </div>
                )}
                {onApplySuggestion && suggestion.type !== 'warning' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => onApplySuggestion(suggestion)}
                  >
                    Apply
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
