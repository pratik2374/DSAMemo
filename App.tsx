
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Problem, ChatMessage, Takeaway, UserStats } from './types';
import { geminiService } from './geminiService';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CodeWorkspace from './components/CodeWorkspace';
import TakeawaysModal from './components/TakeawaysModal';

const App: React.FC = () => {
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [takeaways, setTakeaways] = useState<Takeaway[]>([]);
  const [showTakeaways, setShowTakeaways] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  const [workspaceWidth, setWorkspaceWidth] = useState(45); 
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(true); 
  const isResizing = useRef(false);

  const [stats, setStats] = useState<UserStats>({
    problemsStarted: 0,
    hintsUsedCount: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    totalTimeSeconds: 0,
    solvedCount: 0
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    let interval: any;
    if (activeProblem) {
      interval = setInterval(() => {
        setStats(prev => ({ ...prev, totalTimeSeconds: prev.totalTimeSeconds + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeProblem]);

  const showLevelToast = (level: number) => {
    const existing = document.getElementById('level-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'level-toast';
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest shadow-2xl z-[200] animate-in fade-in slide-in-from-top-2 duration-200';
    toast.innerText = `Assistance Level: ${level}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
      setTimeout(() => toast.remove(), 200);
    }, 500);
  };

  const handleHintLevelChange = (val: number) => {
    setHintLevel(val);
    showLevelToast(val);
  };

  const handleProblemSubmit = async (input: string) => {
    setIsLoading(true);
    try {
      const problem = await geminiService.normalizeProblem(input);
      setActiveProblem(problem);
      
      const problemContext = `
# ${problem.title}
**Difficulty:** ${problem.difficulty}

${problem.statement}

### Constraints:
${problem.constraints.map(c => `- ${c}`).join('\n')}
      `.trim();

      setChatMessages([{
        id: 'initial',
        role: 'assistant',
        content: problemContext,
        timestamp: Date.now()
      }]);
      setStats(prev => ({ ...prev, problemsStarted: prev.problemsStarted + 1 }));
      setIsWorkspaceCollapsed(false); 
    } catch (error) {
      console.error(error);
      alert("Failed to load problem. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeProblem) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      hintLevel
    };
    
    setChatMessages(prev => [...prev, assistantMsg]);

    try {
      const stream = geminiService.getGuidedHintStream(
        activeProblem,
        hintLevel,
        code,
        chatMessages
      );

      let fullContent = '';
      let lastSources = undefined;

      for await (const chunk of stream) {
        fullContent += chunk.text;
        lastSources = chunk.sources || lastSources;

        setChatMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: fullContent, sources: lastSources } : m
        ));
      }

      setStats(prev => ({
        ...prev,
        hintsUsedCount: {
          ...prev.hintsUsedCount,
          [hintLevel]: (prev.hintsUsedCount[hintLevel] || 0) + 1
        }
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const generateTakeaway = async () => {
    if (!activeProblem || chatMessages.length < 2) return;
    setIsLoading(true);
    try {
      const chatHistory = chatMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      const takeaway = await geminiService.generateTakeaway(activeProblem, chatHistory);
      setTakeaways(prev => [takeaway, ...prev]);
      setShowTakeaways(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTakeaway = (updated: Takeaway) => {
    setTakeaways(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = 100 - (e.clientX / window.innerWidth) * 100;
    if (newWidth > 15 && newWidth < 85) {
      setWorkspaceWidth(newWidth);
    }
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} select-none transition-colors duration-300`}>
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSubmit={handleProblemSubmit}
        activeProblem={activeProblem}
        onGenerateTakeaway={generateTakeaway}
        onShowTakeaways={() => setShowTakeaways(true)}
        onOpenCodeEditor={() => setIsCodeEditorOpen(true)}
        darkMode={darkMode}
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 shrink-0 z-10 transition-colors">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
                <i className="fa-solid fa-bars text-gray-600 dark:text-gray-400"></i>
              </button>
            )}
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              DSA Mentor
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:ring-2 hover:ring-indigo-500 transition-all shadow-sm"
              title={darkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            
            {activeProblem && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                {Math.floor(stats.totalTimeSeconds / 60)}m {stats.totalTimeSeconds % 60}s
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <div 
            style={{ width: (!activeProblem || isWorkspaceCollapsed) ? '100%' : `${100 - workspaceWidth}%` }}
            className="flex flex-col border-r dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300"
          >
            <div className="p-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-wand-sparkles text-indigo-500"></i>
                  Level: {hintLevel}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400 italic">
                    {hintLevel === 1 ? "Ultra Subtle" : hintLevel === 5 ? "Full Solution" : "Guided"}
                  </span>
                  {activeProblem && isWorkspaceCollapsed && (
                     <button 
                      onClick={() => setIsWorkspaceCollapsed(false)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-[10px] font-bold flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded transition-colors"
                    >
                      <i className="fa-solid fa-expand"></i> Show Description
                    </button>
                  )}
                </div>
              </div>
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={hintLevel} 
                onChange={(e) => handleHintLevelChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            
            <ChatArea 
              messages={chatMessages} 
              onSendMessage={handleSendMessage} 
              isTyping={isTyping} 
              onSpeak={geminiService.speak}
              onOpenCode={() => setIsCodeEditorOpen(true)}
              darkMode={darkMode}
            />
          </div>

          {!isWorkspaceCollapsed && activeProblem && (
            <div 
              onMouseDown={startResizing}
              className="w-1.5 hover:w-2 hover:bg-indigo-400/30 cursor-col-resize transition-all shrink-0 z-20 border-x dark:border-gray-800"
            />
          )}

          {activeProblem && !isWorkspaceCollapsed && (
            <div 
              style={{ width: `${workspaceWidth}%` }}
              className="flex flex-col bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300 relative border-l dark:border-gray-800"
            >
              <button 
                onClick={() => setIsWorkspaceCollapsed(true)}
                className="absolute top-4 right-4 z-30 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg shadow-sm border dark:border-gray-700 transition-colors"
                title="Collapse Workspace"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
              <CodeWorkspace 
                code={code} 
                setCode={setCode} 
                problem={activeProblem}
                showOnlyDescription={true}
                darkMode={darkMode}
              />
            </div>
          )}
        </div>

        {isCodeEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-6xl h-[85vh] bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#252526]">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-code text-blue-400"></i>
                  <span className="text-sm font-semibold text-gray-300">Editor Workspace</span>
                </div>
                <button 
                  onClick={() => setIsCodeEditorOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CodeWorkspace 
                  code={code} 
                  setCode={setCode} 
                  problem={activeProblem}
                  showOnlyCode={true}
                  darkMode={darkMode}
                />
              </div>
              <div className="px-6 py-4 bg-[#252526] border-t border-white/10 flex justify-end gap-3">
                 <button 
                  onClick={() => setIsCodeEditorOpen(false)}
                  className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Sync Logic
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {showTakeaways && (
        <TakeawaysModal 
          takeaways={takeaways} 
          onUpdateTakeaway={updateTakeaway}
          onClose={() => setShowTakeaways(false)} 
        />
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-[60] transition-all">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl border dark:border-gray-700 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">DSA Analysis</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Contextualizing problem constraints...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
