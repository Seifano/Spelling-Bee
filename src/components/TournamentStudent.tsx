import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert, Camera, Video, Volume2, Mic, Check, AlertTriangle,
  ArrowRight, KeyRound, Trophy, Clock, Lock, Sparkles, Award, Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TournamentRoomState, AppSettings } from '../types';
import { playChime, playBuzzer, playLetterPop, playFanfare, playPositionAlarm, speakText } from '../utils/audio';
import { extractBestLettersFromResults, createAudioMeter, AudioMeterController } from '../utils/speechRecognition';

interface TournamentStudentProps {
  settings: AppSettings;
  prefilledPin?: string;
  onExit: () => void;
  onOpenCertificate: (name: string, classSec: string, score: number, total: number) => void;
}

export const TournamentStudent: React.FC<TournamentStudentProps> = ({
  settings,
  prefilledPin = '',
  onExit,
  onOpenCertificate,
}) => {
  // Join Form State
  const [pin, setPin] = useState(prefilledPin.toUpperCase());
  const [name, setName] = useState('');
  const [classSec, setClassSec] = useState('4-A');
  const [joinError, setJoinError] = useState('');

  // WebSocket & Room State
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [myStudentId, setMyStudentId] = useState<string>('');
  const [roomState, setRoomState] = useState<TournamentRoomState | null>(null);

  // Camera & Face Centering State
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraVerified, setCameraVerified] = useState(false);
  const [faceCentered, setFaceCentered] = useState(true);
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAlarmSoundTimeRef = useRef<number>(0);

  // In-Game Spelling State
  const [inputMode, setInputMode] = useState<'type' | 'voice'>('type');
  const [typedLetters, setTypedLetters] = useState('');
  const [voiceLetters, setVoiceLetters] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const recognitionRef = useRef<any>(null);
  const audioMeterRef = useRef<AudioMeterController | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const activeWordStartTimeRef = useRef<number>(Date.now());

  // Auto-connect camera for competition proctoring verification
  const startCameraVerification = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 },
          audio: false,
        });
        setCameraStream(stream);
        setCameraVerified(true);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'student:camera_status', cameraActive: true, faceCentered: true }));
        }
      }
    } catch {
      setCameraVerified(false);
      setJoinError('Camera access required for live video proctoring.');
    }
  };

  // Face Centering & Position Analysis Engine
  const analyzeFacePosition = useCallback(() => {
    if (!videoPreviewRef.current || !canvasRef.current || !cameraStream) return;
    const video = videoPreviewRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 160;
    canvas.height = 120;
    try {
      ctx.drawImage(video, 0, 0, 160, 120);
      const frame = ctx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      let centerSkinCount = 0;
      let totalCenterCount = 0;
      let borderSkinCount = 0;
      let totalBorderCount = 0;

      // Sample pixels
      for (let y = 0; y < 120; y += 3) {
        for (let x = 0; x < 160; x += 3) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Human skin tone / warm contrast check
          const isSkin =
            r > 45 &&
            g > 28 &&
            b > 15 &&
            r > g &&
            g >= b &&
            r - b >= 12 &&
            r - g >= 4;

          const inCenter = x >= 35 && x <= 125 && y >= 15 && y <= 105;
          if (inCenter) {
            totalCenterCount++;
            if (isSkin) centerSkinCount++;
          } else {
            totalBorderCount++;
            if (isSkin) borderSkinCount++;
          }
        }
      }

      const centerRatio = centerSkinCount / (totalCenterCount || 1);
      const borderRatio = borderSkinCount / (totalBorderCount || 1);

      // Student is centered if there's face presence in the center region
      const isCentered = centerRatio > 0.08 && centerRatio >= borderRatio * 0.75;

      setFaceCentered(prev => {
        if (prev !== isCentered) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'student:camera_status',
                cameraActive: true,
                faceCentered: isCentered,
              })
            );
          }
        }
        return isCentered;
      });

      if (!isCentered) {
        const now = Date.now();
        if (now - lastAlarmSoundTimeRef.current > 3000) {
          playPositionAlarm();
          lastAlarmSoundTimeRef.current = now;
        }
      }
    } catch {}
  }, [cameraStream, ws]);

  // Periodic Face Tracking Loop (Runs every 400ms when camera is verified)
  useEffect(() => {
    if (!cameraVerified || !cameraStream) return;
    const interval = setInterval(() => {
      analyzeFacePosition();
    }, 400);

    return () => clearInterval(interval);
  }, [cameraVerified, cameraStream, analyzeFacePosition]);

  // Connect to WebSocket and join room
  const handleJoinRoom = () => {
    if (!name.trim()) {
      setJoinError('Please enter your full name.');
      return;
    }
    if (!pin.trim()) {
      setJoinError('Please enter the 6-character room PIN.');
      return;
    }

    setJoinError('');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'student:join_room',
          roomId: pin.trim().toUpperCase(),
          name: name.trim(),
          classSec,
          cameraActive: cameraVerified,
        })
      );

      // Start ping heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'room:error') {
          setJoinError(msg.message);
          socket.close();
        } else if (msg.type === 'room:joined') {
          setMyStudentId(msg.studentId);
          setRoomState(msg.state);
          startCameraVerification();
        } else if (msg.type === 'room:state') {
          const prevState = roomState;
          const nextState: TournamentRoomState = msg.state;
          setRoomState(nextState);

          // Reset spelling input when a new word begins
          if (prevState && nextState.status === 'playing' && prevState.wordIndex !== nextState.wordIndex) {
            setTypedLetters('');
            setVoiceLetters([]);
            setSubmitted(false);
            activeWordStartTimeRef.current = Date.now();
            playLetterPop();
          }

          if (nextState.status === 'round_recap') {
            const me = nextState.participants.find(p => p.id === myStudentId);
            const myAns = me?.answers.find(a => a.wordIndex === nextState.wordIndex);
            if (myAns?.correct) {
              playChime();
            } else {
              playBuzzer();
            }
          }

          if (nextState.status === 'game_over') {
            const me = nextState.participants.find(p => p.id === myStudentId);
            if (me?.isWinner) {
              playFanfare();
              confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
            }
          }
        } else if (msg.type === 'alarm:anticheat') {
          playBuzzer();
          setTabSwitches(prev => prev + 1);
        } else if (msg.type === 'student:disqualified') {
          playBuzzer();
        }
      } catch {}
    };

    socket.onerror = () => {
      setJoinError('Could not connect to tournament match server.');
    };

    socket.onclose = () => {
      clearInterval(pingIntervalRef.current);
    };

    setWs(socket);
  };

  // Anti-Cheating: Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'student:tab_switch' }));
        playBuzzer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ws]);

  // Clean up streams & audio meter
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      if (audioMeterRef.current) {
        audioMeterRef.current.stop();
      }
      if (ws) ws.close();
      clearInterval(pingIntervalRef.current);
    };
  }, [cameraStream, ws]);

  // Handle Rules Checkbox
  const handleAcceptRules = () => {
    setRulesAgreed(true);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'student:accept_rules' }));
    }
  };

  // Speech Recognition setup for Voice Spelling
  const toggleVoiceInput = async () => {
    if (speechActive) {
      audioMeterRef.current?.stop();
      try {
        recognitionRef.current?.abort();
      } catch {}
      setSpeechActive(false);
    } else {
      const meter = createAudioMeter(lvl => setAudioLevel(lvl));
      audioMeterRef.current = meter;
      await meter.start({ kind: 'mic' });

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = settings.lang || 'en-US';

        rec.onresult = (e: any) => {
          const { finals } = extractBestLettersFromResults(e.results, e.resultIndex);
          if (finals.length > 0) {
            setVoiceLetters(prev => [...prev, ...finals]);
            playLetterPop();
          }
        };

        rec.onerror = () => {};
        rec.onend = () => {
          if (speechActive) {
            try {
              rec.start();
            } catch {}
          }
        };

        try {
          rec.start();
          recognitionRef.current = rec;
          setSpeechActive(true);
        } catch {}
      }
    }
  };

  // Submit Final Spelling
  const handleSubmitSpelling = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || submitted) return;

    const spelled = inputMode === 'type' ? typedLetters : voiceLetters.join('');
    if (!spelled.trim()) return;

    const timeSpent = Math.max(1, Math.round((Date.now() - activeWordStartTimeRef.current) / 1000));

    ws.send(
      JSON.stringify({
        type: 'student:submit_answer',
        spelled: spelled.trim().toUpperCase(),
        method: inputMode,
        timeSpent,
      })
    );

    setSubmitted(true);
    playLetterPop();
    if (speechActive) {
      toggleVoiceInput();
    }
  };

  // Pronounce word (Audio only - spelling is hidden!)
  const handlePronounce = () => {
    if (!roomState?.currentWordClue) return;
    // Word text is fetched by speech synthesis if available or server voice
    // Student can hear definition or sentence
    speakText(roomState.currentWordClue.def, {
      lang: settings.lang,
      rate: 0.88,
    });
  };

  const myData = roomState?.participants.find(p => p.id === myStudentId);
  const isDisqualified = myData?.disqualified;

  // 1. Join Room Screen (Instant Guest Entry)
  if (!roomState) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 rounded-2xl mx-auto flex items-center justify-center text-blue-600 shadow-sm">
            <Camera className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Instant Guest Join · No Passcode Needed</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            Student Match Entrance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adhwa&apos;a Al-Hedaya International Schools · Live Competition
          </p>
        </div>

        {joinError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{joinError}</span>
          </div>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Room PIN (6 Characters)
            </label>
            <input
              type="text"
              value={pin}
              maxLength={6}
              onChange={e => setPin(e.target.value.toUpperCase())}
              placeholder="e.g. BEE408"
              className="w-full px-3.5 py-3 text-center font-mono font-black text-2xl tracking-widest bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Your Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Tariq Al-Otaibi"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Class Section
            </label>
            <select
              value={classSec}
              onChange={e => setClassSec(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="4-A">Grade 4 - Section A</option>
              <option value="4-B">Grade 4 - Section B</option>
              <option value="4-C">Grade 4 - Section C</option>
              <option value="4-D">Grade 4 - Section D</option>
              <option value="4-E">Grade 4 - Section E</option>
            </select>
          </div>

          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 leading-relaxed flex items-start gap-2">
            <Video className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Camera Proctoring Rule:</strong> Your camera must be ON and your face centered within the green guides during the match.
            </div>
          </div>
        </div>

        <button
          onClick={handleJoinRoom}
          disabled={!name.trim() || !pin.trim()}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Join Match Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-center">
          <button
            onClick={onExit}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← Back to Main Menu
          </button>
        </div>
      </div>
    );
  }

  // Disqualified Overlay
  if (isDisqualified) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-800 rounded-3xl text-center space-y-5 animate-bounce">
        <div className="w-20 h-20 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-rose-600">
            Tournament Disqualification
          </span>
          <h2 className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1">
            Session Ended by Proctor
          </h2>
          <p className="text-sm text-rose-700 dark:text-rose-300 mt-2 font-medium">
            Reason: {myData?.disqualifiedReason || 'Violation of camera proctoring or competition regulations.'}
          </p>
        </div>

        <div className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl text-xs text-slate-600 dark:text-slate-400 border border-rose-200 dark:border-rose-900">
          Official Tournament Regulation: Contestants must remain in the session with their camera ON and face centered without switching tabs.
        </div>

        <button
          onClick={onExit}
          className="py-3 px-6 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-md"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  // 2. Waiting Room: Anti-Cheating Protocol, Dramatic Centering HUD & Rules
  if (roomState.status === 'lobby') {
    return (
      <div className="max-w-4xl mx-auto my-6 space-y-6 animate-fadeIn">
        {/* Hidden analysis canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Dramatic Alarm Bar when Face is Out of Position */}
        {!faceCentered && (
          <div className="p-4 bg-red-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-bounce border-2 border-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white animate-ping" />
              </div>
              <div>
                <div className="font-black text-sm uppercase tracking-wider">
                  ⚠️ ALARM: GET BACK TO POSITION!
                </div>
                <div className="text-xs text-red-100">
                  Your face has moved out of the camera centering guides. Return to center position immediately!
                </div>
              </div>
            </div>
            <span className="px-3 py-1 bg-black/40 font-mono text-xs font-bold rounded-lg border border-white/20">
              ALARM ACTIVE
            </span>
          </div>
        )}

        {/* Anti-Cheating Protocol Header Banner */}
        <div className="p-5 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-wider uppercase flex items-center gap-2">
                  <span>Anti-Cheating Proctoring Activated</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </h3>
                <p className="text-xs text-red-100">
                  This online spelling bee competition session is actively monitored. Keep your face centered.
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono bg-black/40 px-3 py-1 rounded-xl">
              MONITOR: ARMED
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs font-semibold">
            <div className="p-2 bg-black/20 rounded-xl flex items-center gap-1.5">
              <span>📹 Camera:</span>
              <span className={cameraVerified ? (faceCentered ? 'text-emerald-300' : 'text-rose-300 font-bold') : 'text-amber-300'}>
                {cameraVerified ? (faceCentered ? 'Centered & Active' : 'Out of Position!') : 'Activating...'}
              </span>
            </div>
            <div className="p-2 bg-black/20 rounded-xl flex items-center gap-1.5">
              <span>🛡️ Tab Lock:</span>
              <span className="text-emerald-300">0 Infractions</span>
            </div>
            <div className="p-2 bg-black/20 rounded-xl flex items-center gap-1.5">
              <span>🎙️ Voice Input:</span>
              <span className="text-emerald-300">Ready</span>
            </div>
          </div>
        </div>

        {/* Live Camera Feed with Biometric Centering HUD & Rules */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          
          {/* Left: Biometric Face-Centering HUD Camera View (6 cols) */}
          <div className="md:col-span-6 flex flex-col items-center space-y-3">
            <div className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Biometric Centering HUD</span>
              <span className={faceCentered ? 'text-emerald-600' : 'text-rose-600 animate-pulse'}>
                {faceCentered ? '● Centered' : '● Alarm: Out of Frame'}
              </span>
            </div>

            {/* Video Viewport with Animated Biometric HUD Target Reticle */}
            <div className={`w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden relative shadow-inner border-4 transition-colors ${
              faceCentered ? 'border-emerald-500/80' : 'border-rose-500 animate-pulse'
            }`}>
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* HUD Holographic Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-3 select-none">
                {/* Corner Brackets */}
                <div className={`absolute top-2 left-2 w-7 h-7 border-t-2 border-l-2 transition-colors ${faceCentered ? 'border-emerald-400' : 'border-rose-500 animate-ping'}`} />
                <div className={`absolute top-2 right-2 w-7 h-7 border-t-2 border-r-2 transition-colors ${faceCentered ? 'border-emerald-400' : 'border-rose-500 animate-ping'}`} />
                <div className={`absolute bottom-2 left-2 w-7 h-7 border-b-2 border-l-2 transition-colors ${faceCentered ? 'border-emerald-400' : 'border-rose-500 animate-ping'}`} />
                <div className={`absolute bottom-2 right-2 w-7 h-7 border-b-2 border-r-2 transition-colors ${faceCentered ? 'border-emerald-400' : 'border-rose-500 animate-ping'}`} />

                {/* Top HUD Badge */}
                <div className="z-10 flex items-center justify-between w-full">
                  <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 shadow backdrop-blur-md ${
                    faceCentered
                      ? 'bg-emerald-950/80 border border-emerald-400 text-emerald-300'
                      : 'bg-rose-950/90 border border-rose-500 text-rose-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${faceCentered ? 'bg-emerald-400 animate-ping' : 'bg-rose-500 animate-ping'}`} />
                    <span>{faceCentered ? 'TARGET: FACE CENTERED' : 'ALARM: GET BACK TO POSITION'}</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-300 bg-black/60 px-1.5 py-0.5 rounded">
                    PROCTOR HUD
                  </span>
                </div>

                {/* Center Green Guide Lines & Oval Head Silhouette */}
                <div className="relative w-40 h-48 my-auto flex items-center justify-center">
                  <div className={`w-full h-full rounded-[48%] border-2 transition-all duration-200 flex items-center justify-center ${
                    faceCentered
                      ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                      : 'border-rose-500 shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse'
                  }`}>
                    {/* Horizontal & Vertical Guide Crosshairs */}
                    <div className={`w-full h-[1px] absolute ${faceCentered ? 'bg-emerald-400/50' : 'bg-rose-500/60'}`} />
                    <div className={`h-full w-[1px] absolute ${faceCentered ? 'bg-emerald-400/50' : 'bg-rose-500/60'}`} />

                    {/* Concentric Reticle Rings */}
                    <div className={`w-12 h-12 rounded-full border border-dashed transition-colors ${faceCentered ? 'border-emerald-400/70' : 'border-rose-400 animate-spin'}`} />
                  </div>

                  {/* Animated Scanner Laser Beam */}
                  <div className={`absolute left-0 right-0 h-[2px] ${
                    faceCentered
                      ? 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#10b981]'
                      : 'bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#ef4444]'
                  } animate-scan`} />
                </div>

                {/* Bottom Center Prompt */}
                <div className={`z-10 px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase backdrop-blur-md ${
                  faceCentered
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-950/90 text-rose-200 border border-rose-500 animate-pulse'
                }`}>
                  {faceCentered ? 'Face Centered & Tracked' : '⚠️ Align Face Inside Green Guides'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Keep your face centered within the oval guide line. If you move away, an audible alarm will sound.
            </p>
          </div>

          {/* Right: Rules Agreement (6 cols) */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-base mb-2">
                Official Online Spelling Bee Rules
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span><strong>Face Must Remain Centered:</strong> Keep your camera ON and stay aligned with the green guidelines. Moving away sounds an instant position alarm.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span><strong>No Tab Switching:</strong> Do not leave or minimize this browser tab. Tab switching alerts the proctor immediately.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span><strong>Spelling Method:</strong> You can choose to <strong>TYPE</strong> on keyboard or <strong>SPEAK</strong> letters aloud into your microphone.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span><strong>Teacher Supervision:</strong> Proctors monitor camera feeds live and may issue warnings or disqualify participants.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAgreed}
                  onChange={handleAcceptRules}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  I have read and agree to all rules. My camera is centered in the green guides.
                </span>
              </label>

              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xs text-slate-500 font-medium">
                {rulesAgreed ? (
                  <span className="text-emerald-600 font-bold flex items-center justify-center gap-1.5 animate-pulse">
                    <Check className="w-4 h-4" />
                    <span>You are Ready! Waiting for Teacher to start the match...</span>
                  </span>
                ) : (
                  <span>Check the box above to mark yourself ready for the match.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Playing / Round Recap Stage (With Floating Centering PiP HUD)
  if (roomState.status === 'playing' || roomState.status === 'round_recap') {
    const isRecap = roomState.status === 'round_recap';
    const clue = roomState.currentWordClue;
    const currentAns = myData?.answers.find(a => a.wordIndex === roomState.wordIndex);

    return (
      <div className="max-w-3xl mx-auto my-4 space-y-5 animate-fadeIn relative">
        {/* Hidden analysis canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Flashing Urgent Alarm Banner when face is out of position during active game */}
        {!faceCentered && (
          <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-bounce border-2 border-white">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 animate-ping shrink-0" />
              <div className="text-xs font-black uppercase">
                ⚠️ ALARM: GET BACK TO POSITION! Keep face inside green guides!
              </div>
            </div>
            <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded font-bold">
              POSITION WARNING
            </span>
          </div>
        )}

        {/* Floating / Compact Picture-in-Picture Camera Centering HUD */}
        <div className="flex items-center justify-between text-xs px-4 py-2.5 bg-slate-900 text-white rounded-2xl shadow-md gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${faceCentered ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-ping'}`} />
            <span className="font-bold">Room {roomState.roomId}</span>
            <span className="text-slate-400">· Active Proctoring</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Camera Mini-Feed with Green Centering Lines */}
            <div className={`relative w-20 h-14 bg-black rounded-lg overflow-hidden border-2 transition-colors shadow-sm ${
              faceCentered ? 'border-emerald-500' : 'border-rose-500 animate-pulse'
            }`} title="Live Centering Camera">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {/* Green Oval Overlay */}
              <div className={`absolute inset-1 rounded-[48%] border transition-colors ${
                faceCentered ? 'border-emerald-400/80' : 'border-rose-400 animate-ping'
              }`} />
            </div>

            <span className={`text-[11px] font-mono font-bold ${faceCentered ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
              {faceCentered ? '🟢 Centered' : '🚨 Out of Position'}
            </span>
          </div>
        </div>

        {/* Word Card (Spelling strictly hidden!) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl">
              Word {roomState.wordIndex + 1} of {roomState.totalWords}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{isRecap ? 'Time Expired' : `${roomState.roundTimeRemaining}s`}</span>
            </div>
          </div>

          {/* Clues Box */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Definition
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {clue?.def || 'Listen to pronouncer for definition.'}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Sentence Clue
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                &quot;{clue?.sentence || 'Listen to sentence in meeting.'}&quot;
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span>Level: <strong>{clue?.level}</strong></span>
              <span>Letters: <strong>{clue?.length || '?'} characters</strong></span>
            </div>
          </div>

          {/* Audio Pronounce Button (Spelling is hidden!) */}
          <button
            onClick={handlePronounce}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
          >
            <Volume2 className="w-4 h-4 text-blue-600" />
            <span>🔊 Hear Clue Aloud</span>
          </button>

          {/* Input Method Switcher */}
          {!submitted && !isRecap && (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
                <button
                  onClick={() => setInputMode('type')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    inputMode === 'type'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ⌨️ Type Spelling
                </button>
                <button
                  onClick={() => setInputMode('voice')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    inputMode === 'voice'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🎙️ Speak Letters
                </button>
              </div>

              {/* Type Mode Input */}
              {inputMode === 'type' ? (
                <div>
                  <input
                    type="text"
                    value={typedLetters}
                    onChange={e => setTypedLetters(e.target.value.toUpperCase())}
                    placeholder="TYPE SPELLING HERE..."
                    autoFocus
                    className="w-full px-4 py-3.5 text-center font-mono font-extrabold text-2xl tracking-widest uppercase bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-2xl text-slate-900 dark:text-white outline-none shadow-inner"
                  />
                </div>
              ) : (
                /* Voice Mode Input */
                <div className="space-y-3 text-center">
                  <button
                    onClick={toggleVoiceInput}
                    className={`py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mx-auto ${
                      speechActive
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    <span>{speechActive ? 'Listening... Speak letters now' : 'Start Microphone'}</span>
                  </button>

                  <div className="min-h-[56px] p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-center gap-1.5">
                    {voiceLetters.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">
                        Say letter names clearly (e.g. &quot;A - P - P - L - E&quot;) or &quot;B as in boy&quot;
                      </span>
                    ) : (
                      voiceLetters.map((l, i) => (
                        <span
                          key={i}
                          className="w-8 h-10 bg-white dark:bg-slate-700 font-extrabold text-lg text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-sm"
                        >
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitSpelling}
                disabled={inputMode === 'type' ? !typedLetters.trim() : voiceLetters.length === 0}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Submit Final Spelling</span>
              </button>
            </div>
          )}

          {/* Submitted State */}
          {submitted && !isRecap && (
            <div className="p-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-base text-blue-900 dark:text-blue-100">
                Spelling Submitted!
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Waiting for the rest of the class to finish or time to expire...
              </p>
            </div>
          )}

          {/* Round Recap Feedback */}
          {isRecap && currentAns && (
            <div
              className={`p-5 rounded-2xl border text-center space-y-3 animate-fadeIn ${
                currentAns.correct
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="font-extrabold text-base">
                {currentAns.correct ? '✓ Correct Spelling!' : '✕ Incorrect Spelling'}
              </div>

              <div className="text-xs space-y-1 font-mono">
                <div>Your Answer: <strong className="text-slate-900 dark:text-white">&quot;{currentAns.spelled}&quot;</strong></div>
                <div>Correct Word: <strong className="text-slate-900 dark:text-white">&quot;{roomState.currentTargetWord?.toUpperCase()}&quot;</strong></div>
              </div>

              <div className="text-xs text-slate-500">
                Teacher will advance to next word shortly.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Game Over: Final Standings & Winner Announcement
  const grandWinner = roomState.participants.find(p => p.isWinner);
  const isMeWinner = myData?.isWinner;

  return (
    <div className="max-w-xl mx-auto my-8 space-y-6 text-center animate-fadeIn">
      <div className={`p-8 sm:p-10 rounded-3xl shadow-2xl space-y-4 ${
        isMeWinner
          ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-slate-950'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
      }`}>
        <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <Trophy className="w-12 h-12 text-amber-500" />
        </div>

        <div>
          <span className="text-xs font-black uppercase tracking-widest opacity-80">
            Tournament Concluded
          </span>
          <h2 className="text-3xl font-black mt-1">
            {isMeWinner ? '🎉 You are the Champion!' : `Champion: ${grandWinner?.name || 'Tournament Completed'}`}
          </h2>
          <p className="text-xs opacity-80 mt-1">
            {grandWinner?.name} won with {grandWinner?.score} / {roomState.totalWords} words correct in {grandWinner?.totalTime}s!
          </p>
        </div>

        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-around font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">YOUR SCORE</span>
            <span className="font-extrabold text-base">{myData?.score || 0} / {roomState.totalWords}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">YOUR RANK</span>
            <span className="font-extrabold text-base">#{myData?.rank || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">TOTAL TIME</span>
            <span className="font-extrabold text-base">{myData?.totalTime || 0}s</span>
          </div>
        </div>

        {isMeWinner && (
          <button
            onClick={() => onOpenCertificate(myData.name, myData.classSec, myData.score, roomState.totalWords)}
            className="py-3 px-6 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-sm rounded-xl shadow-xl transition-all inline-flex items-center gap-2"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>View Champion Certificate</span>
          </button>
        )}
      </div>

      <button
        onClick={onExit}
        className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        ← Return to Main Screen
      </button>
    </div>
  );
};
