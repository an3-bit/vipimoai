import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface WorkspaceTourProps {
  run: boolean;
  onComplete: () => void;
}

export function WorkspaceTour({ run, onComplete }: WorkspaceTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = [
    {
      target: '.leaflet-container',
      content: (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Welcome to Your Workspace 🗺️</h3>
          <p>This is your canvas. Your uploaded parcel boundary is displayed here. Use the layer buttons on the right to toggle between Satellite, Street, and Topographic views.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.glass-panel:has(.chat-bubble-ai), [class*="chat"]',
      content: (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Vipimo Co-Pilot 🤖</h3>
          <p>Your AI assistant! Type natural language commands like:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>"Set roads to 12m"</li>
            <li>"Change plots to 50x100ft"</li>
            <li>"Run subdivision"</li>
          </ul>
        </div>
      ),
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '.absolute.top-32.left-4',
      content: (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Manual Drafting Tools ✏️</h3>
          <p>Need to adjust a corner? Use these CAD-like tools:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>Select:</strong> View plot details</li>
            <li><strong>Polyline:</strong> Draw custom roads</li>
            <li><strong>Edit:</strong> Drag vertices</li>
            <li><strong>Split:</strong> Divide plots</li>
          </ul>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.absolute.bottom-4.left-1\\/2',
      content: (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Main Toolbar 🛠️</h3>
          <p>Quick access to all key actions:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Draw rivers & hazard zones</li>
            <li>Run auto-subdivision</li>
            <li>Save your work</li>
            <li>Export mutation forms</li>
          </ul>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: 'button[title="Generate Mutation Form"], button[title="Export Data"]',
      content: (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Export & Complete 📄</h3>
          <p>When you're done, generate the official Mutation Form (RL 7A) and export your data in multiple formats: PDF, GeoJSON, KML, or CSV.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
  ];

  const handleCallback = (data: CallBackProps) => {
    const { status, index, type } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onComplete();
    }
    
    if (type === 'step:after') {
      setStepIndex(index + 1);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: 'hsl(160, 84%, 39%)',
          backgroundColor: 'hsl(224, 71%, 4%)',
          textColor: 'hsl(213, 31%, 91%)',
          arrowColor: 'hsl(224, 71%, 4%)',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        buttonNext: {
          backgroundColor: 'hsl(160, 84%, 39%)',
          borderRadius: 8,
          padding: '8px 16px',
        },
        buttonBack: {
          color: 'hsl(213, 31%, 91%)',
          marginRight: 10,
        },
        buttonSkip: {
          color: 'hsl(215, 20.2%, 65.1%)',
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Got it!',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}
