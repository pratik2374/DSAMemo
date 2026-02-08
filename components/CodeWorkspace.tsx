
import React, { useState } from 'react';
import { Problem } from '../types';

interface CodeWorkspaceProps {
  code: string;
  setCode: (code: string) => void;
  problem: Problem | null;
  showOnlyDescription?: boolean;
  showOnlyCode?: boolean;
  darkMode?: boolean;
}

const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ 
  code, 
  setCode, 
  problem, 
  showOnlyDescription = false,
  showOnlyCode = false,
  darkMode
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'code'>(showOnlyCode ? 'code' : 'statement');
  const [language, setLanguage] = useState('cpp');

  const showCode = showOnlyCode || (!showOnlyDescription && activeTab === 'code');
  const showDescription = showOnlyDescription || (!showOnlyCode && activeTab === 'statement');

  return (
    <div className="flex flex-col h-full overflow-hidden transition-colors duration-300">
      {!showOnlyDescription && !showOnlyCode && (
        <div className={`flex px-4 h-12 shrink-0 border-b transition-colors ${darkMode ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
          <button 
            onClick={() => setActiveTab('code')}
            className={`px-4 h-full flex items-center gap-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'code' 
              ? (darkMode ? 'text-white border-blue-500 bg-gray-800/50' : 'text-indigo-600 border-indigo-500 bg-white') 
              : 'border-transparent hover:text-gray-200 dark:hover:text-gray-200'}`}
          >
            <i className="fa-solid fa-code text-blue-400"></i>
            Solution
          </button>
          <button 
            onClick={() => setActiveTab('statement')}
            className={`px-4 h-full flex items-center gap-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'statement' 
              ? (darkMode ? 'text-white border-blue-500 bg-gray-800/50' : 'text-indigo-600 border-indigo-500 bg-white') 
              : 'border-transparent hover:text-gray-200 dark:hover:text-gray-200'}`}
          >
            <i className="fa-solid fa-file-lines text-orange-400"></i>
            Problem Description
          </button>
        </div>
      )}

      {showOnlyCode && (
        <div className={`flex items-center gap-4 px-6 py-2 border-b transition-colors ${darkMode ? 'bg-gray-900 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
           <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`text-[10px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 border-none transition-colors ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 shadow-sm border border-gray-200'}`}
            >
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>
            <span className={`text-[10px] font-mono transition-colors ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>language: {language}</span>
        </div>
      )}

      <div className={`flex-1 relative overflow-hidden transition-colors duration-300 ${showCode 
        ? (darkMode ? 'bg-gray-900' : 'bg-white') 
        : 'bg-white dark:bg-gray-900'}`}>
        {showCode ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 relative">
              <div className={`absolute left-0 top-0 bottom-0 w-12 border-r flex flex-col items-center py-4 gap-1 pointer-events-none select-none transition-colors
                ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                {Array.from({ length: 100 }).map((_, i) => (
                  <span key={i} className={`text-[10px] font-mono leading-none h-4 flex items-center transition-colors ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                    {i + 1}
                  </span>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste or write your current logic here..."
                className={`w-full h-full pl-16 pr-6 py-4 bg-transparent font-mono text-sm outline-none resize-none leading-relaxed spellcheck-false transition-colors
                  ${darkMode ? 'text-blue-300' : 'text-gray-800'}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-8 text-gray-800 dark:text-gray-200">
            {problem ? (
              <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
                <header>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">{problem.title}</h2>
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-globe text-indigo-500"></i> {problem.platform}</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-signal text-green-500"></i> {problem.difficulty}</span>
                  </div>
                </header>

                <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                  <p className="whitespace-pre-wrap">{problem.statement}</p>
                </div>

                <div className="space-y-6">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border dark:border-gray-700 shadow-sm transition-colors">
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase mb-4 tracking-widest">Example {i + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-tighter">Input</p>
                          <code className="block bg-white dark:bg-gray-900 border dark:border-gray-700 p-4 rounded-xl text-xs font-mono dark:text-gray-100 shadow-inner">{ex.input}</code>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-green-500 dark:text-green-400 uppercase tracking-tighter">Output</p>
                          <code className="block bg-white dark:bg-gray-900 border dark:border-gray-700 p-4 rounded-xl text-xs font-mono dark:text-gray-100 shadow-inner">{ex.output}</code>
                        </div>
                      </div>
                      {ex.explanation && (
                        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic font-medium">Note: {ex.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border-l-4 border-indigo-500 transition-colors">
                  <h4 className="text-[10px] font-black text-indigo-500 uppercase mb-3 tracking-widest">Constraints</h4>
                  <ul className="text-xs font-mono space-y-2 text-gray-600 dark:text-gray-400">
                    {problem.constraints.map((c, i) => (
                      <li key={i} className="flex gap-2"><span>•</span> <span>{c}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 text-center">
                <i className="fa-solid fa-file-invoice text-5xl mb-4"></i>
                <p className="text-sm font-medium">Session description will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeWorkspace;
