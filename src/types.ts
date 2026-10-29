export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface WordItem {
  id?: string;
  word: string;
  def: string;
  sentence: string;
  grade: string; // '4', '5', '6', '7', '8', '9', 'any'
  level: DifficultyLevel;
  partOfSpeech?: string;
  origin?: string; // Etymology / Language of Origin (Latin, Greek, French, etc.)
  phonetic?: string;
}

export interface StudentResult {
  word: string;
  spelled: string;
  pass: boolean;
  time: number; // in seconds
  level?: DifficultyLevel;
}

export interface LeaderboardRecord {
  id: number;
  name: string;
  classSec: string; // e.g. "4-A"
  score: number; // e.g. 3
  totalWords: number; // e.g. 3
  time: number; // total seconds
  timestamp: string;
  results: StudentResult[];
}

export interface AppSettings {
  school: string;
  brand: string;
  accent: string;
  green: string;
  seconds: number;
  sound: boolean;
  gain: number;
  lang: string; // 'en-US' | 'en-GB'
  voice: string;
  theme: 'light' | 'dark';
  wordsPerRound: number; // default 3
  autoSpeak: boolean;
}

export type TournamentStatus = 'lobby' | 'rules' | 'playing' | 'round_recap' | 'game_over';

export interface ParticipantAnswer {
  wordIndex: number;
  spelled: string;
  correct: boolean;
  timeSeconds: number;
  method: 'type' | 'voice';
}

export interface TournamentParticipant {
  id: string;
  name: string;
  classSec: string;
  connected: boolean;
  cameraActive: boolean;
  faceCentered?: boolean;
  cameraWarning?: boolean;
  cameraWarningMessage?: string;
  rulesAccepted: boolean;
  tabSwitchCount: number;
  disqualified: boolean;
  disqualifiedReason?: string;
  score: number; // Number of correct words
  totalTime: number; // Total seconds taken for tiebreak
  answers: ParticipantAnswer[];
  currentAnswerSubmitted?: boolean;
  isWinner?: boolean;
  rank?: number;
}

export interface CurrentWordClue {
  level: DifficultyLevel;
  def: string;
  sentence: string; // Masked with _______
  partOfSpeech?: string;
  origin?: string;
  length: number;
  phonetic?: string;
}

export interface TournamentRoomState {
  roomId: string;
  hostName: string;
  grade: string;
  status: TournamentStatus;
  wordIndex: number;
  totalWords: number;
  secondsPerWord: number;
  roundTimeRemaining: number;
  roundStartedAt?: number;
  currentWordClue?: CurrentWordClue;
  currentTargetWord?: string; // Only host has this during playing; revealed to everyone during round_recap
  participants: TournamentParticipant[];
  winner?: TournamentParticipant | null;
}
