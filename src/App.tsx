import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Arena } from './components/Arena';
import { WordBank } from './components/WordBank';
import { ResultsLeaderboard } from './components/ResultsLeaderboard';
import { SettingsModal } from './components/SettingsModal';
import { TeamsGuideModal } from './components/TeamsGuideModal';
import { CertificateModal } from './components/CertificateModal';
import { PasscodeGate } from './components/PasscodeGate';
import { TournamentHub } from './components/TournamentHub';
import { WordItem, LeaderboardRecord, AppSettings } from './types';
import { getInitialWords } from './data/defaultWords';

const STORAGE_KEYS = {
  WORDS: 'spelling_bee_words_v4_150',
  LEADERBOARD: 'spelling_bee_leaderboard_v3',
  SETTINGS: 'spelling_bee_settings_v3',
};

const DEFAULT_SETTINGS: AppSettings = {
  school: "Adhwa'a Al-Hedaya International Schools",
  brand: '#1b2a4e',
  accent: '#a51c30',
  green: '#15803d',
  seconds: 12,
  sound: true,
  gain: 2.5,
  lang: 'en-US',
  voice: '',
  theme: 'light',
  wordsPerRound: 3,
  autoSpeak: true,
};

export default function App() {
  // 1. App State
  const [currentTab, setCurrentTab] = useState<'tournament' | 'arena' | 'words' | 'results'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('join') || params.get('room') || params.get('pin')) {
        return 'tournament';
      }
    }
    return 'tournament';
  });
  const [words, setWords] = useState<WordItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 150) return parsed;
      }
    } catch {}
    return getInitialWords();
  });

  const [records, setRecords] = useState<LeaderboardRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTeamsGuideOpen, setIsTeamsGuideOpen] = useState(false);
  const [certificateData, setCertificateData] = useState<{
    isOpen: boolean;
    name: string;
    classSec: string;
    score: number;
    total: number;
  }>({
    isOpen: false,
    name: '',
    classSec: '',
    score: 0,
    total: 3,
  });

  // 2. LocalStorage Sync
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(words));
    } catch {}
  }, [words]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(records));
    } catch {}
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // 3. Theme & Brand Variables Synchronization
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--brand', settings.brand);
    root.style.setProperty('--accent', settings.accent);
    root.style.setProperty('--ok-base', settings.green);
  }, [settings.theme, settings.brand, settings.accent, settings.green]);

  // Handlers
  const handleToggleTheme = () => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleAddWords = (newWords: WordItem[], replace: boolean, targetGrade: string) => {
    setWords(prev => {
      let base = replace ? prev.filter(w => String(w.grade) !== String(targetGrade)) : [...prev];
      const existingInGrade = new Set(
        base.filter(w => String(w.grade) === String(targetGrade)).map(w => w.word.toLowerCase())
      );

      for (const item of newWords) {
        const lower = item.word.toLowerCase();
        if (!existingInGrade.has(lower)) {
          existingInGrade.add(lower);
          base.push({
            ...item,
            id: `word-${item.word}-${Date.now()}-${Math.random()}`,
            grade: targetGrade,
          });
        }
      }
      return base;
    });
  };

  const handleDeleteWord = (index: number) => {
    setWords(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearGrade = (grade: string) => {
    setWords(prev => prev.filter(w => String(w.grade) !== String(grade)));
  };

  const handleSaveRecord = (record: LeaderboardRecord) => {
    setRecords(prev => [record, ...prev]);
  };

  const handleClearRecords = () => {
    setRecords([]);
  };

  const handleOpenCertificate = (name: string, classSec: string, score: number, total: number) => {
    setCertificateData({
      isOpen: true,
      name,
      classSec,
      score,
      total,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* 1. Header (3-zone Top Bar) */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        wordCount={words.length}
        resultsCount={records.length}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTeamsGuide={() => setIsTeamsGuideOpen(true)}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Main Tab Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentTab === 'tournament' && (
          <TournamentHub
            settings={settings}
            words={words}
            onOpenCertificate={handleOpenCertificate}
            onNavigateToSolo={() => setCurrentTab('arena')}
          />
        )}

        {currentTab === 'arena' && (
          <Arena
            words={words}
            settings={settings}
            onSaveRecord={handleSaveRecord}
            onNavigateToWords={() => setCurrentTab('words')}
            onOpenCertificate={handleOpenCertificate}
          />
        )}

        {currentTab === 'words' && (
          <WordBank
            words={words}
            onAddWords={handleAddWords}
            onDeleteWord={handleDeleteWord}
            onClearGrade={handleClearGrade}
          />
        )}

        {currentTab === 'results' && (
          <ResultsLeaderboard
            records={records}
            onClearRecords={handleClearRecords}
            onOpenCertificate={handleOpenCertificate}
          />
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {settings.school}
            </span>
            <span>·</span>
            <span>Spelling Bee Competition 2026–2027</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 3.8 Flash AI & Web Speech</span>
            <span>·</span>
            <button
              onClick={() => setIsTeamsGuideOpen(true)}
              className="hover:underline text-blue-600 dark:text-blue-400"
            >
              Audio Proctoring Guide
            </button>
          </div>
        </div>
      </footer>

      {/* 4. Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
      />

      <TeamsGuideModal
        isOpen={isTeamsGuideOpen}
        onClose={() => setIsTeamsGuideOpen(false)}
      />

      <CertificateModal
        isOpen={certificateData.isOpen}
        onClose={() => setCertificateData(prev => ({ ...prev, isOpen: false }))}
        studentName={certificateData.name}
        classSec={certificateData.classSec}
        score={certificateData.score}
        totalWords={certificateData.total}
        settings={settings}
      />
    </div>
  );
}
