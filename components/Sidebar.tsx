
import React, { useState } from 'react';
import { Problem, Difficulty } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
  onSubmit: (input: string) => void;
  activeProblem: Problem | null;
  onGenerateTakeaway: () => void;
  onShowTakeaways: () => void;
  onOpenCodeEditor: () => void;
  darkMode?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  toggle, 
  onSubmit, 
  activeProblem, 
  onGenerateTakeaway,
  onShowTakeaways,
  onOpenCodeEditor,
  darkMode
}) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <aside className="w-80 flex flex-col bg-white dark:bg-gray-900 border-r dark:border-gray-800 h-full overflow-hidden transition-all duration-300">
      <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-bold text-gray-800 dark:text-gray-100">Problem Hub</h2>
        <button onClick={toggle} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <i className="fa-solid fa-angles-left"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Initialize Session</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste problem link, title, or details..."
              className="w-full h-32 p-3 text-sm border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
            />
            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all active:scale-[0.98]"
            >
              Analyze Problem
            </button>
          </form>
        </section>

        {activeProblem ? (
          <section className="animate-in fade-in slide-in-from-top-4 space-y-4">
             <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Active Session</p>
                <h4 className="font-bold text-gray-800 dark:text-gray-100 leading-tight truncate">{activeProblem.title}</h4>
             </div>

              <button 
                onClick={onOpenCodeEditor}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all"
              >
                <i className="fa-solid fa-code text-blue-400 dark:text-blue-200"></i>
                Editor Workspace
              </button>
          </section>
        ) : (
          <div className="text-center py-12">
            <i className="fa-solid fa-laptop-code text-gray-200 dark:text-gray-800 text-5xl mb-4"></i>
            <p className="text-xs text-gray-400 dark:text-gray-600">Start by importing a challenge above.</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 space-y-3">
        <button 
          onClick={onGenerateTakeaway}
          disabled={!activeProblem}
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-gray-700 font-bold py-2.5 rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-lightbulb"></i>
          Capture Insight
        </button>
        <button 
          onClick={onShowTakeaways}
          className="w-full flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold py-2 rounded-xl text-[11px] transition-all"
        >
          <i className="fa-solid fa-database"></i>
          Knowledge Base
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
