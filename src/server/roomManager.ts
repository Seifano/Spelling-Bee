import { WebSocket } from 'ws';
import { WordItem, TournamentStatus, ParticipantAnswer, TournamentParticipant, TournamentRoomState } from '../types';
import { getInitialWords } from '../data/defaultWords';

interface InternalParticipant {
  id: string;
  name: string;
  classSec: string;
  ws: WebSocket | null;
  connected: boolean;
  cameraActive: boolean;
  faceCentered: boolean;
  cameraWarning: boolean;
  cameraWarningMessage?: string;
  rulesAccepted: boolean;
  tabSwitchCount: number;
  disqualified: boolean;
  disqualifiedReason?: string;
  score: number;
  totalTime: number;
  answers: ParticipantAnswer[];
  currentAnswerSubmitted: boolean;
  isWinner?: boolean;
  rank?: number;
}

interface Room {
  id: string;
  hostWs: WebSocket | null;
  hostName: string;
  grade: string;
  status: TournamentStatus;
  totalWords: number;
  secondsPerWord: number;
  wordIndex: number;
  words: WordItem[];
  roundStartedAt?: number;
  roundTimer?: NodeJS.Timeout | null;
  participants: Map<string, InternalParticipant>;
}

export class TournamentRoomManager {
  private rooms: Map<string, Room> = new Map();
  private wsToStudent: Map<WebSocket, { roomId: string; studentId: string }> = new Map();
  private wsToHost: Map<WebSocket, string> = new Map();

  constructor() {}

  // Generate 6-character room PIN
  private generateRoomId(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  // Create a new room
  public createRoom(
    hostWs: WebSocket,
    options: {
      hostName?: string;
      grade?: string;
      totalWords?: number;
      secondsPerWord?: number;
      words?: WordItem[];
    }
  ): string {
    const roomId = this.generateRoomId();
    const grade = options.grade || '4';
    const totalWords = options.totalWords || 5;
    const secondsPerWord = options.secondsPerWord || 25;

    // Pick words from Grade 4 pool
    const allWords = options.words && options.words.length >= totalWords ? options.words : getInitialWords();
    const gradePool = allWords.filter(w => String(w.grade) === String(grade));
    const pool = gradePool.length >= totalWords ? gradePool : allWords;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const pickedWords = shuffled.slice(0, totalWords);

    const room: Room = {
      id: roomId,
      hostWs,
      hostName: options.hostName || 'Teacher / Proctor',
      grade,
      status: 'lobby',
      totalWords,
      secondsPerWord,
      wordIndex: 0,
      words: pickedWords,
      participants: new Map(),
    };

    this.rooms.set(roomId, room);
    this.wsToHost.set(hostWs, roomId);

    this.send(hostWs, {
      type: 'room:created',
      roomId,
      state: this.getRoomStateForHost(room),
    });

    return roomId;
  }

  // Student Joins Room
  public joinRoom(
    ws: WebSocket,
    roomId: string,
    studentInfo: { name: string; classSec: string; cameraActive?: boolean }
  ) {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      this.send(ws, { type: 'room:error', message: `Room "${roomId}" was not found.` });
      return;
    }

    if (room.status === 'game_over') {
      this.send(ws, { type: 'room:error', message: 'This tournament session has already concluded.' });
      return;
    }

    if (room.participants.size >= 25) {
      this.send(ws, { type: 'room:error', message: 'Room has reached maximum capacity of 25 students.' });
      return;
    }

    const studentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const participant: InternalParticipant = {
      id: studentId,
      name: studentInfo.name.trim() || 'Student',
      classSec: studentInfo.classSec || '4-A',
      ws,
      connected: true,
      cameraActive: !!studentInfo.cameraActive,
      faceCentered: true,
      cameraWarning: !studentInfo.cameraActive,
      cameraWarningMessage: !studentInfo.cameraActive ? 'Camera is turned OFF' : undefined,
      rulesAccepted: false,
      tabSwitchCount: 0,
      disqualified: false,
      score: 0,
      totalTime: 0,
      answers: [],
      currentAnswerSubmitted: false,
    };

    room.participants.set(studentId, participant);
    this.wsToStudent.set(ws, { roomId: room.id, studentId });

    // Send joined confirmation
    this.send(ws, {
      type: 'room:joined',
      studentId,
      state: this.getRoomStateForStudent(room, studentId),
    });

    // Broadcast to room
    this.broadcastRoomState(room);
  }

  // Student accepts rules
  public handleRulesAccepted(ws: WebSocket) {
    const info = this.wsToStudent.get(ws);
    if (!info) return;
    const room = this.rooms.get(info.roomId);
    if (!room) return;
    const p = room.participants.get(info.studentId);
    if (p) {
      p.rulesAccepted = true;
      this.broadcastRoomState(room);
    }
  }

  // Student reports camera and face-centering status
  public handleCameraStatus(ws: WebSocket, cameraActive: boolean, faceCentered: boolean = true) {
    const info = this.wsToStudent.get(ws);
    if (!info) return;
    const room = this.rooms.get(info.roomId);
    if (!room) return;
    const p = room.participants.get(info.studentId);
    if (p) {
      p.cameraActive = cameraActive;
      p.faceCentered = faceCentered;

      if (!cameraActive) {
        p.cameraWarning = true;
        p.cameraWarningMessage = 'Camera is turned OFF';
        if (room.hostWs) {
          this.send(room.hostWs, {
            type: 'alarm:student_camera_warning',
            studentId: p.id,
            studentName: p.name,
            reason: 'Camera is turned OFF',
          });
        }
      } else if (!faceCentered) {
        p.cameraWarning = true;
        p.cameraWarningMessage = 'Face is out of camera position';
        if (room.hostWs) {
          this.send(room.hostWs, {
            type: 'alarm:student_camera_warning',
            studentId: p.id,
            studentName: p.name,
            reason: 'Face moved away from camera position',
          });
        }
      } else {
        // Clear camera warning if camera is on and face is centered
        p.cameraWarning = false;
        p.cameraWarningMessage = undefined;
      }

      this.broadcastRoomState(room);
    }
  }

  // Host dismisses warning for student
  public handleDismissWarning(ws: WebSocket, studentId: string) {
    const roomId = this.wsToHost.get(ws);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    const p = room.participants.get(studentId);
    if (p) {
      p.cameraWarning = false;
      p.cameraWarningMessage = undefined;
      this.broadcastRoomState(room);
    }
  }

  // Student reports tab switch (anti-cheating trigger)
  public handleTabSwitch(ws: WebSocket) {
    const info = this.wsToStudent.get(ws);
    if (!info) return;
    const room = this.rooms.get(info.roomId);
    if (!room) return;
    const p = room.participants.get(info.studentId);
    if (p && !p.disqualified) {
      p.tabSwitchCount += 1;
      // Alert host and student
      this.send(ws, {
        type: 'alarm:anticheat',
        message: 'WARNING: Tab switch detected! Anti-cheating monitoring has flagged this infraction.',
      });
      if (room.hostWs) {
        this.send(room.hostWs, {
          type: 'alarm:student_tab_switch',
          studentId: p.id,
          studentName: p.name,
          count: p.tabSwitchCount,
        });
      }
      this.broadcastRoomState(room);
    }
  }

  // Host starts tournament
  public handleStartTournament(ws: WebSocket) {
    const roomId = this.wsToHost.get(ws);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return;

    room.status = 'playing';
    room.wordIndex = 0;
    this.beginRound(room);
  }

  // Begin active word round
  private beginRound(room: Room) {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    room.roundStartedAt = Date.now();
    // Reset submitted flags for this word
    for (const p of room.participants.values()) {
      p.currentAnswerSubmitted = false;
    }

    this.broadcastRoomState(room);

    // Auto-advance when time expires
    room.roundTimer = setTimeout(() => {
      this.endRound(room);
    }, room.secondsPerWord * 1000 + 500);
  }

  // End active word round
  private endRound(room: Room) {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    const currentWord = room.words[room.wordIndex];
    if (!currentWord) return;

    // For any participant who did not submit, mark unanswered
    for (const p of room.participants.values()) {
      if (!p.disqualified && !p.currentAnswerSubmitted) {
        p.answers.push({
          wordIndex: room.wordIndex,
          spelled: '—',
          correct: false,
          timeSeconds: room.secondsPerWord,
          method: 'type',
        });
        p.totalTime += room.secondsPerWord;
        p.currentAnswerSubmitted = true;
      }
    }

    room.status = 'round_recap';
    this.broadcastRoomState(room);
  }

  // Host moves to Next Word or ends Game
  public handleNextWord(ws: WebSocket) {
    const roomId = this.wsToHost.get(ws);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'round_recap') return;

    if (room.wordIndex + 1 < room.totalWords) {
      room.wordIndex += 1;
      room.status = 'playing';
      this.beginRound(room);
    } else {
      // Game Over: calculate final winner
      this.finalizeGame(room);
    }
  }

  // Host manual End Game
  public handleEndGame(ws: WebSocket) {
    const roomId = this.wsToHost.get(ws);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.finalizeGame(room);
  }

  // Calculate winner and final standings
  private finalizeGame(room: Room) {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    room.status = 'game_over';

    const list = Array.from(room.participants.values());
    // Active students sorted by score desc, then total time asc
    const active = list.filter(p => !p.disqualified);
    const disqualified = list.filter(p => p.disqualified);

    active.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalTime - b.totalTime;
    });

    active.forEach((p, idx) => {
      p.rank = idx + 1;
      p.isWinner = idx === 0 && p.score > 0;
    });

    disqualified.forEach(p => {
      p.rank = 999;
      p.isWinner = false;
    });

    this.broadcastRoomState(room);
  }

  // Student submits answer
  public handleStudentAnswer(
    ws: WebSocket,
    payload: { spelled: string; method: 'type' | 'voice'; timeSpent: number }
  ) {
    const info = this.wsToStudent.get(ws);
    if (!info) return;
    const room = this.rooms.get(info.roomId);
    if (!room || room.status !== 'playing') return;

    const p = room.participants.get(info.studentId);
    if (!p || p.disqualified || p.currentAnswerSubmitted) return;

    const currentWord = room.words[room.wordIndex];
    if (!currentWord) return;

    const cleanTarget = currentWord.word.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const cleanSpelled = (payload.spelled || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    const isCorrect = cleanTarget === cleanSpelled;
    const timeTaken = Math.max(1, Math.min(room.secondsPerWord, Math.round(payload.timeSpent || 1)));

    p.answers.push({
      wordIndex: room.wordIndex,
      spelled: payload.spelled || '—',
      correct: isCorrect,
      timeSeconds: timeTaken,
      method: payload.method || 'type',
    });

    if (isCorrect) {
      p.score += 1;
    }
    p.totalTime += timeTaken;
    p.currentAnswerSubmitted = true;

    // Check if all non-disqualified participants submitted
    const activeStudents = Array.from(room.participants.values()).filter(s => !s.disqualified);
    const allSubmitted = activeStudents.length > 0 && activeStudents.every(s => s.currentAnswerSubmitted);

    if (allSubmitted) {
      this.endRound(room);
    } else {
      this.broadcastRoomState(room);
    }
  }

  // Host disqualifies student
  public handleDisqualify(
    ws: WebSocket,
    payload: { studentId: string; reason: string }
  ) {
    const roomId = this.wsToHost.get(ws);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    const p = room.participants.get(payload.studentId);
    if (p) {
      p.disqualified = true;
      p.disqualifiedReason = payload.reason || 'Disqualified by Tournament Proctor';
      if (p.ws) {
        this.send(p.ws, {
          type: 'student:disqualified',
          reason: p.disqualifiedReason,
        });
      }
      this.broadcastRoomState(room);
    }
  }

  // Handle WebSocket Close
  public handleDisconnect(ws: WebSocket) {
    // 1. Host disconnect
    const hostRoomId = this.wsToHost.get(ws);
    if (hostRoomId) {
      this.wsToHost.delete(ws);
      const room = this.rooms.get(hostRoomId);
      if (room) {
        room.hostWs = null;
      }
    }

    // 2. Student disconnect
    const studentInfo = this.wsToStudent.get(ws);
    if (studentInfo) {
      this.wsToStudent.delete(ws);
      const room = this.rooms.get(studentInfo.roomId);
      if (room) {
        const p = room.participants.get(studentInfo.studentId);
        if (p) {
          p.connected = false;
          p.ws = null;
          p.cameraWarning = true;
          p.cameraWarningMessage = 'Disconnected / connection lost';

          // Notify teacher so they can choose whether to disqualify
          if (room.hostWs) {
            this.send(room.hostWs, {
              type: 'alarm:student_camera_warning',
              studentId: p.id,
              studentName: p.name,
              reason: 'Connection lost / Student left session',
            });
          }

          this.broadcastRoomState(room);
        }
      }
    }
  }

  // Broadcast state to all connected
  private broadcastRoomState(room: Room) {
    // Host gets full state including current target word
    if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
      this.send(room.hostWs, {
        type: 'room:state',
        state: this.getRoomStateForHost(room),
      });
    }

    // Students get state with target word hidden during 'playing'
    for (const p of room.participants.values()) {
      if (p.ws && p.ws.readyState === WebSocket.OPEN) {
        this.send(p.ws, {
          type: 'room:state',
          state: this.getRoomStateForStudent(room, p.id),
        });
      }
    }
  }

  // Room State for Host (has target word)
  private getRoomStateForHost(room: Room): TournamentRoomState {
    const currentWord = room.words[room.wordIndex];
    const elapsed = room.roundStartedAt ? Math.floor((Date.now() - room.roundStartedAt) / 1000) : 0;
    const remaining = Math.max(0, room.secondsPerWord - elapsed);

    const participantsList: TournamentParticipant[] = Array.from(room.participants.values()).map(p => ({
      id: p.id,
      name: p.name,
      classSec: p.classSec,
      connected: p.connected,
      cameraActive: p.cameraActive,
      faceCentered: p.faceCentered,
      cameraWarning: p.cameraWarning,
      cameraWarningMessage: p.cameraWarningMessage,
      rulesAccepted: p.rulesAccepted,
      tabSwitchCount: p.tabSwitchCount,
      disqualified: p.disqualified,
      disqualifiedReason: p.disqualifiedReason,
      score: p.score,
      totalTime: p.totalTime,
      answers: p.answers,
      currentAnswerSubmitted: p.currentAnswerSubmitted,
      isWinner: p.isWinner,
      rank: p.rank,
    }));

    const winner = participantsList.find(p => p.isWinner) || null;

    let clue = undefined;
    if (currentWord) {
      const escaped = currentWord.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      clue = {
        level: currentWord.level,
        def: currentWord.def,
        sentence: currentWord.sentence.replace(regex, '_______'),
        partOfSpeech: currentWord.partOfSpeech,
        origin: currentWord.origin,
        length: currentWord.word.length,
        phonetic: currentWord.phonetic,
      };
    }

    return {
      roomId: room.id,
      hostName: room.hostName,
      grade: room.grade,
      status: room.status,
      wordIndex: room.wordIndex,
      totalWords: room.totalWords,
      secondsPerWord: room.secondsPerWord,
      roundTimeRemaining: remaining,
      roundStartedAt: room.roundStartedAt,
      currentWordClue: clue,
      currentTargetWord: currentWord?.word,
      participants: participantsList,
      winner,
    };
  }

  // Room State for Student (Target word strictly hidden during 'playing'!)
  private getRoomStateForStudent(room: Room, _studentId: string): TournamentRoomState {
    const hostState = this.getRoomStateForHost(room);

    // Hide currentTargetWord unless it's round recap or game over
    if (room.status === 'playing') {
      return {
        ...hostState,
        currentTargetWord: undefined,
      };
    }

    return hostState;
  }

  private send(ws: WebSocket, data: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch {}
    }
  }
}
