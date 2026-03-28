export enum GameStatus {
  IDLE = 'IDLE',
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  QUESTION_RESULT = 'QUESTION_RESULT',
  FINAL_PODIUM = 'FINAL_PODIUM',
}

export interface Question {
  question: string;
  answers: string[];
  correctIndex: number;
  timeLimit: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswerTime?: number;
}

export interface GameState {
  pin: string;
  status: GameStatus;
  hostId: string;
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  timeRemaining: number;
  answersReceived: Record<string, number>; // playerId -> answerIndex
  isTimerPaused?: boolean;
}

export interface QuizConfig {
  topic: string;
  gradeLevel: '9-12 Grubu' | '13-15 Grubu';
  sourceText?: string;
  fileData?: string; // Base64 encoded data
  mimeType?: string;
  count: number;
}
