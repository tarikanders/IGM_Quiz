import React, { useState, useEffect } from 'react';
import { GameProvider } from './context/GameContext';
import HostView from './components/HostView';
import PlayerView from './components/PlayerView';
import { Users, Tv, MoonStar } from 'lucide-react';

enum UserRole {
  NONE = 'NONE',
  HOST = 'HOST',
  PLAYER = 'PLAYER',
}

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.NONE);
  const [initialPin, setInitialPin] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (pinFromUrl) {
      setInitialPin(pinFromUrl);
      setRole(UserRole.PLAYER);
    }
  }, []);

  if (role === UserRole.NONE) {
    return (
      <div className="min-h-screen bg-brand-purple flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-quiz-red rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-quiz-blue rotate-45 opacity-20"></div>

        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center z-10">
          <div className="flex justify-center mb-6">
            <MoonStar className="w-16 h-16 text-brand-purple" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-800 mb-2 tracking-tight">Igmg Eğitim Quizz</h1>
          <p className="text-gray-500 mb-8 font-medium">Igmg eğitim başkanlığı temel eğitim bilgi yarışması</p>

          <div className="space-y-4">
            <button
              onClick={() => setRole(UserRole.PLAYER)}
              className="w-full flex items-center justify-center gap-3 bg-brand-blue hover:bg-opacity-90 text-white font-bold py-4 px-6 rounded-lg transition-transform hover:scale-105 shadow-md text-lg"
            >
              <Users className="w-6 h-6" />
              Oyuna Katıl
            </button>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-sm">VEYA</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button
              onClick={() => setRole(UserRole.HOST)}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-brand-purple text-brand-purple hover:bg-gray-50 font-bold py-4 px-6 rounded-lg transition-all text-lg"
            >
              <Tv className="w-6 h-6" />
              Oyun Oluştur (Kurucu)
            </button>
          </div>
          
          <div className="mt-8 text-xs text-gray-400">
             <p>Yerel Çok Oyunculu Mod: Test etmek için bir "Kurucu" ve bir "Oyuncu" sekmesi açın.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GameProvider>
      {role === UserRole.HOST ? <HostView onBack={() => { setRole(UserRole.NONE); window.history.pushState({}, '', '/'); }} /> : <PlayerView initialPin={initialPin} onBack={() => { setRole(UserRole.NONE); window.history.pushState({}, '', '/'); }} />}
    </GameProvider>
  );
};

export default App;
