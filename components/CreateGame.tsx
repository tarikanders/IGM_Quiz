import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { generateQuiz } from '../services/geminiService';
import { QuizConfig } from '../types';
import { Loader2, BrainCircuit, Upload, FileText, ArrowLeft } from 'lucide-react';
import mammoth from 'mammoth';

interface CreateGameProps {
  onBack: () => void;
}

const CreateGame: React.FC<CreateGameProps> = ({ onBack }) => {
  const { dispatch } = useGame();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [config, setConfig] = useState<QuizConfig>({
    topic: '',
    gradeLevel: '13-15 Grubu',
    count: 10,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setHasFile(true);
    const reader = new FileReader();

    if (file.type === 'application/pdf') {
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setConfig(prev => ({ 
          ...prev, 
          fileData: base64, 
          mimeType: 'application/pdf', 
          sourceText: undefined 
        }));
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = result.value;
          setConfig(prev => ({ 
            ...prev, 
            sourceText: text, 
            fileData: undefined, 
            mimeType: undefined 
          }));
        } catch (error) {
          console.error("Error reading docx:", error);
          alert("DOCX dosyası okunurken hata oluştu.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setConfig(prev => ({ 
          ...prev, 
          sourceText: text, 
          fileData: undefined, 
          mimeType: undefined 
        }));
      };
      reader.readAsText(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.topic && !config.sourceText && !config.fileData) return;

    setLoading(true);
    try {
      const questions = await generateQuiz(config);
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      dispatch({ type: 'SET_QUESTIONS', payload: questions });
      dispatch({ type: 'SET_PIN', payload: pin });
    } catch (err) {
      alert("Sınav oluşturulurken hata oluştu. API anahtarını kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-brand-light relative">
      <button 
        onClick={onBack} 
        className="absolute top-4 left-4 flex items-center text-brand-purple hover:text-brand-blue font-bold px-4 py-2 bg-white rounded-lg shadow-sm transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" /> Geri
      </button>
      
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-lg border-t-4 border-brand-purple mt-12">
        <div className="flex items-center justify-center mb-6 text-brand-purple">
          <BrainCircuit className="w-10 h-10 mr-2" />
          <h2 className="text-2xl font-bold">Yapay Zeka Üreticisi</h2>
        </div>
        
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sınav Konusu</label>
            <input
              type="text"
              required={!config.sourceText && !config.fileData}
              value={config.topic}
              onChange={(e) => setConfig({ ...config, topic: e.target.value })}
              placeholder={config.sourceText || config.fileData ? "İsteğe bağlı konu (dosya yüklendi)" : "Örn: İslam Tarihi, Peygamberler..."}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition"
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Veya bir dosya yükleyin (PDF, DOCX, txt, md, json, csv)</label>
             <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer">
                <input 
                  type="file" 
                  accept=".pdf,.docx,.txt,.md,.json,.csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center text-gray-500">
                  {fileName ? (
                    <>
                      <FileText className="w-8 h-8 mb-2 text-brand-purple" />
                      <span className="text-sm font-medium text-gray-900">{fileName}</span>
                      <span className="text-xs text-green-600 mt-1">Dosya başarıyla yüklendi (Sorular otomatik algılanacak)</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm">Buraya tıklayın veya dosya sürükleyin</span>
                    </>
                  )}
                </div>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seviye</label>
            <select
              value={config.gradeLevel}
              onChange={(e) => setConfig({ ...config, gradeLevel: e.target.value as any })}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none"
            >
              <option>9-12 Grubu</option>
              <option>13-15 Grubu</option>
            </select>
          </div>

          {!hasFile && (
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Soru Sayısı: {config.count}</label>
               <input 
                 type="range" 
                 min="3" 
                 max="50" 
                 value={config.count} 
                 onChange={(e) => setConfig({...config, count: parseInt(e.target.value)})}
                 className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-purple"
               />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-purple hover:bg-opacity-90 text-white font-bold py-4 px-6 rounded-lg transition-all flex justify-center items-center shadow-md disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : 'Oda Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGame;
