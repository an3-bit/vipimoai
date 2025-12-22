import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Layers, FileOutput, Cpu, ArrowRight, CheckCircle } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();

  const features = [
    {
      icon: MapPin,
      title: 'Upload & Map',
      description: 'Upload coordinates (CSV/DXF), auto-detect CRS, calculate area and map parcel in satellite view.',
    },
    {
      icon: Layers,
      title: 'AI Subdivision',
      description: 'Set plot sizes, setbacks, and let AI subdivide with terrain awareness and road detection.',
    },
    {
      icon: Cpu,
      title: 'Smart Alternatives',
      description: 'Get intelligent suggestions when plots don\'t fit—resize, extract full plots, or adjust.',
    },
    {
      icon: FileOutput,
      title: 'Professional Exports',
      description: 'Generate mutation maps, beacon lists, GIS files, and client-ready PDF exports instantly.',
    },
  ];

  const workflowSteps = [
    'Upload parent parcel coordinates',
    'Inspect boundaries and beacons',
    'Configure subdivision parameters',
    'AI generates optimal plot layout',
    'Interactive adjustments if needed',
    'Export professional outputs',
  ];

  return (
    <div className="min-h-screen bg-topographic">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-xl">SurveyAI Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button variant="survey" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Cpu className="h-4 w-4" />
            AI-Powered Land Surveying
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Professional Land Subdivision
            <span className="block text-gradient">Made Effortless</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload coordinates, set parameters, and let AI subdivide your parcel intelligently. 
            Generate beacon lists, mutation maps, and GIS exports in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="survey" size="xl" onClick={() => navigate('/auth')}>
              Start Free Project
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="xl">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Complete Survey Workflow</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Replace multiple tools with one fast, reliable, AI-enhanced system
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} variant="glow" className="fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Workflow Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple 6-Step Workflow</h2>
            <p className="text-muted-foreground">From upload to export in minutes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowSteps.map((step, index) => (
              <div 
                key={index} 
                className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{index + 1}</span>
                </div>
                <span className="text-sm">{step}</span>
                <CheckCircle className="h-4 w-4 text-success ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Survey Workflow?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join professional surveyors using AI to subdivide land faster and more accurately.
            </p>
            <Button variant="survey" size="xl" onClick={() => navigate('/auth')}>
              Create Your First Project
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 SurveyAI Pro. Professional Land Subdivision System.</p>
        </div>
      </footer>
    </div>
  );
}
