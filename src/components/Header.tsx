import React from 'react';
import { Settings, Volume2, Moon, Sun, HelpCircle, Trophy, BookOpen, Mic } from 'lucide-react';
import { AppSettings } from '../types';

interface HeaderProps {
  currentTab: 'tournament' | 'arena' | 'words' | 'results';
  onTabChange: (tab: 'tournament' | 'arena' | 'words' | 'results') => void;
  wordCount: number;
  resultsCount: number;
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenTeamsGuide: () => void;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  wordCount,
  resultsCount,
  settings,
  onOpenSettings,
  onOpenTeamsGuide,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        
        {/* Zone 1: Brand Wordmark with School Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center p-1 shrink-0 overflow-hidden">
            <img
              src="/assets/aistudio/Asset-2-2_69f00ddc.png"
              alt="School Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
              {settings.school || "Adhwa'a Al-Hedaya International Schools"}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Official 2026–2027</span>
              <span aria-hidden="true">·</span>
              <span>Round 2 & Finals</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single-Line, Clean Typography) */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onTabChange('tournament')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'tournament'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                : 'text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live Match (QR)</span>
          </button>

          <button
            onClick={() => onTabChange('arena')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'arena'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Solo Arena</span>
          </button>

          <button
            onClick={() => onTabChange('words')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'words'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Words</span>
            <span className="text-xs opacity-75 font-mono tabular-nums">({wordCount})</span>
          </button>

          <button
            onClick={() => onTabChange('results')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              currentTab === 'results'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Results</span>
            {resultsCount > 0 && (
              <span className="text-xs opacity-75 font-mono tabular-nums">({resultsCount})</span>
            )}
          </button>
        </nav>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onOpenTeamsGuide}
            title="Competition & Audio Guide"
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleTheme}
            title="Toggle Light / Dark mode"
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={onOpenSettings}
            title="Settings & Branding"
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
