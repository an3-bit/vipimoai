import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: number;
  title: string;
  description: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardProgress({ steps, currentStep, onStepClick }: WizardProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || step.id <= currentStep);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step Circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  isCompleted && "bg-survey-primary border-survey-primary text-primary-foreground",
                  isCurrent && "border-survey-primary bg-survey-primary/20 text-survey-primary",
                  !isCompleted && !isCurrent && "border-muted-foreground/30 bg-background text-muted-foreground",
                  isClickable && "cursor-pointer hover:scale-110",
                  !isClickable && "cursor-default"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </button>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-all",
                      currentStep > step.id ? "bg-survey-primary" : "bg-muted-foreground/20"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Labels */}
      <div className="flex items-start justify-between mt-3">
        {steps.map((step) => {
          const isCurrent = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center text-center flex-1 last:flex-none px-1",
                isCurrent && "text-foreground",
                isCompleted && "text-survey-primary",
                !isCurrent && !isCompleted && "text-muted-foreground"
              )}
            >
              <span className={cn("text-xs font-medium", isCurrent && "font-semibold")}>
                {step.title}
              </span>
              <span className="text-[10px] hidden md:block mt-0.5">
                {step.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
