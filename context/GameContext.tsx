import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { GameState, GameStatus, Player, Question } from '../types';
import { network } from '../services/networkService';

// --- Actions ---
type Action =
  | { type: 'SET_PIN'; payload: string }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'PLAYER_JOINED'; payload: { id: string; name: string; avatar: string } }
  | { type: 'START_GAME' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'SUBMIT_ANSWER'; payload: { playerId: string; answerIndex: number; timeTaken: number } }
  | { type: 'END_QUESTION_TIMER' }
  | { type: 'TICK_TIMER' }
  | { type: 'TOGGLE_TIMER' }
  | { type: 'SYNC_STATE'; payload: GameState };

// --- Initial State ---
const initialState: GameState = {
  pin: '',
  status: GameStatus.IDLE,
  hostId: 'host',
  players: [],
  questions: [],
  currentQuestionIndex: 0,
  timeRemaining: 0,
  answersReceived: {},
  isTimerPaused: false,
};

// --- Reducer ---
const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SET_PIN':
      return { ...state, pin: action.payload, status: GameStatus.LOBBY };

    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };

    case 'PLAYER_JOINED':
      if (state.players.some(p => p.id === action.payload.id)) return state;
      return {
        ...state,
        players: [...state.players, { id: action.payload.id, name: action.payload.name, avatar: action.payload.avatar, score: 0, streak: 0 }]
      };

    case 'START_GAME':
      return {
        ...state,
        status: GameStatus.PLAYING,
        currentQuestionIndex: 0,
        timeRemaining: state.questions[0]?.timeLimit || 30,
        answersReceived: {},
        isTimerPaused: false,
      };

    case 'NEXT_QUESTION': {
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        return { ...state, status: GameStatus.FINAL_PODIUM };
      }
      return {
        ...state,
        status: GameStatus.PLAYING,
        currentQuestionIndex: nextIndex,
        timeRemaining: state.questions[nextIndex].timeLimit || 30,
        answersReceived: {},
        isTimerPaused: false,
      };
    }

    case 'SUBMIT_ANSWER': {
      // Only host logic processes this fully for scoring, but state sync handles clients
      const { playerId, answerIndex, timeTaken } = action.payload;
      if (state.status !== GameStatus.PLAYING) return state;

      const currentQ = state.questions[state.currentQuestionIndex];
      const isCorrect = currentQ.correctIndex === answerIndex;

      // Calculate score based on speed (Kahoot style formula)
      // Base 1000 pts * (1 - (timeTaken / timeLimit) / 2)
      // Simple version:
      const points = isCorrect ? Math.round(1000 * (1 - (timeTaken / (currentQ.timeLimit || 30)) / 2)) : 0;

      const updatedPlayers = state.players.map(p => {
        if (p.id === playerId) {
          return {
            ...p,
            score: p.score + points,
            streak: isCorrect ? p.streak + 1 : 0
          };
        }
        return p;
      });

      const newAnswers = { ...state.answersReceived, [playerId]: answerIndex };
      
      // Check if everyone answered
      const allAnswered = updatedPlayers.length > 0 && Object.keys(newAnswers).length === updatedPlayers.length;
      
      const newState = {
        ...state,
        players: updatedPlayers,
        answersReceived: newAnswers,
      };

      if (allAnswered) {
         return {
             ...newState,
             status: GameStatus.QUESTION_RESULT
         }
      }

      return newState;
    }

    case 'END_QUESTION_TIMER':
      return { ...state, status: GameStatus.QUESTION_RESULT };

    case 'TICK_TIMER':
      if (state.isTimerPaused) return state;
      return { ...state, timeRemaining: Math.max(0, state.timeRemaining - 1) };

    case 'TOGGLE_TIMER':
      return { ...state, isTimerPaused: !state.isTimerPaused };

    case 'SYNC_STATE':
      return action.payload; // Full replacement from host

    default:
      return state;
  }
};

// --- Context ---
interface GameContextProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  isHost: boolean;
  setIsHost: (val: boolean) => void;
  broadcastState: () => void;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [isHost, setIsHost] = React.useState(false);

  // Broadcast state changes if Host
  const broadcastState = () => {
    if (isHost && state.pin) {
      network.send('STATE_UPDATE', state);
    }
  };

  // Effect to broadcast state whenever relevant parts change (if Host)
  useEffect(() => {
    if (isHost && state.pin) {
      broadcastState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentQuestionIndex, state.players, state.timeRemaining, state.answersReceived]);

  return (
    <GameContext.Provider value={{ state, dispatch, isHost, setIsHost, broadcastState }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};
