import React, { useState } from 'react';
import {
  Upload, Search, Plus, Trash2, Download, Sparkles, Check, FileText,
  AlertCircle, RefreshCw, Filter, BookOpen, Layers
} from 'lucide-react';
import { WordItem, DifficultyLevel } from '../types';

interface WordBankProps {
  words: WordItem[];
  onAddWords: (newWords: WordItem[], replace: boolean, targetGrade: string) => void;
  onDeleteWord: (index: number) => void;
  onClearGrade: (grade: string) => void;
}

export const WordBank: React.FC<WordBankProps> = ({
  words,
  onAddWords,
  onDeleteWord,
  onClearGrade,
}) => {
  const [selectedGrade, setSelectedGrade] = useState('4');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // AI Import State
  const [importGrade, setImportGrade] = useState('4');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [extractedReviewList, setExtractedReviewList] = useState<(WordItem & { keep: boolean })[]>([]);
  const [showReview, setShowReview] = useState(false);

  // Manual Quick Add
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newDef, setNewDef] = useState('');
  const [newSentence, setNewSentence] = useState('');
  const [newLevel, setNewLevel] = useState<DifficultyLevel>('Medium');
  const [newPartOfSpeech, setNewPartOfSpeech] = useState('noun');
  const [newOrigin, setNewOrigin] = useState('Latin');
  const [isEnriching, setIsEnriching] = useState(false);

  // Confirmation state for clearing
  const [confirmClear, setConfirmClear] = useState(false);

  // Filter words
  const filteredWords = words
    .map((w, originalIndex) => ({ word: w, originalIndex }))
    .filter(({ word }) => {
      const matchGrade = selectedGrade === 'any' ? true : String(word.grade) === selectedGrade;
      const matchLevel = selectedLevelFilter === 'all' ? true : word.level === selectedLevelFilter;
      const matchQuery =
        word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        word.def.toLowerCase().includes(searchQuery.toLowerCase());
      return matchGrade && matchLevel && matchQuery;
    });

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = words.filter(w => String(w.grade) === selectedGrade);
    const headers = ['Word', 'Level', 'Part of Speech', 'Origin', 'Definition', 'Sentence'];
    const rows = listToExport.map(w => [
      `"${w.word.replace(/"/g, '""')}"`,
      `"${w.level}"`,
      `"${(w.partOfSpeech || '').replace(/"/g, '""')}"`,
      `"${(w.origin || '').replace(/"/g, '""')}"`,
      `"${w.def.replace(/"/g, '""')}"`,
      `"${w.sentence.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `spelling_bee_grade_${selectedGrade}_words.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert image file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Trigger Gemini API extraction
  const runAiExtraction = async (payload: { text?: string; images?: Array<{ mimeType: string; data: string }> }) => {
    setIsProcessingAI(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/extract-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: payload.text,
          images: payload.images,
          grade: importGrade,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract words.');
      }

      if (!data.words || data.words.length === 0) {
        throw new Error('No spelling words could be detected in this content.');
      }

      const review = data.words.map((item: any) => ({
        id: `ai-${item.word}-${Date.now()}`,
        word: (item.word || '').trim().toLowerCase(),
        level: (['Easy', 'Medium', 'Hard'].includes(item.level) ? item.level : 'Medium') as DifficultyLevel,
        def: item.def || 'Vocabulary word.',
        sentence: item.sentence || `Remember how to spell ${item.word}.`,
        partOfSpeech: item.partOfSpeech || 'noun',
        origin: item.origin || 'English',
        grade: importGrade,
        keep: true,
      }));

      setExtractedReviewList(review);
      setShowReview(true);
    } catch (err: any) {
      setAiError(err.message || 'Something went wrong during AI analysis.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // File drop handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');

    if (isImage) {
      const b64 = await fileToBase64(file);
      await runAiExtraction({
        images: [{ mimeType: file.type, data: b64 }],
      });
    } else {
      const text = await file.text();
      await runAiExtraction({ text });
    }

    e.target.value = '';
  };

  // Paste handler
  const handleExtractPasted = async () => {
    if (!pasteText.trim()) return;
    await runAiExtraction({ text: pasteText });
  };

  // Confirm review and save
  const handleConfirmImport = () => {
    const toAdd = extractedReviewList
      .filter(item => item.keep && item.word.trim())
      .map(item => ({
        word: item.word.trim().toLowerCase(),
        level: item.level,
        def: item.def,
        sentence: item.sentence,
        partOfSpeech: item.partOfSpeech,
        origin: item.origin,
        grade: importGrade,
      }));

    if (toAdd.length > 0) {
      onAddWords(toAdd, replaceExisting, importGrade);
    }

    setShowReview(false);
    setExtractedReviewList([]);
    setPasteText('');
    setSelectedGrade(importGrade);
  };

  // Quick AI enrich for single word
  const handleEnrichWord = async () => {
    if (!newWord.trim()) return;
    setIsEnriching(true);
    try {
      const res = await fetch('/api/ai/enrich-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord.trim(), grade: selectedGrade }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setNewDef(json.data.def || '');
        setNewSentence(json.data.sentence || '');
        setNewLevel(json.data.level || 'Medium');
        setNewPartOfSpeech(json.data.partOfSpeech || 'noun');
        setNewOrigin(json.data.origin || 'Latin');
      }
    } catch (err) {
      console.warn('Enrich failed:', err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSaveManualWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    onAddWords(
      [
        {
          word: newWord.trim().toLowerCase(),
          level: newLevel,
          def: newDef.trim() || 'Vocabulary word.',
          sentence: newSentence.trim() || `Remember how to spell ${newWord.trim()}.`,
          partOfSpeech: newPartOfSpeech,
          origin: newOrigin,
          grade: selectedGrade,
        },
      ],
      false,
      selectedGrade
    );

    setNewWord('');
    setNewDef('');
    setNewSentence('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. AI Word Importer Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            AI Word List Importer
          </h2>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
            Gemini 3.8 Flash
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Upload any document (PDF, CSV, TXT), or a photo of a printed word list, or paste raw text. Gemini will extract the words, write child-friendly definitions, generate example sentences, and identify language of origin.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* File Upload Area */}
          <div className="md:col-span-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-800/40 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Upload Word List Document or Photo
            </div>
            <div className="text-xs text-slate-400 mt-1 mb-4">
              PDF, Word (.docx), CSV, TXT, or photos (PNG, JPG)
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs rounded-xl cursor-pointer shadow-sm">
              <span>Choose File</span>
              <input
                type="file"
                className="hidden"
                accept=".txt,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={isProcessingAI}
              />
            </label>
          </div>

          {/* Paste Raw Text Area */}
          <div className="md:col-span-6 space-y-3">
            <textarea
              rows={3}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Or paste spelling words here (e.g. one per line, or pasted from an email)..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Grade:</span>
                <select
                  value={importGrade}
                  onChange={e => setImportGrade(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  {['4', '5', '6', '7', '8', '9'].map(g => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={e => setReplaceExisting(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Replace Grade {importGrade}</span>
                </label>
              </div>

              <button
                onClick={handleExtractPasted}
                disabled={!pasteText.trim() || isProcessingAI}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract with AI</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isProcessingAI && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <div>
              <div className="font-semibold text-xs text-blue-900 dark:text-blue-200">
                Gemini 3.8 Flash is analyzing your word list...
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400">
                Extracting vocabulary words, creating definitions, example sentences, and etymology.
              </div>
            </div>
          </div>
        )}

        {/* AI Error */}
        {aiError && (
          <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* Review Extracted Words Modal / Drawer */}
      {showReview && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/80 rounded-2xl p-6 shadow-md space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Review Extracted Words ({extractedReviewList.filter(x => x.keep).length} selected)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Targeting Grade {importGrade}. Untick or edit any word before adding to the official bank.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const allKept = extractedReviewList.every(x => x.keep);
                  setExtractedReviewList(prev => prev.map(x => ({ ...x, keep: !allKept })));
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Toggle All
              </button>
              <button
                onClick={() => setShowReview(false)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
              >
                Confirm & Add to Grade {importGrade}
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-10">Keep</th>
                  <th className="p-2.5 w-32">Word</th>
                  <th className="p-2.5 w-24">Level</th>
                  <th className="p-2.5">Definition</th>
                  <th className="p-2.5">Example Sentence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {extractedReviewList.map((item, i) => (
                  <tr key={i} className={item.keep ? '' : 'opacity-40'}>
                    <td className="p-2.5">
                      <input
                        type="checkbox"
                        checked={item.keep}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].keep = e.target.checked;
                          setExtractedReviewList(updated);
                        }}
                        className="rounded text-blue-600"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={item.word}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].word = e.target.value;
                          setExtractedReviewList(updated);
                        }}
                        className="w-full font-bold px-1.5 py-1 border rounded bg-transparent text-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="p-2.5">
                      <select
                        value={item.level}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].level = e.target.value as DifficultyLevel;
                          setExtractedReviewList(updated);
                        }}
                        className="px-1.5 py-1 border rounded bg-transparent text-slate-800 dark:text-slate-200"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={item.def}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].def = e.target.value;
                          setExtractedReviewList(updated);
                        }}
                        className="w-full px-1.5 py-1 border rounded bg-transparent text-slate-800 dark:text-slate-300"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={item.sentence}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].sentence = e.target.value;
                          setExtractedReviewList(updated);
                        }}
                        className="w-full px-1.5 py-1 border rounded bg-transparent text-slate-800 dark:text-slate-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Official Word Bank Table & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Grade {selectedGrade} Word Bank
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {filteredWords.length} words
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Grade Selector */}
            <select
              value={selectedGrade}
              onChange={e => {
                setSelectedGrade(e.target.value);
                setConfirmClear(false);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
            >
              {['4', '5', '6', '7', '8', '9'].map(g => {
                const count = words.filter(w => String(w.grade) === g).length;
                return (
                  <option key={g} value={g}>
                    Grade {g} ({count} words)
                  </option>
                );
              })}
            </select>

            {/* Level Selector */}
            <select
              value={selectedLevelFilter}
              onChange={e => setSelectedLevelFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search words..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-48"
              />
            </div>

            {/* Add Single Word */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Word</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {/* Clear Grade */}
            <button
              onClick={() => {
                if (confirmClear) {
                  onClearGrade(selectedGrade);
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3500);
                }
              }}
              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors text-xs font-semibold"
              title="Clear all words for this grade"
            >
              {confirmClear ? 'Click again to confirm' : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Word Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 backdrop-blur uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 w-36">Word</th>
                <th className="py-3 px-4 w-24">Level</th>
                <th className="py-3 px-4 w-28">Origin</th>
                <th className="py-3 px-4">Definition</th>
                <th className="py-3 px-4">Example Sentence</th>
                <th className="py-3 px-4 w-12 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredWords.length > 0 ? (
                filteredWords.map(({ word, originalIndex }, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-sm text-slate-900 dark:text-white capitalize">
                      {word.word}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          word.level === 'Easy'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : word.level === 'Medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {word.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                      {word.origin || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {word.def}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 italic">
                      &quot;{word.sentence}&quot;
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onDeleteWord(originalIndex)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete word"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No words found for this filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Word Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Add Word to Grade {selectedGrade}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualWord} className="space-y-3.5 text-xs">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Spelling Word
                  </label>
                  <input
                    type="text"
                    required
                    value={newWord}
                    onChange={e => setNewWord(e.target.value)}
                    placeholder="e.g. perseverance"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleEnrichWord}
                  disabled={!newWord.trim() || isEnriching}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center gap-1 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEnriching ? 'Generating...' : 'AI Enrich'}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={newLevel}
                    onChange={e => setNewLevel(e.target.value as DifficultyLevel)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Part of Speech
                  </label>
                  <input
                    type="text"
                    value={newPartOfSpeech}
                    onChange={e => setNewPartOfSpeech(e.target.value)}
                    placeholder="noun"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Language Origin
                  </label>
                  <input
                    type="text"
                    value={newOrigin}
                    onChange={e => setNewOrigin(e.target.value)}
                    placeholder="Latin"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Definition
                </label>
                <textarea
                  rows={2}
                  required
                  value={newDef}
                  onChange={e => setNewDef(e.target.value)}
                  placeholder="Clear student definition..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Example Sentence
                </label>
                <textarea
                  rows={2}
                  required
                  value={newSentence}
                  onChange={e => setNewSentence(e.target.value)}
                  placeholder="Example sentence demonstrating contextual usage..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Save Word
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
