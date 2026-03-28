import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { network } from '../services/networkService';
import { GameStatus } from '../types';
import { Loader2, XCircle, CheckCircle, Wifi, AlertCircle, Server } from 'lucide-react';

interface PlayerViewProps {
  initialPin?: string;
  onBack: () => void;
}

type ConnectionStatus = 'INPUT' | 'CONNECTING' | 'CONNECTED';

const AVATARS = ['🦁', '🐼', '🦊', '🐨', '🐯', '🐸', '🐵', '🐧', '🦉', '🦄', '🦖', '🐙'];

const PlayerView: React.FC<PlayerViewProps> = ({ initialPin = '', onBack }) => {
  const { state, dispatch } = useGame();
  const [name, setName] = useState('');
  const [inputPin, setInputPin] = useState(initialPin);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  
  // Connection state management
  const [status, setStatus] = useState<ConnectionStatus>('INPUT');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Local unique ID for this player session
  const [myId] = useState(() => 'player-' + Math.random().toString(36).substr(2, 9));
  
  // Ref to track timeouts
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin || !name) return;

    setStatus('CONNECTING');
    setError(null);
    setStatusMsg('Sunucuya bağlanılıyor...');
    
    // 1. Connect to MQTT Broker
    network.connect(inputPin, 'PLAYER');

    // 2. Send Join Request immediately (don't wait for retained state)
    // This actively asks the host for the state, which is more robust than relying solely on Retained messages.
    console.log("Sending JOIN_REQUEST...");
    network.send('JOIN_REQUEST', { id: myId, name, avatar });

    // 3. Setup listener for Host Response
    const unsubscribe = network.subscribe((msg) => {
      if (msg.type === 'STATE_UPDATE') {
        // SUCCESS: We received the state!
        
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        
        // Sync local state
        dispatch({ type: 'SYNC_STATE', payload: msg.payload });
        setStatus('CONNECTED');
      }
    });

    // 4. Set a safety timeout (15 seconds for slow mobile networks)
    connectionTimeoutRef.current = setTimeout(() => {
       if (status !== 'CONNECTED') {
          unsubscribe();
          network.disconnect();
          setStatus('INPUT');
          setError("Bu kodla oda bulunamadı. Kurucu bağlı mı? (Zaman aşımı)");
       }
    }, 15000);
  };

  // Persistent listener once connected
  useEffect(() => {
    if (status === 'CONNECTED' && inputPin) {
      const unsubscribe = network.subscribe((msg) => {
        if (msg.type === 'STATE_UPDATE') {
          dispatch({ type: 'SYNC_STATE', payload: msg.payload });
        }
      });
      return () => {
        unsubscribe();
        network.disconnect();
      };
    }
  }, [status, inputPin, dispatch]);

  // Reset answer state when question changes
  useEffect(() => {
    if (state.status === GameStatus.PLAYING) {
      setHasAnswered(false);
    }
  }, [state.currentQuestionIndex, state.status]);


  // --- JOIN FORM ---
  if (status === 'INPUT' || status === 'CONNECTING') {
    return (
      <div className="min-h-screen bg-brand-purple flex items-center justify-center p-4">
        <button onClick={onBack} className="absolute top-4 left-4 text-white/50 hover:text-white">Geri</button>
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm relative">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Katıl</h1>
          
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-start gap-2">
               <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              placeholder="Oyun PIN"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value)}
              className="w-full text-center text-xl font-bold tracking-widest px-4 py-3 border-2 border-gray-200 rounded focus:border-brand-purple outline-none"
              maxLength={6}
              disabled={status === 'CONNECTING' || !!initialPin}
            />
            <input
              type="text"
              placeholder="Takma Ad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-center text-lg px-4 py-3 border-2 border-gray-200 rounded focus:border-brand-purple outline-none"
              maxLength={12}
              disabled={status === 'CONNECTING'}
            />
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Karakter Seç</label>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`text-3xl p-2 rounded-lg transition-all ${avatar === a ? 'bg-brand-purple/20 ring-2 ring-brand-purple scale-110' : 'hover:bg-gray-100'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!inputPin || !name || status === 'CONNECTING'}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded hover:bg-black transition disabled:opacity-70 flex justify-center items-center"
            >
              {status === 'CONNECTING' ? (
                <>
                  <Loader2 className="animate-spin mr-2 w-5 h-5" /> 
                  <span className="text-sm ml-2">{statusMsg || 'Bağlanıyor...'}</span>
                </>
              ) : (
                "Hadi Başlayalım!"
              )}
            </button>
          </form>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
             <Server className="w-4 h-4" />
             <span>Global Sunucu (4G/WiFi uyumlu)</span>
          </div>
        </div>
      </div>
    );
  }

  // --- LOBBY WAITING ---
  if (state.status === GameStatus.LOBBY || state.status === GameStatus.IDLE) {
    return (
      <div className="min-h-screen bg-brand-purple flex flex-col items-center justify-center p-8 text-white">
        <h2 className="text-3xl font-bold mb-4">İçeridesin!</h2>
        <div className="text-6xl mb-4 animate-bounce">{avatar}</div>
        <p className="mb-8 opacity-80">Takma adın: <span className="font-bold">{name}</span></p>
        <p className="text-lg font-medium text-center">Adını ekranda görüyor musun?</p>
        <div className="mt-8 bg-white/10 px-4 py-2 rounded text-sm text-center">
            <div className="flex items-center gap-2 justify-center mb-1 font-bold text-green-300">
                <Wifi className="w-4 h-4" /> Bağlandı
            </div>
            Oyunun başlaması bekleniyor...
        </div>
      </div>
    );
  }

  // --- GAME CONTROLLER ---
  if (state.status === GameStatus.PLAYING) {
    if (hasAnswered) {
       return (
         <div className="min-h-screen bg-brand-purple flex flex-col items-center justify-center text-white">
            <h2 className="text-2xl font-bold mb-4">Cevap gönderildi!</h2>
            <Loader2 className="w-16 h-16 animate-spin opacity-50" />
            <p className="mt-4">Sürenin bitmesini bekle...</p>
         </div>
       )
    }

    return (
      <div className="min-h-screen bg-gray-100 p-2 flex flex-col">
        <div className="h-16 flex items-center justify-center mb-2">
            <div className="bg-white px-4 py-1 rounded-full font-bold shadow-sm text-gray-700">
               Soru {state.currentQuestionIndex + 1}
            </div>
        </div>
        
        <div className="flex-1 grid grid-cols-2 gap-2 md:gap-4">
           {/* Red Triangle */}
           <button 
             onClick={() => { network.send('SUBMIT_ANSWER', { playerId: myId, answerIndex: 0 }); setHasAnswered(true); }}
             className="bg-quiz-red rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-transform flex flex-col items-center justify-center"
           >
             <span className="text-white text-6xl mb-2">▲</span>
           </button>
           
           {/* Blue Diamond */}
           <button 
             onClick={() => { network.send('SUBMIT_ANSWER', { playerId: myId, answerIndex: 1 }); setHasAnswered(true); }}
             className="bg-quiz-blue rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-transform flex flex-col items-center justify-center"
           >
             <span className="text-white text-6xl mb-2">◆</span>
           </button>

           {/* Yellow Circle */}
           <button 
             onClick={() => { network.send('SUBMIT_ANSWER', { playerId: myId, answerIndex: 2 }); setHasAnswered(true); }}
             className="bg-quiz-yellow rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-transform flex flex-col items-center justify-center"
           >
             <span className="text-white text-6xl mb-2">●</span>
           </button>

           {/* Green Square */}
           <button 
             onClick={() => { network.send('SUBMIT_ANSWER', { playerId: myId, answerIndex: 3 }); setHasAnswered(true); }}
             className="bg-quiz-green rounded-lg shadow-md hover:opacity-90 active:scale-95 transition-transform flex flex-col items-center justify-center"
           >
             <span className="text-white text-6xl mb-2">■</span>
           </button>
        </div>
      </div>
    );
  }

  // --- FEEDBACK SCREEN (Result) ---
  if (state.status === GameStatus.QUESTION_RESULT) {
    const myAnswer = state.answersReceived[myId];
    const currentQ = state.questions[state.currentQuestionIndex];
    const isCorrect = myAnswer === currentQ.correctIndex;
    const me = state.players.find(p => p.id === myId);

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isCorrect ? 'bg-green-600' : 'bg-red-600'} text-white transition-colors`}>
         <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-md">
            {isCorrect ? <CheckCircle className="w-24 h-24" /> : <XCircle className="w-24 h-24" />}
         </div>
         
         <h2 className="text-4xl font-black mb-2">{isCorrect ? 'Doğru!' : 'Yanlış...'}</h2>
         
         {isCorrect && (
            <div className="bg-black/20 px-6 py-2 rounded-full font-bold mb-8 animate-bounce">
              + {me?.streak ? ((me.streak > 1 ? '🔥 ' : '') + 'Seri x' + me.streak) : 'Puan'}
            </div>
         )}

         <div className="bg-black/30 p-6 rounded-xl w-full max-w-xs text-center">
            <p className="text-sm opacity-80 uppercase tracking-widest mb-1">Mevcut Puan</p>
            <p className="text-3xl font-bold">{me?.score || 0}</p>
         </div>

         <div className="absolute bottom-10 opacity-70 text-sm">
           Sıralama için kurucu ekranına bak.
         </div>
      </div>
    );
  }

  // --- FINAL SCREEN ---
  if (state.status === GameStatus.FINAL_PODIUM) {
    const me = state.players.find(p => p.id === myId);
    const rank = [...state.players].sort((a,b) => b.score - a.score).findIndex(p => p.id === myId) + 1;

    return (
      <div className="min-h-screen bg-brand-purple flex flex-col items-center justify-center p-6 text-white">
        <h1 className="text-3xl font-bold mb-8">Oyun Bitti!</h1>
        
        <div className="bg-white text-brand-purple p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
           <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Sıralaman</div>
           <div className="text-6xl font-black mb-6">#{rank}</div>
           
           <div className="border-t border-gray-200 pt-6">
             <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Final Puanı</div>
             <div className="text-3xl font-bold">{me?.score || 0} pts</div>
           </div>
        </div>

        <button onClick={onBack} className="mt-8 bg-black/20 hover:bg-black/40 px-6 py-3 rounded-lg font-bold transition">
          Çıkış
        </button>
      </div>
    );
  }

  return <div>Yükleniyor...</div>;
};

export default PlayerView;