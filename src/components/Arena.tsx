import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2, Play, Check, X, RotateCcw, ArrowRight, Mic, MicOff,
  Sparkles, Award, Shuffle, HelpCircle, Book, MessageSquare, Globe, Hash,
  Edit2, Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WordItem, StudentResult, AppSettings, LeaderboardRecord } from '../types';
import { CLASSES_BY_GRADE } from '../data/defaultWords';
import {
  playChime, playBuzzer, playLetterPop, playTimerTick, playFanfare, speakText
} from '../utils/audio';
import {
  parseSpokenLetters,
  extractBestLettersFromResults,
  createAudioMeter,
  AudioMeterController,
  PHONETIC_CONFUSION_GROUPS
} from '../utils/speechRecognition';

interface ArenaProps {
  words: WordItem[];
  settings: AppSettings;
  onSaveRecord: (record: LeaderboardRecord) => void;
  onNavigateToWords: () => void;
  onOpenCertificate: (name: string, classSec: string, score: number, total: number) => void;
}

type Phase = 'idle' | 'speaking' | 'ready' | 'listening' | 'checked' | 'marked';

export const Arena: React.FC<ArenaProps> = ({
  words,
  settings,
  onSaveRecord,
  onNavigateToWords,
  onOpenCertificate,
}) => {
  // Student selection
  const [studentName, setStudentName] = useState('');
  const [selectedClass, setSelectedClass] = useState('4-A');
  const [levelMode, setLevelMode] = useState<'mixed' | 'Easy' | 'Medium' | 'Hard' | 'any'>('mixed');

  // Round state
  const [roundWords, setRoundWords] = useState<WordItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<(StudentResult | null)[]>([null, null, null]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundFinished, setRoundFinished] = useState(false);

  // Spelled letters
  const [committedLetters, setCommittedLetters] = useState<string[]>([]);
  const [interimLetters, setInterimLetters] = useState<string[]>([]);
  const [ignoredSpeech, setIgnoredSpeech] = useState<string[]>([]);
  const [editingTileIndex, setEditingTileIndex] = useState<number | null>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(settings.seconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const [wordStartTime, setWordStartTime] = useState(0);

  // Audio & Mic state
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [gainLevel, setGainLevel] = useState(settings.gain || 3.0);
  const [audioSource, setAudioSource] = useState<'mic' | 'display'>('mic');
  const [showKeypad, setShowKeypad] = useState(false);
  const [activeClue, setActiveClue] = useState<{ type: string; text: string } | null>(null);
  const [teacherPeek, setTeacherPeek] = useState(false);
  const [revealAnswerInVerdict, setRevealAnswerInVerdict] = useState(false);

  // Refs
  const timerIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const audioMeterRef = useRef<AudioMeterController | null>(null);
  const roundSessionRef = useRef<Set<string>>(new Set());
  const activeWordRef = useRef<WordItem | undefined>(undefined);
  const committedLettersRef = useRef<string[]>([]);

  const currentGrade = selectedClass.split('-')[0];
  const activeWord = roundWords[activeIndex];

  // Helper to filter pool for grade
  const getGradePool = useCallback(() => {
    const gradePool = words.filter(w => String(w.grade) === currentGrade);
    return gradePool.length >= 3 ? gradePool : [...gradePool, ...words.filter(w => w.grade === 'any')];
  }, [words, currentGrade]);

  // Generate a new 3-word round
  const generateNewRound = useCallback(() => {
    const pool = getGradePool();
    if (pool.length < 3) {
      setRoundWords([]);
      return;
    }

    // Shuffle pool with unused words prioritized
    const unused = pool.filter(w => !roundSessionRef.current.has(w.word));
    const listToPick = unused.length >= 3 ? unused : pool;

    let picked: WordItem[] = [];

    if (levelMode === 'mixed') {
      const easy = listToPick.filter(w => w.level === 'Easy');
      const med = listToPick.filter(w => w.level === 'Medium');
      const hard = listToPick.filter(w => w.level === 'Hard');

      if (easy.length && med.length && hard.length) {
        picked = [
          easy[Math.floor(Math.random() * easy.length)],
          med[Math.floor(Math.random() * med.length)],
          hard[Math.floor(Math.random() * hard.length)],
        ];
      }
    } else if (levelMode !== 'any') {
      const filtered = listToPick.filter(w => w.level === levelMode);
      if (filtered.length >= 3) {
        const shuf = [...filtered].sort(() => 0.5 - Math.random());
        picked = shuf.slice(0, 3);
      }
    }

    if (picked.length < 3) {
      const shuf = [...listToPick].sort(() => 0.5 - Math.random());
      picked = shuf.slice(0, 3);
    }

    // Track used in session
    picked.forEach(w => roundSessionRef.current.add(w.word));
    if (roundSessionRef.current.size >= pool.length) {
      roundSessionRef.current = new Set(picked.map(w => w.word));
    }

    setRoundWords(picked);
    setActiveIndex(0);
    setResults([null, null, null]);
    setCommittedLetters([]);
    setInterimLetters([]);
    setIgnoredSpeech([]);
    setPhase('idle');
    setRoundFinished(false);
    setTimeLeft(settings.seconds);
    setActiveClue(null);
  }, [getGradePool, levelMode, settings.seconds]);

  // Initial load
  useEffect(() => {
    generateNewRound();
  }, [generateNewRound]);

  // Reset timer on active index change
  useEffect(() => {
    if (roundWords.length > 0) {
      setTimeLeft(settings.seconds);
      setCommittedLetters([]);
      setInterimLetters([]);
      setIgnoredSpeech([]);
      setPhase('idle');
      setActiveClue(null);
    }
  }, [activeIndex, settings.seconds, roundWords]);

  // Audio meter init
  useEffect(() => {
    const meter = createAudioMeter(level => setAudioLevel(level));
    audioMeterRef.current = meter;
    return () => {
      meter.stop();
    };
  }, []);

  // Sync refs for uninterrupted speech recognition callback
  useEffect(() => {
    activeWordRef.current = activeWord;
  }, [activeWord]);

  useEffect(() => {
    committedLettersRef.current = committedLetters;
  }, [committedLetters]);

  // Web Speech Recognition setup with multi-alternative analysis for long words & online meetings
  const initSpeech = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = settings.lang;
    rec.maxAlternatives = 5; // Check multiple guesses to avoid missing letters

    // Grammar biasing towards alphabet & phonetic words when supported by browser
    const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
    if (SpeechGrammarList) {
      try {
        const speechRecognitionList = new SpeechGrammarList();
        const grammar = '#JSGF V1.0; grammar letters; public <letter> = A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y | Z | alpha | bravo | charlie | delta | echo | foxtrot | golf | hotel | india | juliet | kilo | lima | mike | november | oscar | papa | quebec | romeo | sierra | tango | uniform | victor | whiskey | xray | yankee | zulu ;';
        speechRecognitionList.addFromString(grammar, 1);
        rec.grammars = speechRecognitionList;
      } catch {
        // Grammar list not supported in some WebKit builds
      }
    }

    rec.onresult = (e: any) => {
      if (phase !== 'listening') return;

      const targetLetters = activeWordRef.current ? activeWordRef.current.word.toUpperCase().split('') : undefined;
      const count = committedLettersRef.current.length;

      const { finals, interims, ignored } = extractBestLettersFromResults(
        e.results,
        e.resultIndex,
        targetLetters,
        count
      );

      if (finals.length > 0) {
        setCommittedLetters(prev => {
          const next = [...prev, ...finals];
          playLetterPop();
          return next;
        });
      }
      setInterimLetters(interims);
      if (ignored.length > 0) {
        setIgnoredSpeech(prev => [...prev.slice(-3), ...ignored]);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('Speech error:', e.error);
    };

    rec.onend = () => {
      if (phase === 'listening' && micActive) {
        // Immediate restart so long words with pauses don't cut off
        setTimeout(() => {
          if (phase === 'listening' && micActive) {
            try {
              rec.start();
            } catch {
              // ignore
            }
          }
        }, 25);
      }
    };

    return rec;
  }, [phase, micActive, settings.lang]);

  // Turn Mic or Computer/Teams Audio On/Off
  const toggleMic = async (forcedKind?: 'mic' | 'display') => {
    const kind = forcedKind || audioSource;
    if (micActive && !forcedKind) {
      audioMeterRef.current?.stop();
      try {
        recognitionRef.current?.abort();
      } catch {}
      setMicActive(false);
    } else {
      audioMeterRef.current?.stop();
      const ok = await audioMeterRef.current?.start({ kind });
      if (ok) {
        audioMeterRef.current?.setGain(gainLevel);
        setMicActive(true);
        if (forcedKind) setAudioSource(forcedKind);
        if (phase === 'listening') {
          startSpeechListening();
        }
      }
    }
  };

  const handleGainChange = (newGain: number) => {
    setGainLevel(newGain);
    audioMeterRef.current?.setGain(newGain);
  };

  const startSpeechListening = () => {
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeech();
      }
      recognitionRef.current?.start();
    } catch {}
  };

  const stopSpeechListening = () => {
    try {
      recognitionRef.current?.abort();
    } catch {}
  };

  // Timer countdown
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setTimerRunning(false);
            stopSpeechListening();
            playTimerTick();
            // Auto check on timeout
            setTimeout(() => handleCheckSpelling(), 400);
            return 0;
          }
          if (prev <= 4) {
            playTimerTick();
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning]);

  // Speech Pronunciation of current word
  const handlePronounce = async () => {
    if (!activeWord) return;
    setPhase('speaking');
    stopSpeechListening();
    await speakText(activeWord.word, {
      lang: settings.lang,
      voiceURI: settings.voice,
      rate: 0.8,
    });
    setPhase('ready');
  };

  // Provide Clue (Words are hidden on screen!)
  const handleGiveClue = async (type: 'def' | 'sentence' | 'part' | 'origin') => {
    if (!activeWord) return;
    let spokenText = '';
    let displayText = '';

    if (type === 'def') {
      spokenText = activeWord.def;
      displayText = activeWord.def;
    }
    if (type === 'sentence') {
      spokenText = activeWord.sentence;
      // Mask the target word so contestants reading the screen cannot see the spelling!
      const escaped = activeWord.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      displayText = activeWord.sentence.replace(regex, '_______');
    }
    if (type === 'part') {
      spokenText = `Part of speech: ${activeWord.partOfSpeech || 'noun'}`;
      displayText = activeWord.partOfSpeech || 'noun';
    }
    if (type === 'origin') {
      spokenText = `Language of origin: ${activeWord.origin || 'Latin / Greek'}`;
      displayText = activeWord.origin || 'Latin / Greek';
    }

    setActiveClue({ type, text: displayText });
    await speakText(spokenText, {
      lang: settings.lang,
      voiceURI: settings.voice,
      rate: 0.88,
    });
  };

  // Start Spelling
  const handleStartSpelling = () => {
    if (!activeWord || phase === 'listening') return;
    setPhase('listening');
    setCommittedLetters([]);
    setInterimLetters([]);
    setWordStartTime(Date.now());
    setTimeLeft(settings.seconds);
    setTimerRunning(true);

    if (micActive) {
      startSpeechListening();
    }
  };

  // Check Spelling
  const handleCheckSpelling = () => {
    if (!activeWord) return;
    setTimerRunning(false);
    stopSpeechListening();

    // Commit any interim letters
    const finalSpelled = [...committedLetters, ...interimLetters];
    setCommittedLetters(finalSpelled);
    setInterimLetters([]);
    setPhase('checked');
  };

  // Adjudicate (Pass or Miss)
  const handleAdjudicate = (pass: boolean) => {
    if (!activeWord || phase !== 'checked') return;

    const timeSpent = Math.max(1, Math.min(settings.seconds, Math.round((Date.now() - wordStartTime) / 1000)));
    const spelledString = committedLetters.join('') || '—';

    const newResult: StudentResult = {
      word: activeWord.word,
      spelled: spelledString,
      pass,
      time: timeSpent,
      level: activeWord.level,
    };

    const updated = [...results];
    updated[activeIndex] = newResult;
    setResults(updated);
    setPhase('marked');

    if (pass) {
      playChime();
    } else {
      playBuzzer();
    }
  };

  // Next Word or Finish Round
  const handleNextWord = () => {
    if (activeIndex < 2) {
      setActiveIndex(prev => prev + 1);
    } else {
      // Round Complete
      setRoundFinished(true);
      const score = results.filter(r => r?.pass).length;
      if (score === 3) {
        playFanfare();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    }
  };

  // Try Again: resets letters and timer for current word so student can retry
  const handleTryAgainCurrentWord = () => {
    if (!activeWord) return;
    setTimerRunning(false);
    stopSpeechListening();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCommittedLetters([]);
    setInterimLetters([]);
    setIgnoredSpeech([]);
    setTimeLeft(settings.seconds);
    setPhase('idle');
    setRevealAnswerInVerdict(false);
    const updated = [...results];
    updated[activeIndex] = null;
    setResults(updated);
    playLetterPop();
  };

  // Try Round Again: re-runs current 3 words from start
  const handleRetryRound = () => {
    setActiveIndex(0);
    setResults([null, null, null]);
    setCommittedLetters([]);
    setInterimLetters([]);
    setIgnoredSpeech([]);
    setPhase('idle');
    setRoundFinished(false);
    setRevealAnswerInVerdict(false);
    setTimeLeft(settings.seconds);
    setActiveClue(null);
    playLetterPop();
  };

  // Save Round to Leaderboard
  const handleSaveAndNext = () => {
    const finalScore = results.filter(r => r?.pass).length;
    const totalTime = results.reduce((acc, r) => acc + (r?.time || settings.seconds), 0);

    const record: LeaderboardRecord = {
      id: Date.now(),
      name: studentName.trim() || 'Student',
      classSec: selectedClass,
      score: finalScore,
      totalWords: 3,
      time: totalTime,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      results: results.filter(Boolean) as StudentResult[],
    };

    onSaveRecord(record);
    setStudentName('');
    generateNewRound();
  };

  // Letter input helpers
  const handleAddLetter = (letter: string) => {
    if (phase !== 'listening') return;
    setCommittedLetters(prev => [...prev, letter.toUpperCase()]);
    playLetterPop();
  };

  const handleBackspace = () => {
    setCommittedLetters(prev => prev.slice(0, -1));
    if (editingTileIndex !== null && editingTileIndex >= committedLetters.length - 1) {
      setEditingTileIndex(null);
    }
  };

  const handleClearLetters = () => {
    setCommittedLetters([]);
    setInterimLetters([]);
    setEditingTileIndex(null);
  };

  const handleReplaceLetterAtIndex = (index: number, newChar: string) => {
    setCommittedLetters(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        updated[index] = newChar.toUpperCase();
      }
      return updated;
    });
    playLetterPop();
  };

  const handleRemoveLetterAtIndex = (index: number) => {
    setCommittedLetters(prev => prev.filter((_, idx) => idx !== index));
    setEditingTileIndex(null);
    playLetterPop();
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'Escape') {
        if (editingTileIndex !== null) {
          e.preventDefault();
          setEditingTileIndex(null);
          return;
        }
      }

      // If user is editing a specific tile
      if (editingTileIndex !== null) {
        if (/^[a-zA-Z]$/.test(e.key)) {
          e.preventDefault();
          handleReplaceLetterAtIndex(editingTileIndex, e.key);
          if (editingTileIndex + 1 < committedLetters.length) {
            setEditingTileIndex(editingTileIndex + 1);
          } else {
            setEditingTileIndex(null);
          }
          return;
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          handleRemoveLetterAtIndex(editingTileIndex);
          return;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setEditingTileIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
          return;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setEditingTileIndex(prev => (prev !== null && prev < committedLetters.length - 1 ? prev + 1 : prev));
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'idle' || phase === 'ready') {
          handleStartSpelling();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'listening') {
          handleCheckSpelling();
        } else if (phase === 'checked') {
          // default pass
          const target = activeWord?.word.toUpperCase().replace(/[^A-Z]/g, '') || '';
          const current = committedLetters.join('');
          handleAdjudicate(target === current);
        } else if (phase === 'marked') {
          handleNextWord();
        }
      } else if (e.key === '1' || e.key.toLowerCase() === 'c') {
        if (phase === 'checked') handleAdjudicate(true);
      } else if (e.key === '2' || e.key.toLowerCase() === 'w') {
        if (phase === 'checked') handleAdjudicate(false);
      } else if (e.key === 'Backspace' && phase === 'listening') {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key) && phase === 'listening') {
        handleAddLetter(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, committedLetters, activeWord, editingTileIndex]);

  // Visual diff calculation
  const targetLetters = (activeWord?.word || '').toUpperCase().split('');
  const currentSpelled = committedLetters.join('');
  const isMatch = currentSpelled === (activeWord?.word || '').toUpperCase();

  // Circular timer math
  const timerRadius = 32;
  const circumference = 2 * Math.PI * timerRadius;
  const timerFraction = timeLeft / settings.seconds;
  const strokeOffset = circumference - timerFraction * circumference;

  if (roundWords.length < 3) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          No Word Bank for Grade {currentGrade}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Upload words for Grade {currentGrade} in the Words tab to start competition.
        </p>
        <button
          onClick={onNavigateToWords}
          className="px-5 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity"
        >
          Go to Word Bank
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Student & Competition Control Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          {/* Student Name */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Student Name
            </label>
            <input
              type="text"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="e.g. Layla Ahmed"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Class Selector */}
          <div className="w-36">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                generateNewRound();
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              {Object.entries(CLASSES_BY_GRADE).map(([grade, sections]) => (
                <optgroup key={grade} label={`Grade ${grade}`}>
                  {sections.map(sec => (
                    <option key={`${grade}-${sec}`} value={`${grade}-${sec}`}>
                      Grade {grade} - {sec}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Level Mode */}
          <div className="w-48">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Round Difficulty
            </label>
            <select
              value={levelMode}
              onChange={e => {
                setLevelMode(e.target.value as any);
                generateNewRound();
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mixed">1 Easy · 1 Medium · 1 Hard</option>
              <option value="Easy">3 Easy Words</option>
              <option value="Medium">3 Medium Words</option>
              <option value="Hard">3 Hard Words</option>
              <option value="any">Random Any 3</option>
            </select>
          </div>

          {/* New 3 Words Button */}
          <button
            onClick={generateNewRound}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Shuffle className="w-4 h-4" />
            <span>New 3 Words</span>
          </button>
        </div>
      </div>

      {/* 2. Three-Step Progression Bar */}
      <div className="grid grid-cols-3 gap-3">
        {roundWords.map((word, idx) => {
          const res = results[idx];
          const isActive = idx === activeIndex;
          return (
            <button
              key={idx}
              onClick={() => {
                if (!res && !roundFinished) setActiveIndex(idx);
              }}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-500'
                  : res?.pass
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : res && !res.pass
                  ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    res?.pass
                      ? 'bg-emerald-600 text-white'
                      : res && !res.pass
                      ? 'bg-rose-600 text-white'
                      : isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {res?.pass ? <Check className="w-3.5 h-3.5" /> : res && !res.pass ? <X className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    Word {idx + 1}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {res ? `${res.time}s` : word.level}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Main Competition Stage or Round Summary */}
      {!roundFinished ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          
          {/* Left Column: Pronouncer Deck & Timer (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-6 lg:pb-0 lg:pr-6">
            
            {/* Pronouncer Action (Word is completely hidden for Contestants!) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
                <span className="font-semibold uppercase tracking-wider">Official Pronouncer</span>
                <button
                  type="button"
                  onClick={() => setTeacherPeek(!teacherPeek)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title="Toggle secret view for judge only"
                >
                  {teacherPeek ? '🙈 Hide Secret' : '👁️ Judge Peek'}
                </button>
              </div>

              {teacherPeek && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-center text-xs font-mono font-bold text-amber-900 dark:text-amber-200 animate-fadeIn">
                  Judge Private Answer: {activeWord?.word.toUpperCase()}
                </div>
              )}

              <button
                onClick={handlePronounce}
                className="w-full py-4 px-5 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 shadow-md hover:opacity-95 transition-all active:scale-[0.98]"
                style={{ backgroundColor: settings.brand }}
              >
                <Volume2 className="w-6 h-6 shrink-0" />
                <div className="flex flex-col items-center">
                  <span>{phase === 'speaking' ? 'Pronouncing Word...' : '🔊 Pronounce Word'}</span>
                  <span className="text-xs font-normal opacity-80">
                    Word {activeIndex + 1} of 3 · Click to hear or repeat
                  </span>
                </div>
              </button>

              <button
                onClick={handleStartSpelling}
                disabled={phase === 'listening' || phase === 'checked'}
                className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all ${
                  phase === 'listening'
                    ? 'bg-amber-600 cursor-default opacity-90'
                    : phase === 'ready'
                    ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse-glow'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                } disabled:opacity-50`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{phase === 'listening' ? 'Timer Running...' : '▶ Start Timer (Space)'}</span>
              </button>
            </div>

            {/* Official Spelling Bee Clues */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Official Clues & Inquiries
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleGiveClue('def')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Book className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">Definition</span>
                </button>
                <button
                  onClick={() => handleGiveClue('sentence')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">Sentence</span>
                </button>
                <button
                  onClick={() => handleGiveClue('part')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Hash className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Part of Speech</span>
                </button>
                <button
                  onClick={() => handleGiveClue('origin')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate">Origin / Root</span>
                </button>
              </div>

              {/* Active Clue Callout */}
              {activeClue && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 animate-fadeIn">
                  <div className="font-semibold text-slate-900 dark:text-white capitalize mb-0.5">
                    {activeClue.type === 'def' ? 'Definition:' : activeClue.type === 'sentence' ? 'Example Sentence:' : 'Lexical Note:'}
                  </div>
                  <div>{activeClue.text}</div>
                </div>
              )}
            </div>

            {/* Circular Timer & Status */}
            <div className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r={timerRadius}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={timerRadius}
                    stroke={timeLeft > 5 ? '#15803d' : timeLeft > 2 ? '#d97706' : '#b91c1c'}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-300"
                  />
                </svg>
                <span className="absolute font-mono font-extrabold text-xl text-slate-900 dark:text-white tabular-nums">
                  {timeLeft}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Round Clock
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {phase === 'listening' ? 'Student is spelling...' : phase === 'speaking' ? 'Pronouncing...' : 'Awaiting Start'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Letters, Mic Bar, Verification (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            
            {/* Audio Source, Gain Boost & Mic Controls for Classroom and Online Meetings */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Mic & Meeting Audio Triggers */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMic('mic')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm ${
                      micActive && audioSource === 'mic'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                    title="Listen through computer microphone"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{micActive && audioSource === 'mic' ? 'Mic Active' : 'Microphone'}</span>
                  </button>

                  <button
                    onClick={() => toggleMic('display')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm ${
                      micActive && audioSource === 'display'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                    title="Capture student voice directly from online video meeting tab or window"
                  >
                    <span>🎧 Meeting / Screen Audio</span>
                  </button>
                </div>

                {/* Voice Boost / Sensitivity Slider */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                    Voice Boost: <strong className="text-slate-800 dark:text-slate-200 font-mono">{gainLevel.toFixed(1)}x</strong>
                  </span>
                  <input
                    type="range"
                    min="1.0"
                    max="6.0"
                    step="0.5"
                    value={gainLevel}
                    onChange={e => handleGainChange(parseFloat(e.target.value))}
                    className="w-20 accent-emerald-600 cursor-pointer"
                    title="Boost sensitivity for quiet or distant student voices"
                  />
                </div>

                {/* Toggle On-Screen Keypad */}
                <button
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {showKeypad ? 'Hide Keypad' : 'A-Z Keypad'}
                </button>
              </div>

              {/* Audio Meter Visual Bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-400 font-mono w-20 truncate">
                  {micActive ? (audioSource === 'display' ? 'Meeting Sound' : 'Mic Audio') : 'Audio Off'}
                </span>
                <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      audioLevel > 15 ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-400 w-8 text-right">
                  {Math.round(audioLevel)}%
                </span>
              </div>
            </div>

            {/* Meeting Audio Guidance & Voice Tips Banner */}
            <div className="flex items-start gap-2.5 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-200">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold">Voice Recognition & Online Meeting Tips:</strong> If mic/meeting audio confuses sound-alike letters (e.g. <em>B / D / P / T / E / C</em> or <em>M / N</em>), students can say <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-bold">&quot;B as in boy&quot;</span>, <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-bold">&quot;D as in dog&quot;</span> or NATO phonetics <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-bold">&quot;Bravo&quot;</span> / <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded font-bold">&quot;Delta&quot;</span>. You can also click any letter tile below to swap or fix it in 1 click!
              </div>
            </div>

            {/* Letter Tiles Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Letters Heard / Spelled
                </span>
                <span className="text-xs text-slate-400">
                  {committedLetters.length} letters recorded · Click any tile to edit
                </span>
              </div>

              <div className="min-h-[96px] p-4 bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-wrap items-center gap-2">
                {committedLetters.length === 0 && interimLetters.length === 0 ? (
                  <span className="text-slate-400 dark:text-slate-500 text-sm italic">
                    Press Start, then spell aloud letter by letter (e.g. &quot;A - P - P - L - E&quot;) or type directly...
                  </span>
                ) : (
                  <>
                    {committedLetters.map((char, i) => {
                      const isEditing = editingTileIndex === i;
                      return (
                        <button
                          key={`c-${i}`}
                          type="button"
                          onClick={() => setEditingTileIndex(isEditing ? null : i)}
                          className={`animate-letter-pop relative group inline-flex flex-col items-center justify-center w-11 h-14 bg-white dark:bg-slate-800 border-2 ${
                            isEditing
                              ? 'border-blue-600 dark:border-blue-400 ring-4 ring-blue-500/30 bg-blue-50/70 dark:bg-blue-950/50 scale-105 shadow-md z-10'
                              : 'border-slate-800 dark:border-slate-300 hover:border-blue-500 dark:hover:border-blue-400 hover:scale-105'
                          } text-slate-900 dark:text-white font-extrabold text-2xl rounded-xl shadow-sm transition-all cursor-pointer`}
                          title={`Click to edit or swap letter '${char}'`}
                        >
                          <span>{char}</span>
                          <span className="text-[9px] font-mono text-slate-400 absolute bottom-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            #{i + 1}
                          </span>
                        </button>
                      );
                    })}
                    {interimLetters.map((char, i) => (
                      <span
                        key={`interim-${i}`}
                        className="inline-flex items-center justify-center w-11 h-14 bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-500 text-amber-700 dark:text-amber-300 font-extrabold text-2xl rounded-xl opacity-75"
                      >
                        {char}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {/* Sound-Alike Quick Fix Bar (Active when tile is clicked) */}
              {editingTileIndex !== null && editingTileIndex < committedLetters.length && (
                <div className="p-3 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Editing Letter #{editingTileIndex + 1}: &quot;{committedLetters[editingTileIndex]}&quot;</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 hidden sm:inline">
                        (Type any key on keyboard or click below)
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingTileIndex(null)}
                        className="text-xs font-semibold px-2 py-0.5 bg-amber-200/80 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-lg transition-colors"
                      >
                        Done (Esc)
                      </button>
                    </div>
                  </div>

                  {/* Sound Alike Quick Swap Buttons */}
                  {(() => {
                    const char = committedLetters[editingTileIndex];
                    const soundAlikes = (PHONETIC_CONFUSION_GROUPS[char] || ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z']).filter(
                      c => c !== char && c.length === 1
                    );
                    return (
                      <div className="space-y-1.5">
                        {soundAlikes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                              1-Click Sound-Alike Swap:
                            </span>
                            {soundAlikes.map(alt => (
                              <button
                                key={alt}
                                type="button"
                                onClick={() => handleReplaceLetterAtIndex(editingTileIndex, alt)}
                                className="w-8 h-8 font-extrabold text-sm bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-slate-900 dark:text-white border border-amber-300 dark:border-amber-700 rounded-lg shadow-sm active:scale-95 transition-all"
                                title={`Swap '${char}' with '${alt}'`}
                              >
                                {alt}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Additional Tile Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                          <button
                            type="button"
                            onClick={() => handleRemoveLetterAtIndex(editingTileIndex)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 rounded-lg transition-colors"
                          >
                            ⌫ Delete This Letter
                          </button>
                          <div className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                            Use ← / → arrow keys to move between letters
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {ignoredSpeech.length > 0 && (
                <div className="mt-1 text-xs text-slate-400 truncate">
                  Also picked up: {ignoredSpeech.join(', ')}
                </div>
              )}
            </div>

            {/* On-Screen Touch Keypad */}
            {showKeypad && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-1.5">
                <div className="flex justify-center gap-1">
                  {'QWERTYUIOP'.split('').map(l => (
                    <button
                      key={l}
                      onClick={() => handleAddLetter(l)}
                      className="w-8 h-9 bg-white dark:bg-slate-700 font-bold text-xs rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-800 dark:text-white"
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  {'ASDFGHJKL'.split('').map(l => (
                    <button
                      key={l}
                      onClick={() => handleAddLetter(l)}
                      className="w-8 h-9 bg-white dark:bg-slate-700 font-bold text-xs rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-800 dark:text-white"
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  {'ZXCVBNM'.split('').map(l => (
                    <button
                      key={l}
                      onClick={() => handleAddLetter(l)}
                      className="w-8 h-9 bg-white dark:bg-slate-700 font-bold text-xs rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-800 dark:text-white"
                    >
                      {l}
                    </button>
                  ))}
                  <button
                    onClick={handleBackspace}
                    className="px-2 h-9 bg-rose-100 dark:bg-rose-950/60 font-bold text-xs text-rose-700 dark:text-rose-300 rounded-lg shadow-sm"
                  >
                    ⌫ Back
                  </button>
                </div>
              </div>
            )}

            {/* Quick Letter Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackspace}
                  disabled={committedLetters.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  ⌫ Delete Last
                </button>
                <button
                  onClick={handleClearLetters}
                  disabled={committedLetters.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  Clear All
                </button>
                <button
                  onClick={handleTryAgainCurrentWord}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 rounded-lg transition-colors"
                  title="Reset letters and timer to try this word again"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              </div>

              {/* Check Spelling Button */}
              {phase === 'listening' && (
                <button
                  onClick={handleCheckSpelling}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
                >
                  Check Spelling (Enter)
                </button>
              )}
            </div>

            {/* 4. Adjudication Verdict & Diff (Appears when Checked) */}
            {phase === 'checked' && (
              <div
                className={`p-4 rounded-xl border ${
                  isMatch
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                } space-y-3 animate-fadeIn`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {isMatch ? '✓ Exact Letter Match' : '✕ Spelling Discrepancy Detected'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Judge Adjudication Required
                  </span>
                </div>

                {/* Diff Comparison with Blurred Correct Answer for Try Again Security */}
                <div className="grid grid-cols-2 gap-4 text-sm font-mono p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 font-sans font-semibold">Correct Answer:</span>
                      <button
                        type="button"
                        onClick={() => setRevealAnswerInVerdict(!revealAnswerInVerdict)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        title={revealAnswerInVerdict ? 'Blur the answer so student cannot peek on Try Again' : 'Click to unblur and reveal'}
                      >
                        {revealAnswerInVerdict ? '🙈 Blur' : '👁️ Reveal'}
                      </button>
                    </div>
                    <div
                      onClick={() => setRevealAnswerInVerdict(!revealAnswerInVerdict)}
                      className={`font-extrabold text-lg tracking-wider transition-all cursor-pointer select-none py-0.5 px-1 rounded ${
                        revealAnswerInVerdict
                          ? 'text-slate-900 dark:text-white filter-none'
                          : 'text-slate-900 dark:text-white filter blur-md bg-slate-200/80 dark:bg-slate-800/80'
                      }`}
                      title={revealAnswerInVerdict ? 'Click to blur' : 'Click to unblur'}
                    >
                      {activeWord?.word.toUpperCase()}
                    </div>
                    {!revealAnswerInVerdict && (
                      <span className="text-[10px] text-slate-400 block mt-1 italic font-sans leading-tight">
                        (Blurred so student cannot peek if granted Try Again)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-sans">Student Spelled:</span>
                    <span className="font-extrabold text-lg tracking-wider">
                      {committedLetters.length === 0 ? (
                        <span className="text-slate-400 italic font-sans text-sm">No letters</span>
                      ) : (
                        committedLetters.map((c, i) => (
                          <span
                            key={i}
                            className={
                              c === targetLetters[i]
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400 underline decoration-2'
                            }
                          >
                            {c}
                          </span>
                        ))
                      )}
                    </span>
                  </div>
                </div>

                {/* Adjudication Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => handleAdjudicate(true)}
                    className="flex-1 min-w-[140px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>✓ Correct (Pass) [1]</span>
                  </button>
                  <button
                    onClick={() => handleAdjudicate(false)}
                    className="flex-1 min-w-[140px] py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>✕ Incorrect (Miss) [2]</span>
                  </button>
                  <button
                    onClick={handleTryAgainCurrentWord}
                    className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    title="Allow student to retry spelling this word"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>↺ Try Word Again</span>
                  </button>
                </div>
              </div>
            )}

            {/* Next Word Button when marked */}
            {phase === 'marked' && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleNextWord}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  <span>{activeIndex < 2 ? `Proceed to Word ${activeIndex + 2}` : 'Complete Round & View Score'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Round Summary Card */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Round Concluded
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {studentName.trim() || 'Student'}
              </h2>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Class {selectedClass} · Grade {currentGrade}
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {results.filter(r => r?.pass).length} <span className="text-2xl text-slate-400">/ 3</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                Total time: {results.reduce((a, b) => a + (b?.time || settings.seconds), 0)}s
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Word</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Student Spelled</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {roundWords.map((w, idx) => {
                  const res = results[idx];
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {w.word.toUpperCase()}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{w.level}</td>
                      <td className="py-3 px-4 font-mono font-medium">{res?.spelled || '—'}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{res?.time}s</td>
                      <td className="py-3 px-4 text-right">
                        {res?.pass ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Check className="w-3 h-3" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <X className="w-3 h-3" /> Missed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onOpenCertificate(
                  studentName.trim() || 'Student',
                  selectedClass,
                  results.filter(r => r?.pass).length,
                  3
                )}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>Print / View Award Certificate</span>
              </button>

              <button
                onClick={handleRetryRound}
                className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-sm font-bold rounded-xl transition-colors"
                title="Restart this round with the same 3 words"
              >
                <RotateCcw className="w-4 h-4" />
                <span>↺ Try Round Again</span>
              </button>
            </div>

            <button
              onClick={handleSaveAndNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
            >
              <span>Record to Leaderboard & Next Student</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
