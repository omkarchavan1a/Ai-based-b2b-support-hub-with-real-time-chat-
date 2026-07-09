import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, ChevronRight, ChevronLeft, HelpCircle, X, 
  Play, BookOpen, Layers, MessageSquare, Zap, Target, Wifi
} from 'lucide-react';

export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'right' | 'left' | 'top' | 'bottom' | 'center';
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tabId: 'chat' | 'kb' | 'analytics' | 'settings') => void;
  onOpenWidgetSimulator: () => void;
}

export default function OnboardingTour({ 
  isOpen, 
  onClose,
  onNavigateToTab,
  onOpenWidgetSimulator
}: OnboardingTourProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(-1); // -1 is Welcome screen
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const steps: TourStep[] = [
    {
      id: 'nav',
      targetId: 'tour-nav-container',
      title: 'Command Navigation',
      description: 'Switch between Live Chat Queues, the Knowledge Base, Real-time Analytics, and App Settings.',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      position: 'right'
    },
    {
      id: 'queue',
      targetId: 'tour-queue-section',
      title: 'Customer Support Queue',
      description: 'Review active customer tickets, priority states, metadata tags, and easily filter conversations.',
      icon: <MessageSquare className="w-5 h-5 text-emerald-400" />,
      position: 'right'
    },
    {
      id: 'connection',
      targetId: 'tour-connection-badge',
      title: 'Live Link Status',
      description: 'Displays active WebSocket sync. Click this icon to view status details or simulate network disconnects.',
      icon: <Wifi className="w-5 h-5 text-amber-400" />,
      position: 'right'
    },
    {
      id: 'copilot',
      targetId: 'tour-copilot-section',
      title: 'AI Copilot Panel',
      description: 'Generates instant, professional suggestions grounded on your Knowledge Base articles using advanced RAG.',
      icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
      position: 'left'
    },
    {
      id: 'kb-nav',
      targetId: 'tour-nav-kb',
      title: 'Knowledge Base (KB)',
      description: 'Manage helpdesk articles. Grounding the AI with rich documentation guarantees accurate, contextual suggestions.',
      icon: <BookOpen className="w-5 h-5 text-purple-400" />,
      position: 'right'
    },
    {
      id: 'simulator',
      targetId: 'tour-simulator-btn',
      title: 'Live Customer Simulator',
      description: 'Open the slide-out widget on the right. Chat as a simulated customer and watch the agent dashboard respond instantly in real-time!',
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      position: 'left'
    }
  ];

  // Effect to handle navigation adjustments when moving between steps
  useEffect(() => {
    if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
      const step = steps[currentStepIdx];
      
      // Auto-switch tabs to make the targets visible
      if (step.id === 'kb-nav') {
        onNavigateToTab('chat'); // Keep visible on the left navigation bar
      } else if (step.id === 'copilot') {
        onNavigateToTab('chat');
      }
    }
  }, [currentStepIdx]);

  // Recalculate spotlight coordinates of targeted elements
  const updateSpotlight = () => {
    if (currentStepIdx === -1) {
      setCoords(null);
      return;
    }

    const step = steps[currentStepIdx];
    const element = document.getElementById(step.targetId);

    if (element) {
      const rect = element.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    } else {
      // Element might be hidden (e.g. Copilot requires active chat)
      // Fallback to center spotlight or slightly offset
      setCoords(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateSpotlight();
    }
  }, [currentStepIdx, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(updateSpotlight, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [currentStepIdx, isOpen]);

  if (!isOpen) return null;

  const currentStep = currentStepIdx >= 0 ? steps[currentStepIdx] : null;

  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      // If going to simulator step, proactively ensure it can be pointed to
      if (steps[currentStepIdx + 1]?.id === 'simulator') {
        // Just let the user click it
      }
      setCurrentStepIdx(prev => prev + 1);
    } else {
      // Complete tour
      localStorage.setItem('onboarding_completed', 'true');
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStepIdx > -1) {
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* Dimmed backdrop overlay */}
      <div 
        className="absolute inset-0 bg-zinc-950/70 transition-opacity duration-300" 
        onClick={handleSkip}
      />

      {/* SVG Spotlight Mask to shine a light on the focused UI element */}
      {coords && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect 
                x={coords.left - 6} 
                y={coords.top - 6} 
                width={coords.width + 12} 
                height={coords.height + 12} 
                rx="12" 
                ry="12" 
                fill="black" 
              />
            </mask>
          </defs>
          <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="black" 
            opacity="0.35" 
            mask="url(#spotlight-mask)" 
          />
          {/* Spotlight glowing frame */}
          <rect
            x={coords.left - 6}
            y={coords.top - 6}
            width={coords.width + 12}
            height={coords.height + 12}
            rx="12"
            ry="12"
            fill="transparent"
            stroke="rgb(99, 102, 241)"
            strokeWidth="3"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Interactive Guide Card Container */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 p-4">
        <AnimatePresence mode="wait">
          {currentStepIdx === -1 ? (
            /* Welcome Screen Card */
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              className="bg-white rounded-2xl border border-zinc-200 p-6 max-w-md w-full shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-zinc-950 text-base">Workspace Interactive Guide</h2>
                  <p className="text-[10px] text-zinc-500 font-medium">Map out all live-simulator features in 1 minute</p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed mb-5">
                Welcome! This platform simulates a real-time corporate customer support environment equipped with an **AI Copilot (RAG)** and a **live client chat simulator**.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">1</div>
                  <p className="text-[11px] text-zinc-500">
                    <strong className="text-zinc-700">Simulate Visitors:</strong> Instantly create rich mock-up customer profiles with complex technical questions.
                  </p>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">2</div>
                  <p className="text-[11px] text-zinc-500">
                    <strong className="text-zinc-700">AI Copilot RAG:</strong> View context-driven automated responses generated directly from Knowledge Base entries.
                  </p>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">3</div>
                  <p className="text-[11px] text-zinc-500">
                    <strong className="text-zinc-700">Live Dual Chat:</strong> Use the Customer Simulator to chat in real-time, verifying live WebSocket connectivity & database failovers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="flex-1 py-2 px-3 border border-zinc-200 text-zinc-500 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Skip Guide
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStepIdx(0)}
                  className="flex-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15"
                >
                  <span>Start Walkthrough</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* Walkthrough Steps */
            <motion.div
              key={currentStepIdx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={
                coords && currentStep
                  ? {
                      position: 'absolute',
                      top: 
                        currentStep.position === 'bottom'
                          ? coords.top + coords.height + 16
                          : currentStep.position === 'top'
                          ? coords.top - 240
                          : currentStep.position === 'center'
                          ? undefined
                          : Math.max(20, coords.top + coords.height / 2 - 110),
                      left: 
                        currentStep.position === 'right'
                          ? coords.left + coords.width + 16
                          : currentStep.position === 'left'
                          ? coords.left - 356
                          : currentStep.position === 'center'
                          ? undefined
                          : coords.left + coords.width / 2 - 170,
                    }
                  : undefined
              }
              className={`bg-white rounded-2xl border border-indigo-100 p-5 shadow-2xl pointer-events-auto z-30 transition-all duration-300 ${
                !coords ? 'w-full max-w-sm' : 'w-[340px]'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                    {currentStep?.icon}
                  </div>
                  <h4 className="font-display font-bold text-zinc-900 text-[13px] tracking-tight">
                    {currentStep?.title}
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded-full">
                  {currentStepIdx + 1} of {steps.length}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-zinc-600 leading-relaxed mb-4">
                {currentStep?.description}
              </p>

              {/* Action buttons */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleBack}
                  className="py-1.5 px-2.5 text-[10px] text-zinc-500 hover:text-zinc-800 font-semibold flex items-center gap-1 cursor-pointer hover:bg-zinc-50 rounded-lg transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="py-1.5 px-2.5 text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer rounded-lg transition-all"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="py-1.5 px-3 bg-zinc-950 hover:bg-zinc-900 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>{currentStepIdx === steps.length - 1 ? 'Finish' : 'Next'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
