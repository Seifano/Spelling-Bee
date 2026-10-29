import React, { useState, useEffect } from 'react';
import { Users, QrCode, Play, ShieldAlert, Award, ArrowRight, Video, Lock } from 'lucide-react';
import { TournamentHost } from './TournamentHost';
import { TournamentStudent } from './TournamentStudent';
import { PasscodeGate } from './PasscodeGate';
import { AppSettings, WordItem } from '../types';

interface TournamentHubProps {
  settings: AppSettings;
  words: WordItem[];
  onOpenCertificate: (name: string, classSec: string, score: number, total: number) => void;
  onNavigateToSolo: () => void;
}

export const TournamentHub: React.FC<TournamentHubProps> = ({
  settings,
  words,
  onOpenCertificate,
  onNavigateToSolo,
}) => {
  const [mode, setMode] = useState<'hub' | 'host' | 'student'>('hub');
  const [joinPin, setJoinPin] = useState('');
  const [showHostPasscode, setShowHostPasscode] = useState(false);

  // Check URL params for direct join: ?join=PIN or ?room=PIN
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('join') || params.get('room') || params.get('pin');
    if (pin) {
      setJoinPin(pin.toUpperCase());
      setMode('student');
    }
  }, []);

  const handleRequestHost = () => {
    try {
      const isVerified = sessionStorage.getItem('spellbee_host_passcode_verified');
      if (isVerified === '2026') {
        setMode('host');
        return;
      }
    } catch {}
    setShowHostPasscode(true);
  };

  if (mode === 'host') {
    return (
      <TournamentHost
        settings={settings}
        words={words}
        onOpenCertificate={onOpenCertificate}
        onExit={() => setMode('hub')}
      />
    );
  }

  if (mode === 'student') {
    return (
      <TournamentStudent
        settings={settings}
        prefilledPin={joinPin}
        onExit={() => {
          setMode('hub');
          setJoinPin('');
        }}
        onOpenCertificate={onOpenCertificate}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-6 space-y-8 animate-fadeIn">
      {/* Hero Tournament Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800 text-white rounded-3xl p-8 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-extrabold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Multiplayer Live Tournament (Up to 25 Students)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Online Spelling Bee Competition
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Host synchronized live tournament matches where students scan a QR code to enter immediately as guests. Includes live camera centering HUD, anti-cheating monitoring, live pronunciation, typing or voice spelling, and automatic champion tallying!
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-lg border border-white/10">
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span>QR Code Instant Guest Join</span>
            </span>
            <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-lg border border-white/10">
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span>Camera Centering HUD</span>
            </span>
            <span className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-lg border border-white/10">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Anti-Cheating Position Alarm</span>
            </span>
          </div>
        </div>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        
        {/* Host Live Match Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 group">
          <div className="space-y-4">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform relative">
              <Users className="w-7 h-7" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 shadow-sm" title="Teacher Passcode Protected">
                <Lock className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  For Teachers & Proctors
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Code: 2026
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                Host a Live Tournament
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Project the big QR code and PIN on your shared screen. Monitor up to 25 student cameras, receive real-time camera alerts, start the match, and let the system declare the grand winner.
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestHost}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4 text-blue-200" />
            <span>Host Match (Enter Code 2026)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Student Join Match Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 group">
          <div className="space-y-4">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  For Contestants & Students
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  Guest Join · No Code
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                Join Match with PIN / QR
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Enter as a guest immediately! Just enter the 6-character room PIN and your name. Align your face inside the green centering guides, and spell words by typing or voice.
              </p>
            </div>
          </div>

          <button
            onClick={() => setMode('student')}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Enter as Student (Instant Join)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Solo Classroom Practice Link */}
      <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="text-slate-600 dark:text-slate-300">
          Want single-student classroom podium or solo training mode instead?
        </div>
        <button
          onClick={onNavigateToSolo}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open Solo Classroom Arena →
        </button>
      </div>

      {/* Host Passcode Verification Modal */}
      {showHostPasscode && (
        <PasscodeGate
          onUnlock={() => {
            setShowHostPasscode(false);
            setMode('host');
          }}
          onCancel={() => setShowHostPasscode(false)}
        />
      )}
    </div>
  );
};
