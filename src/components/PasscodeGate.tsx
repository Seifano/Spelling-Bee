import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, KeyRound, AlertTriangle, ArrowRight } from 'lucide-react';

interface PasscodeGateProps {
  onUnlock: () => void;
  onCancel?: () => void;
}

const REQUIRED_CODE = '2026';

export const PasscodeGate: React.FC<PasscodeGateProps> = ({ onUnlock, onCancel }) => {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-focus first digit
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1);
    if (!/^\d*$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMsg('');

    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto verify if all 4 entered
    const combined = newDigits.join('');
    if (combined.length === 4) {
      verifyCode(combined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter') {
      verifyCode(digits.join(''));
    }
  };

  const verifyCode = (code: string) => {
    if (code === REQUIRED_CODE) {
      sessionStorage.setItem('spellbee_host_passcode_verified', REQUIRED_CODE);
      onUnlock();
    } else {
      setErrorMsg('Incorrect host code. Only authorized teachers and proctors may host.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setDigits(['', '', '', '']);
      inputRefs[0].current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl" />
      </div>

      <div className={`relative max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-7 sm:p-9 shadow-2xl transition-transform ${isShaking ? 'animate-bounce' : ''}`}>
        
        {/* School Crest & Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-white rounded-2xl p-2.5 shadow-xl border border-slate-700 flex items-center justify-center">
              <img
                src="/assets/aistudio/Asset-2-2_69f00ddc.png"
                alt="Adhwa'a Al-Hedaya Logo"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 shadow-md">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-blue-400 bg-blue-950/60 border border-blue-800/60 px-3 py-1 rounded-full">
              Host / Teacher Authorization
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2">
              Teacher Security Passcode
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Students join as guests with no passcode. Enter the 4-digit code to host matches.
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-200/90 mb-5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Host privilege requires official competition authorization. Passcode: <strong>2026</strong>.
          </p>
        </div>

        {/* 4-Digit Code Input */}
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300 text-center uppercase tracking-wider">
            Enter 4-Digit Host Code
          </label>

          <div className="flex justify-center gap-3">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                className="w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl font-extrabold bg-slate-800/90 border-2 border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white rounded-2xl outline-none transition-all shadow-inner"
              />
            ))}
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold animate-fadeIn">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => verifyCode(digits.join(''))}
            disabled={digits.join('').length !== 4}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98]"
          >
            <KeyRound className="w-4 h-4" />
            <span>Unlock Teacher Controls</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel & Return to Guest Hub
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
