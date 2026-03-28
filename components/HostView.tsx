import React, { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GameStatus } from '../types';
import { network } from '../services/networkService';
import CreateGame from './CreateGame';
import { Users, Clock, ArrowRight, Trophy, RotateCcw, Pause, Play } from 'lucide-react';

interface HostViewProps {
  onBack: () => void;
}

const HostView: React.FC<HostViewProps> = ({ onBack }) => {
  const { state, dispatch, setIsHost } = useGame();
  
  // Use a ref to access current state inside the event listener closure
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initial Connection & Broadcast Loop
  useEffect(() => {
    setIsHost(true);
    if (state.pin) {
      // Connect as HOST
      network.connect(state.pin, 'HOST');
      
      // Allow a brief moment for connection, then broadcast the INITIAL state with RETAIN
      // This ensures that any player connecting LATER receives this state immediately.
      const initTimeout = setTimeout(() => {
          console.log("Broadcasting initial Lobby state (Retained)");
          network.send('STATE_UPDATE', stateRef.current, true);
      }, 1000);

      const unsubscribe = network.subscribe((msg) => {
        if (msg.type === 'JOIN_REQUEST') {
          const { id, name, avatar } = msg.payload;
          
          // Check if player already exists
          const exists = stateRef.current.players.some(p => p.id === id);
          if (!exists) {
              dispatch({ type: 'PLAYER_JOINED', payload: { id, name, avatar } });
              
              // RE-BROADCAST state with RETAIN because the state changed (new player)
              // We do this immediately using the derived new state to ensure speed
              const newPlayers = [...stateRef.current.players, { id, name, avatar, score: 0, streak: 0 }];
              const newState = { ...stateRef.current, players: newPlayers };
              
              network.send('STATE_UPDATE', newState, true);
          } else {
              // Even if they exist, re-send state in case they refreshed page
              network.send('STATE_UPDATE', stateRef.current, true);
          }
        }
        
        if (msg.type === 'SUBMIT_ANSWER') {
          const currentState = stateRef.current;
          // Use current state for calculations to ensure accuracy
          const currentQ = currentState.questions[currentState.currentQuestionIndex];
          const timeTaken = currentQ ? ((currentQ.timeLimit || 30) - currentState.timeRemaining) : 0;
          
          dispatch({ 
            type: 'SUBMIT_ANSWER', 
            payload: { 
              ...msg.payload, 
              timeTaken: Math.max(0, timeTaken) 
            } 
          });
        }
      });

      return () => {
        clearTimeout(initTimeout);
        unsubscribe();
        network.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pin, setIsHost]); 
  // We strictly only want this to run on mount or PIN change. 
  // We handle game loop updates separately.

  // Broadcast state on significant changes (Game Loop)
  useEffect(() => {
     if (state.pin && network.isConnected()) {
         // Whenever the React State changes (timer, question index, players), 
         // we push it to the network as the "Truth" (Retained)
         network.send('STATE_UPDATE', state, true);
     }
  }, [state, state.timeRemaining, state.players, state.status, state.answersReceived, state.isTimerPaused]);


  // Game Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state.status === GameStatus.PLAYING && state.timeRemaining > 0 && !state.isTimerPaused) {
      interval = setInterval(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, 1000);
    } else if (state.status === GameStatus.PLAYING && state.timeRemaining === 0) {
      dispatch({ type: 'END_QUESTION_TIMER' });
    }
    return () => clearInterval(interval);
  }, [state.status, state.timeRemaining, state.isTimerPaused, dispatch]);

  if (!state.pin) {
    return <CreateGame onBack={onBack} />;
  }

  // --- LOBBY SCREEN ---
  if (state.status === GameStatus.LOBBY) {
    const joinUrl = `${window.location.origin}/?pin=${state.pin}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;

    return (
      <div className="min-h-screen bg-brand-purple flex flex-col items-center p-8 text-white relative">
        <button onClick={onBack} className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 p-2 rounded text-sm font-bold">Çıkış</button>
        
        <div className="mt-8 mb-12 text-center animate-pop flex flex-col md:flex-row items-center justify-center gap-8">
          <div>
            <p className="text-2xl font-semibold mb-2 opacity-80">Katılım Kodu :</p>
            <div className="text-8xl font-black bg-white text-brand-purple px-12 py-6 rounded-2xl shadow-2xl tracking-widest">
              {state.pin}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-2xl flex flex-col items-center">
            <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 md:w-40 md:h-40" />
            <p className="text-brand-purple font-bold mt-2 text-sm">Okut ve Katıl</p>
          </div>
        </div>

        <div className="flex-1 w-full max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold flex items-center">
              <Users className="mr-2" /> Oyuncular ({state.players.length})
            </h3>
            <button
              onClick={() => dispatch({ type: 'START_GAME' })}
              disabled={state.players.length === 0}
              className={`px-8 py-3 rounded-full font-bold text-xl transition-all ${
                state.players.length > 0
                  ? 'bg-white text-brand-purple hover:scale-105 shadow-lg'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              Başlat
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {state.players.map((p) => (
              <div key={p.id} className="bg-brand-blue/30 backdrop-blur-sm p-4 rounded-xl text-center font-bold text-lg animate-pop flex items-center justify-center gap-2">
                <span className="text-2xl">{p.avatar || '👤'}</span> {p.name}
              </div>
            ))}
            {state.players.length === 0 && (
               <div className="col-span-4 text-center text-white/50 italic py-10">
                 Oyuncular bekleniyor...
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- GAMEPLAY SCREEN ---
  if (state.status === GameStatus.PLAYING) {
    const question = state.questions[state.currentQuestionIndex];
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
           <div className="text-xl font-bold text-gray-600">
             {state.currentQuestionIndex + 1} / {state.questions.length}
           </div>
           <div className="flex items-center text-2xl font-black text-brand-purple">
             <Clock className="mr-2" /> {state.timeRemaining}
           </div>
           <div className="flex items-center gap-4">
             <div className="text-xl font-bold text-gray-600">
               Cevap: {Object.keys(state.answersReceived).length}
             </div>
             <button 
               onClick={() => dispatch({ type: 'TOGGLE_TIMER' })}
               className={`${state.isTimerPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'} text-white px-3 py-1 rounded text-sm font-bold flex items-center`}
             >
               {state.isTimerPaused ? <><Play className="w-4 h-4 mr-1" /> Devam Et</> : <><Pause className="w-4 h-4 mr-1" /> Durdur</>}
             </button>
             <button 
               onClick={() => {
                 if(confirm("Sınavı gerçekten bitirmek istiyor musunuz?")) {
                   dispatch({ type: 'SYNC_STATE', payload: { ...state, status: GameStatus.FINAL_PODIUM } });
                 }
               }}
               className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-bold"
             >
               Bitir
             </button>
             <button 
               onClick={() => dispatch({ type: 'END_QUESTION_TIMER' })}
               className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm font-bold"
             >
               Geç
             </button>
           </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 text-center bg-gray-50 overflow-hidden">
           <h2 className="text-2xl md:text-5xl font-black text-gray-800 max-w-5xl leading-tight break-words w-full">
             {question.question}
           </h2>
        </div>

        {/* Answers Preview (Host shows the text, players only see shapes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 h-auto md:h-64 w-full">
           <div className="bg-quiz-red flex items-center p-4 md:p-6 text-white text-lg md:text-2xl font-bold break-words">
              <span className="bg-white/20 p-2 rounded mr-4 flex-shrink-0">▲</span> 
              <span className="break-words w-full">{question.answers[0]}</span>
           </div>
           <div className="bg-quiz-blue flex items-center p-4 md:p-6 text-white text-lg md:text-2xl font-bold break-words">
              <span className="bg-white/20 p-2 rounded mr-4 flex-shrink-0">◆</span> 
              <span className="break-words w-full">{question.answers[1]}</span>
           </div>
           <div className="bg-quiz-yellow flex items-center p-4 md:p-6 text-white text-lg md:text-2xl font-bold break-words">
              <span className="bg-white/20 p-2 rounded mr-4 flex-shrink-0">●</span> 
              <span className="break-words w-full">{question.answers[2]}</span>
           </div>
           <div className="bg-quiz-green flex items-center p-4 md:p-6 text-white text-lg md:text-2xl font-bold break-words">
              <span className="bg-white/20 p-2 rounded mr-4 flex-shrink-0">■</span> 
              <span className="break-words w-full">{question.answers[3]}</span>
           </div>
        </div>
      </div>
    );
  }

  // --- QUESTION RESULT SCREEN ---
  if (state.status === GameStatus.QUESTION_RESULT) {
    const question = state.questions[state.currentQuestionIndex];
    // Calculate stats
    const counts = [0, 0, 0, 0];
    Object.values(state.answersReceived).forEach((idx: number) => counts[idx]++);
    const maxVotes = Math.max(...counts, 1); // Avoid div by zero

    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    const top3 = sortedPlayers.slice(0, 3);

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-800">{question.question}</h2>
        
        <div className="flex-1 flex flex-col md:flex-row gap-8 items-center justify-center">
          {/* Chart Section */}
          <div className="flex-1 flex items-end justify-center gap-4 md:gap-8 w-full max-w-2xl">
             {question.answers.map((ans, idx) => {
               const isCorrect = idx === question.correctIndex;
               const heightPercent = (counts[idx] / maxVotes) * 40 + 5; // scaled for split view
               const bgColors = ['bg-quiz-red', 'bg-quiz-blue', 'bg-quiz-yellow', 'bg-quiz-green'];
               
               return (
                 <div key={idx} className="flex flex-col items-center w-16 md:w-24">
                    <div className="mb-2 font-bold text-xl text-gray-700">{counts[idx]}</div>
                    <div 
                      className={`${bgColors[idx]} w-full rounded-t-lg transition-all duration-1000 ease-out relative ${isCorrect ? 'opacity-100 shadow-lg' : 'opacity-40'}`} 
                      style={{ height: `${heightPercent}vh` }}
                    >
                      {isCorrect && <div className="absolute -top-10 left-0 right-0 text-center text-3xl">✅</div>}
                    </div>
                    <div className="mt-4 p-2 w-full text-center font-bold text-white rounded text-xs md:text-base" style={{backgroundColor: isCorrect ? '#26890c' : '#888'}}>
                       {idx === 0 ? '▲' : idx === 1 ? '◆' : idx === 2 ? '●' : '■'}
                    </div>
                 </div>
               )
             })}
          </div>

          {/* Leaderboard Section */}
          <div className="w-full md:w-80 bg-white rounded-3xl shadow-2xl p-6 border-t-8 border-brand-purple animate-pop relative overflow-hidden">
             {/* Decorative elements */}
             <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full opacity-20 blur-xl"></div>
             <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-brand-blue rounded-full opacity-20 blur-xl"></div>

             <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-6 flex items-center justify-center">
               <Trophy className="w-6 h-6 mr-2 text-yellow-500 animate-bounce" /> Liderlik Tablosu
             </h3>
             <div className="space-y-4">
               {top3.map((p, idx) => (
                 <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all animate-pop ${idx === 0 ? 'bg-yellow-50 border-yellow-200 scale-105 shadow-md' : 'bg-gray-50 border-gray-100'}`} style={{animationDelay: `${idx * 0.15}s`}}>
                    <div className="flex items-center gap-4">
                       <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-black shadow-sm ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-white'}`}>
                         {idx + 1}
                       </div>
                       <div className="text-4xl transform hover:scale-125 transition-transform cursor-default">{p.avatar || '👤'}</div>
                       <div className="flex flex-col">
                          <span className="font-black text-gray-800 truncate max-w-[120px] leading-none">{p.name}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Süper Oyuncu!</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="font-black text-brand-purple text-lg">{p.score}</div>
                       <div className="text-[10px] font-bold text-gray-400">PUAN</div>
                    </div>
                 </div>
               ))}
               {state.players.length === 0 && (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-4 opacity-20">🎮</div>
                    <p className="text-gray-400 font-bold italic">Henüz oyuncu yok</p>
                  </div>
               )}
             </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="text-gray-400 font-medium">
             Soru {state.currentQuestionIndex + 1} / {state.questions.length}
          </div>
          <button
            onClick={() => dispatch({ type: 'NEXT_QUESTION' })}
            className="bg-brand-blue text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-opacity-90 flex items-center shadow-lg transition-transform hover:scale-105"
          >
            Sonraki <ArrowRight className="ml-2" />
          </button>
        </div>
      </div>
    );
  }

  // --- PODIUM SCREEN ---
  if (state.status === GameStatus.FINAL_PODIUM) {
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    const top3 = sortedPlayers.slice(0, 3);

    return (
      <div className="min-h-screen bg-brand-purple flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')] opacity-30"></div>
        
        <h1 className="text-5xl font-black text-white mb-16 z-10">Kürsü</h1>

        <div className="flex items-end justify-center gap-4 mb-16 z-10 w-full max-w-4xl h-96">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '0.5s'}}>
              <div className="text-white font-bold text-2xl mb-2"><span className="mr-2">{top3[1].avatar || '👤'}</span>{top3[1].name}</div>
              <div className="text-blue-200 font-medium mb-1">{top3[1].score} pts</div>
              <div className="bg-brand-blue w-full h-48 rounded-t-xl flex items-start justify-center pt-4 shadow-xl">
                 <span className="text-5xl font-black text-white/50">2</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
             <div className="flex flex-col items-center w-1/3 animate-pop z-20">
              <Trophy className="text-yellow-400 w-16 h-16 mb-4 drop-shadow-lg" />
              <div className="text-white font-bold text-3xl mb-2"><span className="mr-2">{top3[0].avatar || '👤'}</span>{top3[0].name}</div>
              <div className="text-yellow-200 font-medium mb-1">{top3[0].score} pts</div>
              <div className="bg-yellow-500 w-full h-64 rounded-t-xl flex items-start justify-center pt-4 shadow-2xl ring-4 ring-yellow-300">
                 <span className="text-6xl font-black text-white/50">1</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '1s'}}>
              <div className="text-white font-bold text-2xl mb-2"><span className="mr-2">{top3[2].avatar || '👤'}</span>{top3[2].name}</div>
              <div className="text-red-200 font-medium mb-1">{top3[2].score} pts</div>
              <div className="bg-quiz-red w-full h-32 rounded-t-xl flex items-start justify-center pt-4 shadow-xl">
                 <span className="text-5xl font-black text-white/50">3</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="z-10 bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
           <h3 className="text-gray-500 font-bold mb-4 uppercase text-sm tracking-wider">Tüm Sonuçlar</h3>
           <div className="max-h-40 overflow-y-auto">
             {sortedPlayers.map((p, idx) => (
               <div key={p.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="font-bold text-gray-700">{idx + 1}. {p.avatar || '👤'} {p.name}</span>
                  <span className="text-gray-500">{p.score} pts</span>
               </div>
             ))}
           </div>
        </div>

        <button onClick={onBack} className="mt-8 z-10 flex items-center text-white hover:text-gray-200 font-bold">
           <RotateCcw className="mr-2" /> Ana Sayfaya Dön
        </button>

      </div>
    );
  }

  return <div>Bilinmeyen Durum</div>;
};

export default HostView;