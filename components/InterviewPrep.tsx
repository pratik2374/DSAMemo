import React, { useState, useEffect, useRef } from 'react';
import { Problem, ChatMessage } from '../types';
import { geminiService } from '../geminiService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface InterviewPrepProps {
  problem: Problem;
  code: string;
  onClose: () => void;
  onOpenCode: () => void;
  darkMode?: boolean;
}

interface InterviewFeedback {
  communicationScore: number;
  correctnessScore: number;
  strengths: string[];
  weaknesses: string[];
  feedbackSummary: string;
  tipsForImprovement: string[];
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const InterviewPrep: React.FC<InterviewPrepProps> = ({
  problem,
  code,
  onClose,
  onOpenCode,
  darkMode
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Speech synthesis states
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [autoSpeak] = useState(true);
  const [speechRate] = useState(1.0);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  // Speech recognition states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Interview state controls
  const [isPaused, setIsPaused] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(true);

  // Interview status & feedback
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // A ref to keep track of messages for callback functions
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load browser voices & lock English voice permanently
  useEffect(() => {
    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        const availableVoices = window.speechSynthesis.getVoices();
        
        if (availableVoices.length > 0) {
          // Find English voices only
          const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
          
          // Prioritize: Microsoft Natural voices (Aria, Guy) -> Google US English -> standard English
          const bestVoice = 
            englishVoices.find(v => v.name.includes('Natural') || v.name.includes('Aria') || v.name.includes('Guy')) ||
            englishVoices.find(v => v.name.includes('Google') || v.name.includes('US English')) ||
            englishVoices.find(v => v.lang.startsWith('en-US')) ||
            englishVoices[0] ||
            availableVoices[0];
            
          if (bestVoice) {
            setSelectedVoice(bestVoice);
            setVoicesLoaded(true);
          }
        }
      }
    };

    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback safety to force greeting trigger if voices don't load within 1.5s
    const fallbackTimer = setTimeout(() => {
      setVoicesLoaded(true);
    }, 1500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Initial greeting from the interviewer (triggered only after voices are ready/fallback hits)
  useEffect(() => {
    if (!voicesLoaded) return;

    const triggerGreeting = async () => {
      setIsTyping(true);
      const greetingMsgId = 'greeting-' + Date.now();
      const newGreeting: ChatMessage = {
        id: greetingMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      
      setMessages([newGreeting]);
      
      try {
        const stream = geminiService.getMockInterviewStream(problem, code, 'Hello, I am ready to start the interview.', []);
        let fullContent = '';
        for await (const chunk of stream) {
          fullContent += chunk.text;
          setMessages(prev => prev.map(m => m.id === greetingMsgId ? { ...m, content: fullContent } : m));
        }

        // Speak greeting
        if (autoSpeak) {
          speakText(fullContent, greetingMsgId);
        }
      } catch (err) {
        console.error('Error starting interview:', err);
        setMessages([
          {
            id: greetingMsgId,
            role: 'assistant',
            content: `Hello! I have reviewed your code for **${problem.title}**. To start off, could you explain the main intuition behind your approach?`,
            timestamp: Date.now()
          }
        ]);
      } finally {
        setIsTyping(false);
      }
    };

    triggerGreeting();

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [problem, voicesLoaded]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Text-To-Speech function
  const speakText = (text: string, messageId: string) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();

    if (currentlySpeakingId === messageId) {
      setCurrentlySpeakingId(null);
      return;
    }

    if (isPaused) return;

    // Strip markdown formatting for cleaner speaking
    const cleanText = text
      .replace(/[*#`_\-]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Ensure we use the exact voice selected dynamically if not set already
    const voiceToUse = selectedVoice || (() => {
      const voicesList = window.speechSynthesis.getVoices();
      const englishVoices = voicesList.filter(v => v.lang.startsWith('en'));
      return englishVoices.find(v => v.name.includes('Natural') || v.name.includes('Aria')) || englishVoices[0] || voicesList[0];
    })();
    
    if (voiceToUse) {
      utterance.voice = voiceToUse as SpeechSynthesisVoice;
    }
    
    utterance.rate = speechRate;
    
    utterance.onstart = () => setCurrentlySpeakingId(messageId);
    
    utterance.onend = () => {
      setCurrentlySpeakingId(null);
      // Auto-trigger hands-free speech recognition (STT) when the interviewer finishes speaking
      if (autoSpeak && !isPaused && !interviewEnded) {
        setTimeout(() => {
          startSpeechRecognition();
        }, 400);
      }
    };
    
    utterance.onerror = () => setCurrentlySpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Speech recognition helper
  const startSpeechRecognition = () => {
    if (!SpeechRecognition || isPaused || interviewEnded || isTyping) return;
    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      setInput(prev => prev + finalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  };

  // Speech-To-Text (STT) Manual Toggle
  const toggleListening = () => {
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    startSpeechRecognition();
  };

  // Central submission method
  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      const stream = geminiService.getMockInterviewStream(
        problem,
        code,
        userText,
        newMessages
      );

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk.text;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: fullContent } : m));
      }

      // Speak response if not paused
      if (autoSpeak && !isPaused) {
        speakText(fullContent, assistantMsgId);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Sorry, I encountered an issue processing that.' } : m));
    } finally {
      setIsTyping(false);
    }
  };

  // Pause / Resume flow logic
  const handlePauseToggle = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      
      // Check if there is an unread interviewer response (e.g. sent during pause)
      const curMessages = messagesRef.current;
      const lastMsg = curMessages[curMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content && !currentlySpeakingId) {
        speakText(lastMsg.content, lastMsg.id);
      } else if (!currentlySpeakingId) {
        setTimeout(() => {
          startSpeechRecognition();
        }, 200);
      }
    } else {
      // Pause
      if (input.trim()) {
        // "If pause in bwtween it sends."
        const textToSend = input.trim();
        setInput('');
        
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }
        
        // Submit immediately and put into pause state
        setIsPaused(true);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        setCurrentlySpeakingId(null);
        sendMessage(textToSend);
      } else {
        // Normal pause
        setIsPaused(true);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }
        setCurrentlySpeakingId(null);
      }
    }
  };

  const handleEndInterview = async () => {
    setIsGeneratingFeedback(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (isListening) {
      recognitionRef.current?.stop();
    }
    
    try {
      const result = await geminiService.generateInterviewFeedback(problem, code, messages);
      setFeedback(result);
      setInterviewEnded(true);
    } catch (err) {
      console.error(err);
      alert('Failed to generate interview feedback. Please try again.');
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const renderMarkdown = (content: string) => {
    try {
      const rawHtml = marked.parse(content) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return { __html: cleanHtml };
    } catch (e) {
      return { __html: content };
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300 relative overflow-hidden">
      {/* Styles for Audio Waves */}
      <style>{`
        @keyframes voiceWave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.0); }
        }
        .voice-wave-bar {
          display: inline-block;
          width: 4px;
          border-radius: 99px;
          animation: voiceWave 1s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

      {/* Top Banner Control */}
      <header className="px-6 py-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-4 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-lg text-white">
            <i className="fa-solid fa-microphone"></i>
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">Mock Interview Prep</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-black">Explain Your Code</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Permanent Voice Indicator Badge */}
          {selectedVoice && (
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-3 py-1.5 rounded-xl border dark:border-gray-700 flex items-center gap-1.5 animate-in fade-in duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <i className="fa-solid fa-headset text-indigo-500"></i>
              Voice: {selectedVoice.name.replace('Microsoft', 'MS').replace('Online (Natural)', '')} (en)
            </span>
          )}

          {/* Pause / Play Button */}
          {!interviewEnded && (
            <button
              onClick={handlePauseToggle}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
                isPaused 
                  ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={isPaused ? "Resume Interview" : "Pause Interview"}
            >
              <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-colors"
            title="Exit Interview Prep"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Live Code Reference Viewer */}
      {!interviewEnded && (
        <div className="border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 px-6 py-2 flex flex-col transition-all">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCodePreview(!showCodePreview)}
              className="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest hover:text-indigo-500 transition-colors"
            >
              <i className={`fa-solid ${showCodePreview ? 'fa-chevron-down' : 'fa-chevron-right'} text-indigo-500`}></i>
              <span>Voice Agent Code Viewer</span>
            </button>
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
              {code ? `${code.split('\n').length} lines of code active` : 'No code added yet'}
            </span>
          </div>

          {showCodePreview && (
            <div className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-xs font-mono max-h-24 overflow-y-auto border border-gray-800 shadow-inner animate-in slide-in-from-top-1 duration-200">
              {code ? (
                <pre className="whitespace-pre-wrap">{code}</pre>
              ) : (
                <span className="italic text-gray-500">// Editor code is empty. Add logic to let the interviewer review it.</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Dialogue Space */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {!interviewEnded ? (
          <>
            {/* Scrollable Message Box */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-black shadow-sm transition-colors
                    ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gradient-to-tr from-amber-500 to-red-500 text-white'}`}>
                    {msg.role === 'user' ? 'U' : 'INT'}
                  </div>
                  <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all
                      ${msg.role === 'user'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 rounded-tr-none border border-indigo-100 dark:border-indigo-800'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border dark:border-gray-700 shadow-sm'}`}>
                      
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {msg.role === 'assistant' && !msg.content && isTyping ? (
                          <div className="flex gap-1.5 py-1.5 items-center">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                          </div>
                        ) : (
                          <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.role === 'assistant' && msg.content && (
                        <button
                          onClick={() => speakText(msg.content, msg.id)}
                          className={`transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            currentlySpeakingId === msg.id ? 'text-amber-500' : 'text-gray-400 hover:text-indigo-500'
                          }`}
                          title={currentlySpeakingId === msg.id ? 'Stop audio' : 'Speak message'}
                          disabled={isPaused}
                        >
                          <i className={`fa-solid ${currentlySpeakingId === msg.id ? 'fa-circle-stop' : 'fa-volume-high'} text-[10px]`}></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-black bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-sm">
                    INT
                  </div>
                  <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-none border dark:border-gray-700 flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full typing-dot"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Glassmorphic Pause Overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-20 transition-all animate-in fade-in duration-300">
                <div className="bg-white/80 dark:bg-gray-800/80 border dark:border-gray-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm mx-4">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-955/40 text-amber-500 flex items-center justify-center shadow-inner">
                    <i className="fa-solid fa-pause text-2xl"></i>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-900 dark:text-white text-lg">Interview Paused</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Voice inputs and speaking queues are temporarily suspended. Click below to pick up where you left off or open the code editor.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5 w-full">
                    <button
                      onClick={handlePauseToggle}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-2xl text-xs transition-all active:scale-[0.98] shadow-md shadow-indigo-500/20"
                    >
                      Resume Interview
                    </button>
                    <button
                      type="button"
                      onClick={onOpenCode}
                      className="w-full bg-white dark:bg-gray-700 border dark:border-gray-650 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-2.5 rounded-2xl text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-terminal text-blue-500"></i>
                      Open Code Editor
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input Wave Bar Section */}
            <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 transition-colors shrink-0 flex flex-col gap-4">
              <div className="flex gap-4 items-center w-full">
                {/* Code Editor Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isPaused) {
                      handlePauseToggle();
                    }
                    onOpenCode();
                  }}
                  className="w-12 h-12 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-sm border border-gray-200 dark:border-gray-700"
                  title="Open Code Editor & Pause Interview"
                >
                  <i className="fa-solid fa-terminal text-base"></i>
                </button>

                {/* Pulsating Wave Form Panel (Clicking quiet wave starts mic, clicking active wave sends message) */}
                <div
                  onClick={() => {
                    if (isPaused || isTyping) return;
                    if (isListening) {
                      const textToSend = input.trim();
                      if (textToSend) {
                        setInput('');
                        if (isListening) {
                          recognitionRef.current?.stop();
                          setIsListening(false);
                        }
                        sendMessage(textToSend);
                      }
                    } else {
                      toggleListening();
                    }
                  }}
                  className={`flex-1 h-16 rounded-2xl border flex items-center justify-between px-6 cursor-pointer select-none transition-all ${
                    isListening
                      ? 'bg-gradient-to-r from-red-500/10 to-amber-500/10 border-red-400 dark:border-red-900/50 shadow-inner'
                      : 'bg-white dark:bg-gray-855 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md'
                  } ${isPaused || isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Pulsating Wave Bars */}
                    <div className="flex items-center gap-1.5 h-8">
                      {Array.from({ length: 15 }).map((_, i) => {
                        const heights = [16, 28, 20, 32, 14, 24, 18, 30, 22, 16, 26, 12, 22, 18, 24];
                        const delay = (i * 0.08).toFixed(2);
                        const duration = (0.7 + Math.random() * 0.6).toFixed(2);
                        return (
                          <span
                            key={i}
                            className={`voice-wave-bar w-[3px] rounded-full transition-all ${
                              isListening 
                                ? 'bg-gradient-to-t from-red-500 to-amber-500' 
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            style={{
                              height: isListening ? `${heights[i % heights.length]}px` : '6px',
                              animationName: isListening ? 'voiceWave' : 'none',
                              animationDelay: `${delay}s`,
                              animationDuration: `${duration}s`,
                              animationIterationCount: 'infinite',
                              animationTimingFunction: 'ease-in-out'
                            }}
                          />
                        );
                      })}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {isPaused 
                        ? 'Interview Paused' 
                        : isTyping 
                          ? 'Interviewer is thinking...' 
                          : currentlySpeakingId 
                            ? 'Interviewer is speaking...' 
                            : isListening 
                              ? 'Listening... Click here to Send' 
                              : 'Click here to speak'}
                    </span>
                  </div>

                  {isListening && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-red-500 bg-red-100 dark:bg-red-955/40 px-2.5 py-1 rounded-lg animate-pulse">
                        Live Mic
                      </span>
                    </div>
                  )}
                </div>

                {/* End Interview */}
                <button
                  type="button"
                  onClick={handleEndInterview}
                  disabled={messages.length < 2 || isTyping || isPaused}
                  className="px-6 h-12 bg-gray-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center shrink-0 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-flag-checkered mr-2"></i>
                  End Interview
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Interview Ended Feedback View */
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-300">
            <div className="text-center max-w-xl mx-auto space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-55 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
                Evaluation Completed
              </span>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Your Interview Performance Card</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review your mock technical interview results and feedback below to identify key development areas.
              </p>
            </div>

            {feedback && (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Score indicators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Comm score */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-6 rounded-2xl border dark:border-gray-800 flex items-center gap-6 shadow-sm">
                    <div className="w-20 h-20 rounded-full border-4 border-amber-400 flex flex-col items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-955/20">
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">{feedback.communicationScore}</span>
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter mt-1">/ 100</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">Communication Score</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Measures how clearly, articulately, and structured you explained your concepts and walk-throughs.
                      </p>
                    </div>
                  </div>

                  {/* Correctness score */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 p-6 rounded-2xl border dark:border-gray-800 flex items-center gap-6 shadow-sm">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-500 flex flex-col items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-950/20">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{feedback.correctnessScore}</span>
                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter mt-1">/ 100</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">Technical Logic Score</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Measures complexity analysis accuracy, edge-case evaluation, dry run clarity, and code correctness.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feedback summary */}
                <div className="bg-indigo-50 dark:bg-indigo-950/20 border-l-4 border-indigo-500 p-6 rounded-r-2xl shadow-sm space-y-2">
                  <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Interviewer Summary</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                    {feedback.feedbackSummary}
                  </p>
                </div>

                {/* Strengths & Weaknesses Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-2">
                      <i className="fa-solid fa-circle-check text-sm"></i>
                      Key Strengths
                    </h4>
                    <ul className="space-y-2.5">
                      {feedback.strengths.map((str, idx) => (
                        <li key={idx} className="flex gap-3 items-start bg-green-50/50 dark:bg-green-955/10 p-3.5 rounded-xl border border-green-100/50 dark:border-green-900/30 text-xs text-gray-700 dark:text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation text-sm"></i>
                      Gaps Identified
                    </h4>
                    <ul className="space-y-2.5">
                      {feedback.weaknesses.map((weak, idx) => (
                        <li key={idx} className="flex gap-3 items-start bg-amber-50/50 dark:bg-amber-955/10 p-3.5 rounded-xl border border-amber-100/50 dark:border-amber-900/30 text-xs text-gray-700 dark:text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                          <span>{weak}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Tips for improvement */}
                <div className="space-y-4 border-t dark:border-gray-800 pt-6">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-500">Actionable Interview Tips</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {feedback.tipsForImprovement.map((tip, idx) => (
                      <div key={idx} className="bg-white dark:bg-gray-800/30 border dark:border-gray-800 p-4 rounded-xl shadow-inner text-xs text-gray-600 dark:text-gray-400 flex gap-3 items-start">
                        <span className="text-indigo-500 font-black text-sm">0{idx + 1}.</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div className="flex justify-center gap-4 pt-4 shrink-0">
                  <button
                    onClick={() => {
                      setMessages([]);
                      setInterviewEnded(false);
                      setFeedback(null);
                    }}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <i className="fa-solid fa-rotate-left mr-2"></i>
                    Start New Interview
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-gray-900 hover:bg-black dark:bg-gray-800 dark:hover:bg-gray-700 text-white dark:text-gray-300 font-bold rounded-xl text-xs transition-all border dark:border-gray-700"
                  >
                    Return to Mentorship Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isGeneratingFeedback && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl border dark:border-gray-700 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest">Evaluating Interview</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Interviewer is generating performance card...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPrep;
