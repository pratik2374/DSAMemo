
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onSpeak: (text: string) => void;
  onOpenCode: () => void;
  darkMode?: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, onSendMessage, isTyping, onSpeak, onOpenCode, darkMode }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isTyping) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const renderMarkdown = (content: string) => {
    try {
      // Pre-process common complexity notations that might miss backticks
      let processedContent = content.replace(/(\s|^)\$O\((.*?)\)\$/g, '$1`O($2)`');
      processedContent = processedContent.replace(/(\s|^)O\((.*?)\)/g, '$1`O($2)`');
      
      const rawHtml = marked.parse(processedContent) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return { __html: cleanHtml };
    } catch (e) {
      return { __html: content };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 relative overflow-hidden transition-colors">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 text-center px-12 animate-in fade-in duration-700">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-4 transition-colors">
              <i className="fa-solid fa-brain text-indigo-400 text-2xl animate-pulse"></i>
            </div>
            <p className="text-sm font-medium">Welcome to your DSA Session. Load a problem to begin.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black shadow-sm transition-colors
              ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border dark:border-gray-700'}`}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed transition-colors
                ${msg.role === 'user' 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 rounded-tr-none border border-indigo-100 dark:border-indigo-800' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border dark:border-gray-700 shadow-sm'}`}>
                
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {msg.role === 'assistant' && !msg.content && isTyping ? (
                    <div className="flex gap-1.5 py-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                  )}
                </div>
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Relevant Links</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((s, i) => (
                        <a 
                          key={i} 
                          href={s.web.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-blue-500 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 flex items-center gap-1 transition-colors"
                        >
                          <i className="fa-solid fa-link"></i> {s.web.title.slice(0, 25)}...
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && msg.content && (
                  <button 
                    onClick={() => onSpeak(msg.content)}
                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Read aloud"
                  >
                    <i className="fa-solid fa-volume-high text-[10px]"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && messages[messages.length-1]?.role === 'user' && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black bg-gray-100 dark:bg-gray-800 text-gray-400 border dark:border-gray-700 shadow-sm">
                AI
             </div>
             <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-none border dark:border-gray-700 flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full typing-dot"></span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 pt-0 transition-colors">
        <form 
          onSubmit={handleSubmit}
          className="relative group flex items-center gap-2"
        >
          <button 
            type="button"
            onClick={onOpenCode}
            className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-sm border dark:border-gray-700"
            title="Open Code Editor"
          >
            <i className="fa-solid fa-terminal"></i>
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              placeholder="Ask for a hint or share your code logic..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all disabled:opacity-50 shadow-sm"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <i className="fa-solid fa-arrow-up"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;
