import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Users, Play, ShieldAlert, Award, Copy, Check, Volume2, ArrowRight,
  RotateCcw, Sparkles, AlertTriangle, Eye, EyeOff, Trophy, Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TournamentRoomState, AppSettings, WordItem } from '../types';
import { playChime, playBuzzer, playFanfare, speakText } from '../utils/audio';

interface TournamentHostProps {
  settings: AppSettings;
  words: WordItem[];
  onOpenCertificate: (name: string, classSec: string, score: number, total: number) => void;
  onExit: () => void;
}

export const TournamentHost: React.FC<TournamentHostProps> = ({
  settings,
  words,
  onOpenCertificate,
  onExit,
}) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<TournamentRoomState | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [teacherPeek, setTeacherPeek] = useState(false);

  // Setup options
  const [hostName, setHostName] = useState('Teacher / Adjudicator');
  const [selectedGrade, setSelectedGrade] = useState('4');
  const [totalWords, setTotalWords] = useState(5);
  const [secondsPerWord, setSecondsPerWord] = useState(25);
  const [connError, setConnError] = useState('');

  const pingIntervalRef = useRef<any>(null);

  // Connect to WebSocket and create room
  const handleCreateRoom = () => {
    setConnError('');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'host:create_room',
          options: {
            hostName,
            grade: selectedGrade,
            totalWords,
            secondsPerWord,
            words,
          },
        })
      );

      // Start ping heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
    };

    socket.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'room:created' || msg.type === 'room:state') {
          const state: TournamentRoomState = msg.state;
          setRoomState(state);

          // Generate QR code for the room
          const joinUrl = `${window.location.origin}?join=${state.roomId}`;
          try {
            const dataUrl = await QRCode.toDataURL(joinUrl, {
              width: 320,
              margin: 2,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            setQrCodeDataUrl(dataUrl);
          } catch {}

          if (state.status === 'game_over') {
            playFanfare();
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.5 },
            });
          }
        } else if (msg.type === 'alarm:student_tab_switch') {
          playBuzzer();
        } else if (msg.type === 'alarm:student_camera_warning') {
          playBuzzer();
        }
      } catch {}
    };

    socket.onerror = () => {
      setConnError('Could not connect to tournament game server.');
    };

    socket.onclose = () => {
      clearInterval(pingIntervalRef.current);
    };

    setWs(socket);
  };

  useEffect(() => {
    return () => {
      clearInterval(pingIntervalRef.current);
      if (ws) ws.close();
    };
  }, [ws]);

  const handleStartTournament = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'host:start_game' }));
    }
  };

  const handleNextWord = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'host:next_word' }));
    }
  };

  const handleEndGame = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'host:end_game' }));
    }
  };

  const handleDismissWarning = (studentId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'host:dismiss_warning', studentId }));
    }
  };

  const handleDisqualify = (studentId: string, reason: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'host:disqualify_student',
          studentId,
          reason,
        })
      );
    }
  };

  const handlePronounce = () => {
    if (!roomState?.currentTargetWord) return;
    speakText(roomState.currentTargetWord, {
      lang: settings.lang,
      voiceURI: settings.voice,
      rate: 0.85,
    });
  };

  const copyJoinLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}?join=${roomState.roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 1. Setup Form Screen (Before room creation)
  if (!roomState) {
    return (
      <div className="max-w-xl mx-auto my-6 p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Host Online Spelling Bee Match
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate QR code for students to join with live camera centering & anti-cheating monitoring
            </p>
          </div>
        </div>

        {connError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
            {connError}
          </div>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Host / Teacher Name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Grade
              </label>
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="4">Grade 4 (150 Words)</option>
                <option value="5">Grade 5</option>
                <option value="6">Grade 6</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Word Count
              </label>
              <select
                value={totalWords}
                onChange={e => setTotalWords(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={3}>3 Words</option>
                <option value={5}>5 Words</option>
                <option value={10}>10 Words</option>
                <option value={15}>15 Words</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Seconds / Word
              </label>
              <select
                value={secondsPerWord}
                onChange={e => setSecondsPerWord(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15s (Speed)</option>
                <option value={20}>20s (Standard)</option>
                <option value={25}>25s (Recommended)</option>
                <option value={35}>35s (Extended)</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Match Capacity:</strong> Up to <strong>25 students</strong> can join simultaneously as guests with live camera centering and proctoring alerts.
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onExit}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-sm text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRoom}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Generate Room & QR</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Waiting Lobby (QR Code & Student Roster)
  if (roomState.status === 'lobby') {
    const readyStudents = roomState.participants.filter(p => p.rulesAccepted);
    const canStart = readyStudents.length > 0;
    const activeWarnings = roomState.participants.filter(
      p => !p.disqualified && (p.cameraWarning || !p.cameraActive || p.faceCentered === false || !p.connected)
    );

    return (
      <div className="max-w-5xl mx-auto my-4 space-y-6 animate-fadeIn">
        {/* Active Warning Banner for Proctor */}
        {activeWarnings.length > 0 && (
          <div className="p-4 bg-amber-500/15 border-2 border-amber-500 rounded-2xl space-y-2 animate-fadeIn shadow-lg">
            <div className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>Camera & Proctoring Alerts ({activeWarnings.length} Alert{activeWarnings.length > 1 ? 's' : ''})</span>
            </div>
            <div className="space-y-1.5">
              {activeWarnings.map(w => (
                <div key={w.id} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs gap-3 shadow-sm border border-amber-200 dark:border-amber-700/60 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white">{w.name} ({w.classSec}):</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{w.cameraWarningMessage || (!w.cameraActive ? 'Camera is OFF' : w.faceCentered === false ? 'Face out of camera frame' : 'Connection lost')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismissWarning(w.id)}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleDisqualify(w.id, w.cameraWarningMessage || 'Camera violation')}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                    >
                      Disqualify Student
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anti-Cheating Protocol Alert Banner */}
        <div className="p-4 bg-gradient-to-r from-red-600/90 via-amber-600/90 to-red-600/90 text-white rounded-2xl shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wider uppercase flex items-center gap-2">
                <span>Anti-Cheating Proctoring Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
              </div>
              <div className="text-xs text-red-100">
                Session monitored via live camera centering HUD. Tab-switching and camera drops alert the teacher.
              </div>
            </div>
          </div>
          <div className="font-mono text-xs font-bold bg-black/30 px-3 py-1.5 rounded-xl border border-white/20">
            PROCTOR: {roomState.hostName}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: QR Code & Pin (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                Scan to Join Live Match (Guest)
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                Room PIN: <span className="font-mono text-2xl text-blue-600 dark:text-blue-400 tracking-wider font-black">{roomState.roomId}</span>
              </h3>
            </div>

            {/* QR Code Canvas */}
            <div className="p-3 bg-white rounded-2xl border-4 border-slate-100 dark:border-slate-800 shadow-inner">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Join QR Code"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Direct Join Link & Copy */}
            <div className="w-full space-y-2">
              <button
                onClick={copyJoinLink}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Student Join Link'}</span>
              </button>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                {window.location.origin}?join={roomState.roomId}
              </div>
            </div>

            {/* Start Tournament Button */}
            <button
              onClick={handleStartTournament}
              disabled={!canStart}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Tournament ({readyStudents.length} Ready)</span>
            </button>
          </div>

          {/* Right Column: Live Connected Students Roster (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Connected Students
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                    {roomState.participants.length} / 25 Max
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Guest Join · Camera Centered
                </span>
              </div>

              {/* Students List */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {roomState.participants.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-sm">
                    <p className="font-semibold">Waiting for students to scan QR code...</p>
                    <p className="text-xs mt-1">Students will appear here as soon as they enter their names.</p>
                  </div>
                ) : (
                  roomState.participants.map((p, idx) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 animate-fadeIn transition-colors ${
                        p.cameraWarning || !p.cameraActive || p.faceCentered === false || !p.connected
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{p.name}</span>
                            <span className="text-xs font-normal text-slate-500 font-mono">({p.classSec})</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] mt-0.5">
                            <span className={`flex items-center gap-1 font-semibold ${
                              !p.connected
                                ? 'text-rose-600'
                                : p.cameraActive && p.faceCentered !== false
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}>
                              {!p.connected
                                ? '⚠️ Disconnected'
                                : p.cameraActive && p.faceCentered !== false
                                ? '🟢 Face Centered'
                                : !p.cameraActive
                                ? '❌ Camera OFF'
                                : '⚠️ Face Out of Position'}
                            </span>
                            <span>·</span>
                            <span className={p.rulesAccepted ? 'text-blue-600 font-medium' : 'text-amber-600'}>
                              {p.rulesAccepted ? '✓ Rules Read' : 'Reading Rules...'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.tabSwitchCount > 0 && (
                          <span className="text-xs bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md font-bold">
                            ⚠️ {p.tabSwitchCount} Swaps
                          </span>
                        )}
                        {p.cameraWarning && (
                          <button
                            onClick={() => handleDismissWarning(p.id)}
                            className="text-xs text-slate-500 hover:text-slate-700 p-1.5 rounded-lg transition-colors font-semibold"
                            title="Dismiss warning"
                          >
                            Dismiss
                          </button>
                        )}
                        <button
                          onClick={() => handleDisqualify(p.id, p.cameraWarningMessage || 'Proctor decision')}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-lg transition-colors font-medium"
                          title="Disqualify student"
                        >
                          Disqualify
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Grade {roomState.grade} · {roomState.totalWords} Words · {roomState.secondsPerWord}s per word</span>
              <button
                onClick={onExit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Leave Host Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Playing / Round Recap Stage
  if (roomState.status === 'playing' || roomState.status === 'round_recap') {
    const isRecap = roomState.status === 'round_recap';
    const activeWordIndex = roomState.wordIndex;
    const clue = roomState.currentWordClue;
    const activeWarnings = roomState.participants.filter(
      p => !p.disqualified && (p.cameraWarning || !p.cameraActive || p.faceCentered === false || !p.connected)
    );

    return (
      <div className="max-w-6xl mx-auto my-4 space-y-6 animate-fadeIn">
        {/* Active Warning Alert Banner during Match */}
        {activeWarnings.length > 0 && (
          <div className="p-4 bg-amber-500/15 border-2 border-amber-500 rounded-2xl space-y-2 animate-fadeIn shadow-lg">
            <div className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>Camera & Proctoring Alerts ({activeWarnings.length} Alert{activeWarnings.length > 1 ? 's' : ''})</span>
            </div>
            <div className="space-y-1.5">
              {activeWarnings.map(w => (
                <div key={w.id} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs gap-3 shadow-sm border border-amber-200 dark:border-amber-700/60 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white">{w.name} ({w.classSec}):</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{w.cameraWarningMessage || (!w.cameraActive ? 'Camera is OFF' : w.faceCentered === false ? 'Face out of camera frame' : 'Connection lost')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismissWarning(w.id)}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleDisqualify(w.id, w.cameraWarningMessage || 'Camera violation')}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                    >
                      Disqualify Student
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Match Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl">
              Word {activeWordIndex + 1} of {roomState.totalWords}
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white text-base">
              Room {roomState.roomId}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Grade {roomState.grade} · {clue?.level || 'Standard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Round Timer Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{isRecap ? 'Round Ended' : `${roomState.roundTimeRemaining}s`}</span>
            </div>

            {isRecap ? (
              <button
                onClick={handleNextWord}
                className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <span>{activeWordIndex + 1 < roomState.totalWords ? 'Next Word' : 'See Grand Winner'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handlePronounce}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                title="Pronounce word on audio"
              >
                <Volume2 className="w-4 h-4" />
                <span>🔊 Pronounce Aloud</span>
              </button>
            )}

            <button
              onClick={handleEndGame}
              className="py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
            >
              End Game
            </button>
          </div>
        </div>

        {/* Word Info Deck */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Pronouncer Clues</span>
            <button
              onClick={() => setTeacherPeek(!teacherPeek)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
            >
              {teacherPeek ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{teacherPeek ? 'Hide Secret Answer' : 'Judge Peek'}</span>
            </button>
          </div>

          {(teacherPeek || isRecap) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-center font-mono font-black text-xl text-amber-900 dark:text-amber-200 animate-fadeIn">
              Target Word: {roomState.currentTargetWord?.toUpperCase()}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-500 block mb-0.5">Definition:</span>
              <p className="text-slate-800 dark:text-slate-200">{clue?.def || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-500 block mb-0.5">Example Sentence:</span>
              <p className="text-slate-800 dark:text-slate-200 italic">{clue?.sentence || '—'}</p>
            </div>
          </div>
        </div>

        {/* Real-Time Student Answers Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Live Student Responses ({roomState.participants.length})
              </h3>
              <span className="text-xs text-slate-400">
                {roomState.participants.filter(p => p.currentAnswerSubmitted).length} of {roomState.participants.length} submitted
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Proctor can review student cameras & manually disqualify if needed
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roomState.participants.map(p => {
              const currentAns = p.answers.find(a => a.wordIndex === activeWordIndex);
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    p.disqualified
                      ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                      : p.cameraWarning || !p.cameraActive || p.faceCentered === false || !p.connected
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                      : currentAns
                      ? currentAns.correct
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                      : p.currentAnswerSubmitted
                      ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {p.name} <span className="text-xs font-normal text-slate-400">({p.classSec})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold ${
                        !p.connected
                          ? 'text-rose-600'
                          : p.cameraActive && p.faceCentered !== false
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}>
                        {!p.connected
                          ? '⚠️ Disconnected'
                          : p.cameraActive && p.faceCentered !== false
                          ? '🟢 Centered'
                          : !p.cameraActive
                          ? '❌ Cam OFF'
                          : '⚠️ Face Off-Center'}
                      </span>
                    </div>
                  </div>

                  {/* Status / Spelled Word */}
                  <div className="min-h-[44px] flex flex-col justify-center">
                    {p.disqualified ? (
                      <span className="text-xs font-bold text-rose-600">
                        🚫 Disqualified ({p.disqualifiedReason || 'Violation'})
                      </span>
                    ) : isRecap && currentAns ? (
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Spelled: &quot;{currentAns.spelled}&quot;
                        </span>
                        <span className={`font-bold ${currentAns.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {currentAns.correct ? '✓ Correct' : '✕ Miss'} ({currentAns.timeSeconds}s)
                        </span>
                      </div>
                    ) : p.currentAnswerSubmitted ? (
                      <span className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Answer Submitted</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Thinking / Spelling...
                      </span>
                    )}
                  </div>

                  {/* Score & Teacher Actions */}
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Score: {p.score} / {activeWordIndex + 1}
                    </span>
                    {!p.disqualified && (
                      <div className="flex items-center gap-2">
                        {p.cameraWarning && (
                          <button
                            onClick={() => handleDismissWarning(p.id)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                          >
                            Dismiss
                          </button>
                        )}
                        <button
                          onClick={() => handleDisqualify(p.id, p.cameraWarningMessage || 'Proctor decision')}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline"
                        >
                          Disqualify
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 4. Game Over: Grand Winner Declaration & Final Standings
  const sortedParticipants = [...roomState.participants].sort((a, b) => {
    if (a.disqualified && !b.disqualified) return 1;
    if (!a.disqualified && b.disqualified) return -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTime - b.totalTime;
  });

  const grandWinner = sortedParticipants.find(p => !p.disqualified && p.score > 0);

  return (
    <div className="max-w-4xl mx-auto my-6 space-y-6 animate-fadeIn">
      {/* Grand Winner Showcase Banner */}
      <div className="bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-slate-950 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/30 backdrop-blur-md rounded-3xl shadow-inner mb-2 animate-bounce">
          <Trophy className="w-12 h-12 text-slate-950" />
        </div>

        <div>
          <span className="text-xs font-black uppercase tracking-widest bg-black/15 px-3 py-1 rounded-full">
            Tournament Champion Declared
          </span>
          <h1 className="text-3xl sm:text-4xl font-black mt-2">
            {grandWinner ? grandWinner.name : 'No Winner'}
          </h1>
          <p className="text-sm font-semibold opacity-90 mt-1">
            {grandWinner ? `Grade ${roomState.grade} · Class ${grandWinner.classSec}` : 'All participants were disqualified or had zero score.'}
          </p>
        </div>

        {grandWinner && (
          <div className="flex items-center justify-center gap-6 pt-2 font-mono text-sm font-black">
            <div className="bg-black/10 px-4 py-2 rounded-xl">
              {grandWinner.score} / {roomState.totalWords} Words Correct
            </div>
            <div className="bg-black/10 px-4 py-2 rounded-xl">
              {grandWinner.totalTime}s Total Time
            </div>
          </div>
        )}

        {grandWinner && (
          <div className="pt-4">
            <button
              onClick={() => onOpenCertificate(grandWinner.name, grandWinner.classSec, grandWinner.score, roomState.totalWords)}
              className="py-3 px-6 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-sm rounded-2xl shadow-xl transition-all active:scale-[0.98] inline-flex items-center gap-2"
            >
              <Award className="w-5 h-5 text-amber-400" />
              <span>Print Official Champion Certificate</span>
            </button>
          </div>
        )}
      </div>

      {/* Complete Final Standings Leaderboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            Final Tournament Standings
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Room PIN: {roomState.roomId}
          </span>
        </div>

        <div className="space-y-2">
          {sortedParticipants.map((p, idx) => (
            <div
              key={p.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                idx === 0 && !p.disqualified && p.score > 0
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                  : p.disqualified
                  ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    idx === 0 && !p.disqualified && p.score > 0
                      ? 'bg-amber-500 text-slate-950'
                      : idx === 1 && !p.disqualified
                      ? 'bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white'
                      : idx === 2 && !p.disqualified
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {p.disqualified ? '✕' : idx + 1}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {p.name} <span className="text-xs font-normal text-slate-400">({p.classSec})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.disqualified ? (
                      <span className="text-rose-600 font-semibold">Disqualified: {p.disqualifiedReason}</span>
                    ) : (
                      <span>Accuracy: {Math.round((p.score / roomState.totalWords) * 100)}% · Speed: {p.totalTime}s</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-extrabold text-base text-slate-900 dark:text-white font-mono">
                    {p.score} / {roomState.totalWords}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {p.totalTime}s
                  </div>
                </div>

                {!p.disqualified && (
                  <button
                    onClick={() => onOpenCertificate(p.name, p.classSec, p.score, roomState.totalWords)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Generate Certificate"
                  >
                    <Award className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 flex justify-center">
          <button
            onClick={onExit}
            className="py-3 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
          >
            ← Return to Tournament Hub
          </button>
        </div>
      </div>
    </div>
  );
};
