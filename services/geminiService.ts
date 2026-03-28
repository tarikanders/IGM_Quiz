import { GoogleGenAI, Type } from "@google/genai";
import { QuizConfig, Question } from "../types";

const generateQuiz = async (config: QuizConfig): Promise<Question[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];

  if (config.fileData && config.mimeType) {
    parts.push({
      inlineData: {
        data: config.fileData,
        mimeType: config.mimeType
      }
    });
    parts.push({
      text: `Analyse ce document et extrais TOUTES les questions qu'il contient pour en faire un quiz.
      
      RÈGLES STRICTES :
      1. FIDÉLITÉ ABSOLUE : Si le document contient déjà des questions (ex: QCM, liste), tu dois les reprendre TEXTUELLEMENT. Ne change pas un mot.
      2. LANGUE : Conserve la langue originale du document. NE TRADUIS RIEN. Si le document est en Turc, les questions doivent être en Turc.
      3. QUANTITÉ : Tu dois extraire 100% des questions présentes. Si le document contient 25 questions, tu dois générer 25 questions. Ne t'arrête pas à 10.
      4. RÉPONSES : Si les réponses sont fournies, utilise-les exactement. Sinon, génère des réponses plausibles dans la même langue.
      
      Format de sortie attendu : JSON (tableau d'objets Question).
      Pour chaque question, fournis 4 réponses possibles et l'index de la réponse correcte (0-3).
      Limite de temps par défaut : 30 secondes.`
    });
  } else {
    let prompt = `
      Génère un quiz de ${config.count} questions.
      Niveau scolaire : ${config.gradeLevel}.
      Langue : Turc (Türkçe).
      Pour chaque question, fournis 4 réponses possibles et l'index de la réponse correcte (0-3).
      Limite de temps par défaut : 30 secondes.
    `;

    if (config.sourceText) {
      prompt += `
        \n\nBASES-TOI EXCLUSIVEMENT SUR LE TEXTE SUIVANT :
        ---
        ${config.sourceText.substring(0, 20000)}
        ---
        RÈGLES STRICTES :
        1. Si ce texte est une liste de questions, extrais-les TOUTES (même s'il y en a 50).
        2. Ne modifie pas le phrasé des questions existantes.
        3. Ne traduis pas le texte. Garde la langue d'origine.
      `;
    } else {
      prompt += `
        \n\nSujet : "${config.topic}".
        Instructions spécifiques :
        - Konu İslam veya din ile ilgiliyse, istenen seviyeye uygun "Temel Bilgiler" (Temel Dini Bilgiler 1, 2, 3) konularını dahil et.
        - "9-12 Grubu" seviyesi 9-12 yaş arası çocuklar içindir (başlangıç/orta seviye).
        - "13-15 Grubu" seviyesi 13-15 yaş arası gençler içindir (orta/ileri seviye).
      `;
    }
    parts.push({ text: prompt });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctIndex: { type: Type.INTEGER },
              timeLimit: { type: Type.INTEGER },
            },
            propertyOrdering: ["question", "answers", "correctIndex", "timeLimit"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI");

    const questions = JSON.parse(jsonText) as Question[];
    return questions;
  } catch (error) {
    console.error("Error generating quiz:", error);
    // Fallback data in case of error (or dev mode without key)
    return [
      {
        question: "Quelle est la capitale de la France ?",
        answers: ["Lyon", "Marseille", "Paris", "Bordeaux"],
        correctIndex: 2,
        timeLimit: 20
      },
      {
        question: "Combien font 5 x 5 ?",
        answers: ["10", "20", "25", "30"],
        correctIndex: 2,
        timeLimit: 20
      }
    ];
  }
};

export { generateQuiz };
