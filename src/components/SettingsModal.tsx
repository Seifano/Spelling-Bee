import React, { useState, useEffect } from 'react';
import { Volume2, Check, Sparkles } from 'lucide-react';
import { AppSettings } from '../types';
import { getEnglishVoices, speakText } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

const COLOR_PRESETS = [
  { name: 'Adhwa\'a Al-Hedaya (Official)', brand: '#1b2a4e', accent: '#a51c30', green: '#15803d' },
  { name: 'Royal Navy & Gold', brand: '#1e3a8a', accent: '#d97706', green: '#15803d' },
  { name: 'Ivy Crimson & Slate', brand: '#881337', accent: '#1e293b', green: '#15803d' },
  { name: 'Academy Emerald & Navy', brand: '#064e3b', accent: '#1e3a8a', green: '#15803d' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    const list = getEnglishVoices();
    setVoices(list);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoices(getEnglishVoices());
      };
    }
  }, []);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    speakText('Welcome to the online spelling bee competition. Please spell the word extraordinary.', {
      voiceURI: localSettings.voice,
      lang: localSettings.lang,
      rate: 0.82,
    });
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Competition & School Settings
            </h3>
            <p className="text-xs text-slate-500">
              Customize school branding, competition timer, reading voice, and sound effects.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* School Name & Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/Asset-2-2_69f00ddc.png"
                alt="School Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={localSettings.school}
                onChange={e => setLocalSettings({ ...localSettings, school: e.target.value })}
                placeholder="e.g. Adhwa'a Al-Hedaya International Schools"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* Time & English Dialect */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seconds per Word
              </label>
              <select
                value={localSettings.seconds}
                onChange={e => setLocalSettings({ ...localSettings, seconds: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value={10}>10 seconds (Speed Round)</option>
                <option value={12}>12 seconds (Official)</option>
                <option value={15}>15 seconds</option>
                <option value={20}>20 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                English Pronunciation
              </label>
              <select
                value={localSettings.lang}
                onChange={e => setLocalSettings({ ...localSettings, lang: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="en-US">American English (Z = Zee)</option>
                <option value="en-GB">British English (Z = Zed)</option>
              </select>
            </div>
          </div>

          {/* Reading Voice Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Pronouncer Reading Voice
              </label>
              <button
                type="button"
                onClick={handleTestVoice}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Voice</span>
              </button>
            </div>
            <select
              value={localSettings.voice}
              onChange={e => setLocalSettings({ ...localSettings, voice: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            >
              {voices.length > 0 ? (
                voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))
              ) : (
                <option value="">Default System English Voice</option>
              )}
            </select>
          </div>

          {/* Sound FX Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Sound Effects & Chimes
              </div>
              <div className="text-slate-400 text-[11px]">
                Plays clock ticks, letter clicks, correct chimes, and buzzer.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.sound}
                onChange={e => setLocalSettings({ ...localSettings, sound: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* School Colors & Themes */}
          <div className="space-y-2 pt-1">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              School Colors
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      brand: preset.brand,
                      accent: preset.accent,
                      green: preset.green,
                    })
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px]"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/10"
                    style={{ backgroundColor: preset.brand }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-slate-500 text-[11px] mb-1">Primary Brand</span>
                <div className="flex items-center gap-2 p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-800">
                  <input
                    type="color"
                    value={localSettings.brand}
                    onChange={e => setLocalSettings({ ...localSettings, brand: e.target.value })}
                    className="w-7 h-7 rounded border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {localSettings.brand}
                  </span>
                </div>
              </div>
              <div>
                <span className="block text-slate-500 text-[11px] mb-1">Accent</span>
                <div className="flex items-center gap-2 p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-800">
                  <input
                    type="color"
                    value={localSettings.accent}
                    onChange={e => setLocalSettings({ ...localSettings, accent: e.target.value })}
                    className="w-7 h-7 rounded border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {localSettings.accent}
                  </span>
                </div>
              </div>
              <div>
                <span className="block text-slate-500 text-[11px] mb-1">Correct / Success</span>
                <div className="flex items-center gap-2 p-1.5 border rounded-lg bg-slate-50 dark:bg-slate-800">
                  <input
                    type="color"
                    value={localSettings.green}
                    onChange={e => setLocalSettings({ ...localSettings, green: e.target.value })}
                    className="w-7 h-7 rounded border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {localSettings.green}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
