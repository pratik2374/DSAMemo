
import React, { useState, useEffect } from 'react';
import { Takeaway } from '../types';
import { googleSheetsService } from '../googleSheetsService';

interface TakeawaysModalProps {
  takeaways: Takeaway[];
  onUpdateTakeaway: (updated: Takeaway) => void;
  onClose: () => void;
}

const TakeawaysModal: React.FC<TakeawaysModalProps> = ({ takeaways, onUpdateTakeaway, onClose }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [localTakeaways, setLocalTakeaways] = useState<Takeaway[]>([]);

  useEffect(() => {
    setLocalTakeaways(takeaways);
  }, [takeaways]);

  const showToast = (message: string, isError = false) => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 ${isError ? 'bg-red-600' : 'bg-gray-900'} text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl z-[200] animate-in fade-in slide-in-from-bottom-2`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied ${label}!`);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleSyncToLiveSheet = async () => {
    if (localTakeaways.length === 0) return;
    setIsSyncing(true);
    try {
      await googleSheetsService.syncToSheet(localTakeaways);
      showToast("Successfully synced to Google Sheets!");
    } catch (err: any) {
      showToast(err.message || "Failed to sync. Check console for details.", true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFieldChange = (id: string, field: keyof Takeaway, value: any) => {
    const updatedList = localTakeaways.map(t => {
      if (t.id === id) {
        const updatedItem = { ...t, [field]: value };
        onUpdateTakeaway(updatedItem);
        return updatedItem;
      }
      return t;
    });
    setLocalTakeaways(updatedList);
  };

  const exportToCSV = () => {
    if (localTakeaways.length === 0) return;

    const escapeCSV = (str: string) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = ['Problems', 'Notes', 'Concept', 'Link', 'Category', 'Importance'];
    const rows = localTakeaways.map(t => [
      escapeCSV(t.problemTitle),
      escapeCSV(t.notes),
      escapeCSV(t.concept),
      escapeCSV(t.link),
      escapeCSV(t.category),
      '⭐'.repeat(t.importance)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DSA_Knowledge_Base_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200 border dark:border-gray-700 transition-colors">
        <header className="p-6 border-b dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Knowledge Base</h2>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Review your captured patterns and insights.</p>
          </div>
          <div className="flex items-center gap-3">
            {localTakeaways.length > 0 && (
              <>
                <button
                  onClick={handleSyncToLiveSheet}
                  disabled={isSyncing}
                  className="flex items-center gap-2 bg-[#107c41] hover:bg-[#0a5e31] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-900/10 active:scale-95 disabled:opacity-50"
                >
                  <i className={`fa-solid ${isSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
                  {isSyncing ? 'Syncing...' : 'Sync to Live Sheet'}
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  <i className="fa-solid fa-file-csv"></i>
                  CSV
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
          {localTakeaways.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-3xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-box-open text-4xl"></i>
              </div>
              <p className="font-bold text-gray-900 dark:text-gray-100">Your knowledge base is empty.</p>
              <p className="text-xs mt-1 text-gray-500">Finish problems to start capturing takeaways.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {localTakeaways.map((t) => (
                <div key={t.id} className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <i className="fa-solid fa-feather text-indigo-500 shrink-0"></i>
                      <input
                        type="text"
                        value={t.problemTitle}
                        onChange={(e) => handleFieldChange(t.id, 'problemTitle', e.target.value)}
                        className="bg-transparent border-none outline-none font-bold text-gray-900 dark:text-gray-100 p-0 m-0 w-full focus:ring-0"
                      />
                      <button
                        onClick={() => copyToClipboard(t.problemTitle, 'Title')}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all shrink-0"
                        title="Copy Title"
                      >
                        <i className="fa-solid fa-copy text-[10px]"></i>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={t.category}
                        onChange={(e) => handleFieldChange(t.id, 'category', e.target.value)}
                        className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-black uppercase tracking-widest px-2 py-1 w-24 text-center border-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="flex text-yellow-500 text-[10px]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => handleFieldChange(t.id, 'importance', i + 1)}
                            className="hover:scale-125 transition-transform"
                          >
                            <i className={`fa-solid fa-star ${i < t.importance ? '' : 'text-gray-200 dark:text-gray-700'}`}></i>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3 flex flex-col">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Solved Approaches</h4>
                        <button
                          onClick={() => copyToClipboard(t.notes, 'Approaches')}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
                          title="Copy Approaches"
                        >
                          <i className="fa-solid fa-copy text-[10px]"></i>
                        </button>
                      </div>
                      <textarea
                        value={t.notes}
                        onChange={(e) => handleFieldChange(t.id, 'notes', e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium resize-none focus:ring-0 min-h-[100px] p-0"
                        placeholder="Detail your solution approaches here..."
                      />
                    </div>
                    <div className="space-y-3 md:border-l dark:border-gray-800 md:pl-8 flex flex-col">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Key Takeaways</h4>
                        <button
                          onClick={() => copyToClipboard(t.concept, 'Key Takeaways')}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
                          title="Copy Key Takeaways"
                        >
                          <i className="fa-solid fa-copy text-[10px]"></i>
                        </button>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex-1 flex flex-col">
                        <textarea
                          value={t.concept}
                          onChange={(e) => handleFieldChange(t.id, 'concept', e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-sm text-indigo-900 dark:text-indigo-200 font-bold italic leading-relaxed resize-none focus:ring-0 p-0"
                          placeholder="What did you learn from this problem?"
                        />
                      </div>
                    </div>
                  </div>
                  {t.link && (
                    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/30 border-t dark:border-gray-800 flex justify-end">
                      <a
                        href={t.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-link"></i> Problem Source
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Build your patterns. Crush your interviews.</p>
        </footer>
      </div>
    </div>
  );
};

export default TakeawaysModal;
