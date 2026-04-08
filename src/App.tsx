/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  Unlock,
  Image as ImageIcon,
  Database,
  ArrowLeft,
  Trash2,
  Menu
} from 'lucide-react';

// Types
type CMOSScore = 'Fail' | 'Acceptable' | 'Perfect';
type BiasScore = -2 | -1 | 0 | 1 | 2;

interface FrameData {
  baseline: {
    matchAccuracy: CMOSScore | null;
    chromaticBias: BiasScore;
  };
  corrected: {
    matchAccuracy: CMOSScore | null;
    residualBias: BiasScore;
    perceptualArtifacts: boolean | null;
  };
}

interface SurveyState {
  observerId: string;
  age: string;
  startTime?: string;
  frames: FrameData[];
}

interface AggregatedResult {
  observerId: string;
  age: string;
  startTime?: string;
  frameResults: FrameData[];
  status: 'Complete' | 'Skipped' | 'In Progress';
}

const INITIAL_FRAME_DATA: FrameData = {
  baseline: {
    matchAccuracy: null,
    chromaticBias: 0,
  },
  corrected: {
    matchAccuracy: null,
    residualBias: 0,
    perceptualArtifacts: null,
  },
};

const TOTAL_FRAMES = 5;

const getNextObserverId = (resetAll = false) => {
  if (resetAll) {
    localStorage.setItem('observer_counter', '1');
    return 'OBS-001';
  }
  const counter = parseInt(localStorage.getItem('observer_counter') || '1');
  const id = `OBS-${String(counter).padStart(3, '0')}`;
  localStorage.setItem('observer_counter', String(counter + 1));
  return id;
};

export default function App() {
  const [currentPhase, setCurrentPhase] = useState<'intro' | 'baseline' | 'corrected' | 'results' | 'thankyou'>(() => {
    return (localStorage.getItem('current_phase') as any) || 'intro';
  });
  const [currentFrameIndex, setCurrentFrameIndex] = useState(() => {
    return parseInt(localStorage.getItem('current_frame_index') || '0');
  });
  const [surveyData, setSurveyData] = useState<SurveyState>(() => {
    const saved = localStorage.getItem('current_survey_data');
    if (saved) return JSON.parse(saved);

    const counter = localStorage.getItem('observer_counter');
    if (!counter) localStorage.setItem('observer_counter', '1');
    
    return {
      observerId: `OBS-${String(counter || '1').padStart(3, '0')}`,
      age: '',
      startTime: undefined,
      frames: Array(TOTAL_FRAMES).fill(null).map(() => ({ ...JSON.parse(JSON.stringify(INITIAL_FRAME_DATA)) })),
    };
  });

  // Sync current progress to localStorage
  useEffect(() => {
    localStorage.setItem('current_survey_data', JSON.stringify(surveyData));
    localStorage.setItem('current_phase', currentPhase);
    localStorage.setItem('current_frame_index', String(currentFrameIndex));
  }, [surveyData, currentPhase, currentFrameIndex]);
  const [showResetModal, setShowResetModal] = useState<{show: boolean, full: boolean}>({show: false, full: false});
  const [showPasswordModal, setShowPasswordModal] = useState<{show: boolean, target: 'export' | 'results' | 'full_reset' | 'next_observer'}>({show: false, target: 'results'});
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const history: AggregatedResult[] = useMemo(() => {
    const historyJson = localStorage.getItem('survey_history') || '[]';
    return JSON.parse(historyJson);
  }, [surveyData.observerId, currentPhase]); // Refresh when observer changes or we enter results

  const saveCurrentToHistory = (forcedStatus?: 'Complete' | 'Skipped') => {
    const historyJson = localStorage.getItem('survey_history') || '[]';
    const history: AggregatedResult[] = JSON.parse(historyJson);
    
    // Check if this observer already exists in history
    const existingIndex = history.findIndex(h => h.observerId === surveyData.observerId);
    
    const totalSteps = (TOTAL_FRAMES * 2) + 2;
    const currentStep = currentPhase === 'intro' 
      ? 1 
      : currentPhase === 'thankyou' ? totalSteps
      : (currentPhase === 'baseline' ? 2 : 7) + currentFrameIndex;

    const isCurrentStepComplete = 
      currentPhase === 'intro' ? (surveyData.age !== '') :
      currentPhase === 'thankyou' ? true :
      currentPhase === 'baseline' ? (currentFrame.baseline.matchAccuracy !== null) :
      (currentFrame.corrected.matchAccuracy !== null && (currentFrame.corrected.matchAccuracy === 'Perfect' || currentFrame.corrected.perceptualArtifacts !== null));

    const isTechnicallyDone = currentStep >= totalSteps - 1 && isCurrentStepComplete;

    const newEntry: AggregatedResult = {
      observerId: surveyData.observerId,
      age: surveyData.age,
      startTime: surveyData.startTime,
      frameResults: surveyData.frames,
      status: forcedStatus || (isTechnicallyDone ? 'Complete' : 'Skipped')
    };

    if (existingIndex >= 0) {
      history[existingIndex] = newEntry;
    } else {
      history.push(newEntry);
    }
    
    localStorage.setItem('survey_history', JSON.stringify(history));
    localStorage.removeItem('current_survey_data');
    localStorage.removeItem('current_phase');
    localStorage.removeItem('current_frame_index');
  };

  const currentFrame = surveyData.frames[currentFrameIndex];

  const updateFrame = (updates: Partial<FrameData>) => {
    setSurveyData(prev => {
      const newFrames = [...prev.frames];
      newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], ...updates };
      return { ...prev, frames: newFrames };
    });
  };

  const updateSection = (section: 'baseline' | 'corrected', updates: any) => {
    const sectionData = { ...currentFrame[section], ...updates };
    
    // If corrected match is perfect, reset perceptual artifacts
    if (section === 'corrected' && updates.matchAccuracy === 'Perfect') {
      sectionData.perceptualArtifacts = null;
    }
    
    updateFrame({
      [section]: sectionData
    });
  };

  const handleReset = (fullReset = false) => {
    if (fullReset) {
      localStorage.removeItem('survey_history');
      localStorage.removeItem('current_survey_data');
      localStorage.removeItem('current_phase');
      localStorage.removeItem('current_frame_index');
      localStorage.setItem('observer_counter', '1');
      setSurveyData({
        observerId: 'OBS-001',
        age: '',
        startTime: undefined,
        frames: Array(TOTAL_FRAMES).fill(null).map(() => ({ ...JSON.parse(JSON.stringify(INITIAL_FRAME_DATA)) })),
      });
    } else {
      // Save current before moving to next
      saveCurrentToHistory();
      
      const currentCounter = parseInt(localStorage.getItem('observer_counter') || '1');
      localStorage.setItem('observer_counter', String(currentCounter + 1));
      const newId = `OBS-${String(currentCounter + 1).padStart(3, '0')}`;
      
      setSurveyData({
        observerId: newId,
        age: '',
        startTime: undefined,
        frames: Array(TOTAL_FRAMES).fill(null).map(() => ({ ...JSON.parse(JSON.stringify(INITIAL_FRAME_DATA)) })),
      });
    }
    setCurrentFrameIndex(0);
    setCurrentPhase('intro');
    setShowResetModal({show: false, full: false});
  };

  const exportToCSV = () => {
    const historyJson = localStorage.getItem('survey_history') || '[]';
    const historyData: AggregatedResult[] = JSON.parse(historyJson);
    
    // Add current session if it's not already in history and has data
    const currentInHistory = historyData.some(h => h.observerId === surveyData.observerId);
    const allData = [...historyData];
    if (!currentInHistory && surveyData.age) {
      const isComplete = surveyData.frames.every(f => 
        f.baseline.matchAccuracy !== null && 
        f.corrected.matchAccuracy !== null && 
        f.corrected.perceptualArtifacts !== null
      ) && surveyData.age !== '';

      allData.push({
        observerId: surveyData.observerId,
        age: surveyData.age,
        startTime: surveyData.startTime,
        frameResults: surveyData.frames,
        status: isComplete ? 'Complete' : 'Skipped'
      });
    }

    if (allData.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Observer ID',
      'Start Time',
      'Status',
      'Age',
      'Frame',
      'Baseline Match Accuracy',
      'Baseline Chromatic Bias',
      'Corrected Match Accuracy',
      'Residual Chromatic Bias',
      'Perceptual Artifacts'
    ];

    const rows: any[] = [];
    allData.forEach(session => {
      session.frameResults.forEach((frame, index) => {
        rows.push([
          session.observerId,
          session.startTime ? `"${new Date(session.startTime).toLocaleString()}"` : 'N/A',
          session.status || 'In Progress',
          session.age,
          index + 1,
          frame.baseline.matchAccuracy ?? 'N/A',
          frame.baseline.chromaticBias,
          frame.corrected.matchAccuracy ?? 'N/A',
          frame.corrected.residualBias,
          frame.corrected.perceptualArtifacts === null ? 'N/A' : (frame.corrected.perceptualArtifacts ? 'Yes' : 'No')
        ]);
      });
    });

    const csvContent = [
      '# Christie MOC Validation Survey - Aggregated Results',
      `# Export Date: ${new Date().toLocaleString()}`,
      '# Legend:',
      '# Match Accuracy: 1 (Fail) to 7 (Perfect)',
      '# Chromatic Bias: -3 (Strong Magenta) | 0 (Neutral) | +3 (Strong Green)',
      '# Perceptual Artifacts: Yes/No (Loss of luminance or saturation volume)',
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `moc_survey_aggregated_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCurrentStepComplete = useMemo(() => {
    if (currentPhase === 'intro') {
      return surveyData.gender !== '' && surveyData.age !== '';
    }
    if (currentPhase === 'thankyou') {
      return true;
    }
    if (currentPhase === 'baseline') {
      return currentFrame.baseline.matchAccuracy !== null;
    } else {
      return (
        currentFrame.corrected.matchAccuracy !== null &&
        (currentFrame.corrected.matchAccuracy === 'Perfect' || currentFrame.corrected.perceptualArtifacts !== null)
      );
    }
  }, [currentFrame, currentPhase, surveyData.gender, surveyData.age]);

  const totalSteps = (TOTAL_FRAMES * 2) + 2;
  const currentStep = currentPhase === 'intro' 
    ? 1 
    : currentPhase === 'thankyou' ? totalSteps
    : (currentPhase === 'baseline' ? 2 : 7) + currentFrameIndex;

  const handleNext = () => {
    if (currentPhase === 'intro') {
      setSurveyData(prev => ({
        ...prev,
        startTime: prev.startTime || new Date().toISOString()
      }));
      setCurrentPhase('baseline');
    } else if (currentPhase === 'baseline') {
      if (currentFrameIndex < TOTAL_FRAMES - 1) {
        setCurrentFrameIndex(prev => prev + 1);
      } else {
        setCurrentPhase('corrected');
        setCurrentFrameIndex(0);
      }
    } else if (currentPhase === 'corrected') {
      if (currentFrameIndex < TOTAL_FRAMES - 1) {
        setCurrentFrameIndex(prev => prev + 1);
      } else {
        setCurrentPhase('thankyou');
      }
    }
  };

  const handlePrevious = () => {
    if (currentPhase === 'baseline' && currentFrameIndex === 0) {
      setCurrentPhase('intro');
    } else if (currentPhase === 'corrected' && currentFrameIndex === 0) {
      setCurrentPhase('baseline');
      setCurrentFrameIndex(TOTAL_FRAMES - 1);
    } else if (currentFrameIndex > 0) {
      setCurrentFrameIndex(prev => prev - 1);
    }
  };

  const handlePasswordSuccess = () => {
    if (password === 'christie') {
      setIsUnlocked(true);
      if (showPasswordModal.target === 'results') {
        setCurrentPhase('results');
      } else if (showPasswordModal.target === 'full_reset') {
        setShowResetModal({show: true, full: true});
      } else if (showPasswordModal.target === 'next_observer') {
        handleReset(false);
      }
      setShowPasswordModal({show: false, target: 'results'});
      setPassword('');
    } else {
      alert('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen bg-[#222222] text-gray-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#1a1a1a] p-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center gap-6">
          {/* Admin Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white flex items-center gap-2"
            >
              <Menu size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Admin</span>
            </button>
            
            {showAdminMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#2a2a2a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <button 
                  onClick={() => {
                    setShowAdminMenu(false);
                    if (isUnlocked) setCurrentPhase('results');
                    else setShowPasswordModal({show: true, target: 'results'});
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <Database size={16} /> Results
                </button>
                <button 
                  onClick={() => {
                    setShowAdminMenu(false);
                    setShowResetModal({show: true, full: false});
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                >
                  <RotateCcw size={16} /> New Observer
                </button>
                <button 
                  onClick={() => {
                    setShowAdminMenu(false);
                    setShowPasswordModal({show: true, target: 'full_reset'});
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2 border-t border-gray-700"
                >
                  <AlertCircle size={16} /> Full Reset
                </button>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Christie MOC Validation</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">Observer: {surveyData.observerId}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 pb-32">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-mono text-gray-500 mb-2 uppercase tracking-wider">
            <span>
              {currentPhase === 'intro' ? 'Observer Profile' : (currentPhase === 'baseline' ? 'Part 1: MOC OFF' : 'Part 2: MOC ON')} 
              {currentPhase !== 'intro' && ` — Frame ${currentFrameIndex + 1}`}
            </span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPhase}-${currentFrameIndex}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-10"
          >
            {currentPhase === 'results' ? (
              /* Results Section */
              <section className="bg-[#2a2a2a] rounded-2xl p-8 shadow-xl border border-gray-800">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Aggregated Results</h2>
                    <p className="text-gray-400 text-sm">Review all collected observer data</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCurrentPhase('intro')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      <ArrowLeft size={18} />
                      <span>Back to Survey</span>
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors text-sm font-medium"
                    >
                      <Download size={18} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1a1a1a] text-gray-400 uppercase text-[10px] tracking-widest font-mono">
                      <tr>
                        <th className="px-6 py-4">Observer</th>
                        <th className="px-6 py-4">Age</th>
                        <th className="px-6 py-4">Frames</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {/* Show current session if in progress */}
                      {currentPhase !== 'results' && (() => {
                        const isCurrentStepComplete = 
                          currentPhase === 'intro' ? (surveyData.age !== '') :
                          currentPhase === 'baseline' ? (currentFrame.baseline.matchAccuracy !== null) :
                          (currentFrame.corrected.matchAccuracy !== null && currentFrame.corrected.perceptualArtifacts !== null);
                        
                        const totalSteps = (TOTAL_FRAMES * 2) + 1;
                        const currentStep = currentPhase === 'intro' 
                          ? 1 
                          : (currentPhase === 'baseline' ? 2 : 7) + currentFrameIndex;
                        
                        const isDone = currentStep >= totalSteps && isCurrentStepComplete;

                        return (
                          <tr className="bg-blue-600/5 border-l-4 border-blue-500">
                            <td className="px-6 py-4 font-mono text-blue-400">{surveyData.observerId}</td>
                            <td className="px-6 py-4 text-gray-300">{surveyData.age || '—'}</td>
                            <td className="px-6 py-4 text-gray-300">
                              {surveyData.frames.filter(f => f.baseline.matchAccuracy !== null).length} / {TOTAL_FRAMES}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${isDone ? 'bg-green-600/20 text-green-500' : 'bg-blue-600/20 text-blue-500'}`}>
                                {isDone ? 'Complete' : 'In Progress'}
                              </span>
                            </td>
                          </tr>
                        );
                      })()}

                      {history.length === 0 && currentPhase === 'results' ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-600 italic">
                            No results found. Perform a survey or start a new tally.
                          </td>
                        </tr>
                      ) : (
                        history.map((res) => {
                          const statusColor = 
                            res.status === 'Complete' ? 'bg-green-600/20 text-green-500' :
                            res.status === 'Skipped' ? 'bg-red-600/20 text-red-500' :
                            'bg-yellow-600/20 text-yellow-500';

                          return (
                            <tr key={res.observerId} className="hover:bg-gray-800/30 transition-colors">
                              <td className="px-6 py-4 font-mono text-blue-400">{res.observerId}</td>
                              <td className="px-6 py-4 text-gray-300">{res.age}</td>
                              <td className="px-6 py-4 text-gray-300">{res.frameResults.length}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${statusColor}`}>
                                  {res.status || 'In Progress'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : currentPhase === 'thankyou' ? (
              /* Thank You Section */
              <section className="bg-[#2a2a2a] rounded-2xl p-12 shadow-xl border border-gray-800 max-w-xl mx-auto text-center">
                <div className="w-20 h-20 bg-green-600/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Thank You!</h2>
                <p className="text-gray-400 mb-8">
                  The survey for observer <span className="font-mono text-blue-400">{surveyData.observerId}</span> has been successfully completed and saved.
                </p>
                <button
                  onClick={() => setShowPasswordModal({show: true, target: 'next_observer'})}
                  className="px-8 py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 mx-auto"
                >
                  <RotateCcw size={20} />
                  <span>Next Observer</span>
                </button>
              </section>
            ) : currentPhase === 'intro' ? (
              /* Intro Section */
              <section className="bg-[#2a2a2a] rounded-2xl p-8 shadow-xl border border-gray-800 max-w-xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Observer Profile</h2>
                  <p className="text-gray-400 text-sm">Please provide demographic information before starting the survey.</p>
                </div>

                <div className="space-y-8">
                  {/* Age Selection */}
                  <div className="space-y-4">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest text-center">Age Range</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['< 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((a) => (
                        <button
                          key={a}
                          onClick={() => setSurveyData(prev => ({ ...prev, age: a }))}
                          className={`py-4 rounded-xl border-2 transition-all text-sm font-bold ${
                            surveyData.age === a
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-gray-800/50 border-transparent text-gray-500 hover:border-gray-700'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <>
                {/* Frame Image */}
                <div className="max-w-md mx-auto w-full aspect-video bg-[#1a1a1a] rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden relative group shadow-lg">
                  <img 
                    src={`/frames/${currentFrameIndex + 1}.jpg`} 
                    alt={`Frame ${currentFrameIndex + 1}`} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image is not uploaded yet
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex-col items-center justify-center text-gray-700/50 group-hover:text-gray-500 transition-colors hidden">
                    <ImageIcon size={40} strokeWidth={1} />
                    <span className="mt-2 text-[10px] font-mono uppercase tracking-widest">Frame {currentFrameIndex + 1} Reference</span>
                    <span className="mt-1 text-[9px] text-gray-600">Upload to public/frames/{currentFrameIndex + 1}.jpg</span>
                  </div>
                </div>

                {currentPhase === 'baseline' ? (
              /* Section A: Baseline */
              <section className="bg-[#2a2a2a] rounded-2xl p-5 shadow-xl border border-gray-800">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">A</div>
                  <h2 className="text-base font-semibold text-white">Phase 1 — Frame {currentFrameIndex + 1}</h2>
                </div>

                <div className="space-y-6">
                  {/* Match Accuracy */}
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rate the side-by-side color match:
                    </label>
                    <div className="flex justify-between items-center gap-3">
                      {(['Fail', 'Acceptable', 'Perfect'] as CMOSScore[]).map((score) => (
                        <button
                          key={score}
                          onClick={() => {
                            const updates: any = { matchAccuracy: score };
                            if (score === 'Perfect') updates.chromaticBias = 0;
                            updateSection('baseline', updates);
                          }}
                          className={`flex-1 py-4 rounded-lg border-2 transition-all flex flex-col items-center gap-0.5 ${
                            currentFrame.baseline.matchAccuracy === score
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-gray-800/50 border-transparent text-gray-500 hover:border-gray-700'
                          }`}
                        >
                          <span className="text-sm font-bold uppercase tracking-wider">{score}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chromatic Bias */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Do you notice a color tint? (Green or Magenta)
                      </label>
                      <span className={`text-base font-mono font-bold ${
                        currentFrame.baseline.chromaticBias < 0 ? 'text-magenta-400' : 
                        currentFrame.baseline.chromaticBias > 0 ? 'text-green-400' : 'text-white'
                      }`}>
                        {currentFrame.baseline.chromaticBias === -2 ? 'A lot (Magenta)' : 
                         currentFrame.baseline.chromaticBias === -1 ? 'A little (Magenta)' : 
                         currentFrame.baseline.chromaticBias === 1 ? 'A little (Green)' : 
                         currentFrame.baseline.chromaticBias === 2 ? 'A lot (Green)' : 'Neutral'}
                      </span>
                    </div>
                    <div className={`px-5 py-6 bg-gray-800/40 rounded-xl border border-gray-700/30 transition-opacity ${currentFrame.baseline.matchAccuracy === 'Perfect' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="relative px-[10px]">
                        <input 
                          type="range" 
                          min="-2" 
                          max="2" 
                          step="1"
                          disabled={currentFrame.baseline.matchAccuracy === 'Perfect'}
                          value={currentFrame.baseline.chromaticBias}
                          onChange={(e) => updateSection('baseline', { chromaticBias: parseInt(e.target.value) })}
                          className="bias-slider"
                        />
                      </div>
                      <div className="flex justify-between px-[10px] mt-5 text-xs font-mono uppercase tracking-widest text-gray-500">
                        {[-2, -1, 0, 1, 2].map((val) => (
                          <div 
                            key={val} 
                            className={`flex flex-col items-center w-0 transition-all ${
                              currentFrame.baseline.chromaticBias === val 
                                ? (val < 0 ? 'text-magenta-400 font-bold scale-110' : val > 0 ? 'text-green-400 font-bold scale-110' : 'text-white font-bold scale-110') 
                                : ''
                            }`}
                          >
                            <span className="whitespace-nowrap">{val === -2 || val === 2 ? 'A lot' : val === -1 || val === 1 ? 'A little' : 'Neutral'}</span>
                            <div className="h-4 flex items-center">
                              {val === -2 && <span className="text-[8px] opacity-60">MAGENTA</span>}
                              {val === 2 && <span className="text-[8px] opacity-60">GREEN</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              /* Section B: Corrected */
              <section className="bg-[#2a2a2a] rounded-2xl p-5 shadow-xl border border-gray-800">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">B</div>
                  <h2 className="text-base font-semibold text-white">Phase 2 — Frame {currentFrameIndex + 1}</h2>
                </div>

                <div className="space-y-6">
                  {/* Match Accuracy */}
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rate the side-by-side color match:
                    </label>
                    <div className="flex justify-between items-center gap-3">
                      {(['Fail', 'Acceptable', 'Perfect'] as CMOSScore[]).map((score) => (
                        <button
                          key={score}
                          onClick={() => {
                            const updates: any = { matchAccuracy: score };
                            if (score === 'Perfect') updates.residualBias = 0;
                            updateSection('corrected', updates);
                          }}
                          className={`flex-1 py-4 rounded-lg border-2 transition-all flex flex-col items-center gap-0.5 ${
                            currentFrame.corrected.matchAccuracy === score
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-gray-800/50 border-transparent text-gray-500 hover:border-gray-700'
                          }`}
                        >
                          <span className="text-sm font-bold uppercase tracking-wider">{score}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Residual Chromatic Bias */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Do you notice a color tint? (Green or Magenta)
                      </label>
                      <span className={`text-base font-mono font-bold ${
                        currentFrame.corrected.residualBias < 0 ? 'text-magenta-400' : 
                        currentFrame.corrected.residualBias > 0 ? 'text-green-400' : 'text-white'
                      }`}>
                        {currentFrame.corrected.residualBias === -2 ? 'A lot (Magenta)' : 
                         currentFrame.corrected.residualBias === -1 ? 'A little (Magenta)' : 
                         currentFrame.corrected.residualBias === 1 ? 'A little (Green)' : 
                         currentFrame.corrected.residualBias === 2 ? 'A lot (Green)' : 'Neutral'}
                      </span>
                    </div>
                    <div className={`px-5 py-6 bg-gray-800/40 rounded-xl border border-gray-700/30 transition-opacity ${currentFrame.corrected.matchAccuracy === 'Perfect' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="relative px-[10px]">
                        <input 
                          type="range" 
                          min="-2" 
                          max="2" 
                          step="1"
                          disabled={currentFrame.corrected.matchAccuracy === 'Perfect'}
                          value={currentFrame.corrected.residualBias}
                          onChange={(e) => updateSection('corrected', { residualBias: parseInt(e.target.value) })}
                          className="bias-slider"
                        />
                      </div>
                      <div className="flex justify-between px-[10px] mt-5 text-xs font-mono uppercase tracking-widest text-gray-500">
                        {[-2, -1, 0, 1, 2].map((val) => (
                          <div 
                            key={val} 
                            className={`flex flex-col items-center w-0 transition-all ${
                              currentFrame.corrected.residualBias === val 
                                ? (val < 0 ? 'text-magenta-400 font-bold scale-110' : val > 0 ? 'text-green-400 font-bold scale-110' : 'text-white font-bold scale-110') 
                                : ''
                            }`}
                          >
                            <span className="whitespace-nowrap">{val === -2 || val === 2 ? 'A lot' : val === -1 || val === 1 ? 'A little' : 'Neutral'}</span>
                            <div className="h-4 flex items-center">
                              {val === -2 && <span className="text-[8px] opacity-60">MAGENTA</span>}
                              {val === 2 && <span className="text-[8px] opacity-60">GREEN</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Perceptual Artifacts */}
                  <div className={`space-y-3 transition-opacity ${currentFrame.corrected.matchAccuracy === 'Perfect' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Any loss of luminance or saturation?
                    </label>
                    <div className="flex gap-3">
                      {[true, false].map((val) => (
                        <button
                          key={val ? 'yes' : 'no'}
                          disabled={currentFrame.corrected.matchAccuracy === 'Perfect'}
                          onClick={() => updateSection('corrected', { perceptualArtifacts: val })}
                          className={`flex-1 py-3 rounded-lg border-2 transition-all font-bold text-sm ${
                            currentFrame.corrected.perceptualArtifacts === val
                              ? 'bg-blue-600/20 border-blue-500 text-white'
                              : 'bg-gray-800/50 border-transparent text-gray-500 hover:border-gray-700'
                          }`}
                        >
                          {val ? 'YES' : 'NO'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Controls */}
      {currentPhase !== 'thankyou' && currentPhase !== 'results' && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-[#1a1a1a]/90 backdrop-blur-md border-t border-gray-800 z-10">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <button
              disabled={currentPhase === 'intro'}
              onClick={handlePrevious}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft size={20} />
              <span>Previous</span>
            </button>

            <div className="flex gap-4 items-center">
              <button
                disabled={!isCurrentStepComplete}
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
              >
                <span>
                  {currentPhase === 'intro' ? 'Start Survey' : 
                   (currentPhase === 'baseline' && currentFrameIndex === TOTAL_FRAMES - 1 ? 'Start Phase 2' : 
                   (currentPhase === 'corrected' && currentFrameIndex === TOTAL_FRAMES - 1 ? 'Submit and Save' : 'Next Frame'))}
                </span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Export Modal / Password Protection */}
      <AnimatePresence>
        {showPasswordModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#2a2a2a] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-800"
            >
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-blue-500">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Admin Access Required</h3>
                    <p className="text-gray-400 text-sm">Enter password to view results</p>
                  </div>
                </div>
                
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordSuccess();
                    }
                  }}
                />

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setShowPasswordModal({show: false, target: 'results'});
                      setPassword('');
                    }}
                    className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handlePasswordSuccess}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showResetModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#2a2a2a] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-800"
            >
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${showResetModal.full ? 'bg-red-600/20 text-red-500' : 'bg-blue-600/20 text-blue-500'}`}>
                    {showResetModal.full ? <AlertCircle size={32} /> : <RotateCcw size={32} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{showResetModal.full ? 'Confirm Full Reset' : 'Confirm New Observer'}</h3>
                    <p className="text-gray-400 text-sm">
                      {showResetModal.full 
                        ? 'This will PERMANENTLY DELETE all collected results and restart numbering at OBS-001. This action cannot be undone.' 
                        : 'This will save current results and prepare the survey for the next observer.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowResetModal({show: false, full: false})}
                    className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleReset(showResetModal.full)}
                    className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors ${showResetModal.full ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                  >
                    {showResetModal.full ? 'Reset Everything' : 'Continue'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Glare Prevention Overlay (Subtle) */}
      <div className="fixed inset-0 pointer-events-none border-[20px] border-black/20 z-50"></div>
    </div>
  );
}
