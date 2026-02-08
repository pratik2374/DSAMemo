
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { Problem, Takeaway, Difficulty } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async normalizeProblem(input: string): Promise<Problem> {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Normalize this DSA problem into a structured JSON format. 
      Input: ${input}
      Search for it if it's a link or incomplete title.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            platform: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            statement: { type: Type.STRING },
            constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  input: { type: Type.STRING },
                  output: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                }
              }
            }
          },
          required: ['title', 'platform', 'difficulty', 'statement']
        }
      }
    });

    const data = JSON.parse(response.text);
    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      sourceUrl: input.startsWith('http') ? input : undefined
    };
  },

  async *getGuidedHintStream(
    problem: Problem,
    hintLevel: number,
    code: string,
    chatHistory: any[]
  ) {
    const levelPrompts = [
      "",
      "LEVEL 1: Ultra subtle hint. Do not give any concepts. Just a directional nudge or a pattern name. Preserve struggle.",
      "LEVEL 2: Conceptual hint + mini example. Explain the pattern without mentioning the code.",
      "LEVEL 3: Error rectification. If code is provided, point out logic errors specifically without giving the fix. Otherwise, provide a bit more detail on why a approach might fail.",
      "LEVEL 4: Approach Mode. Provide a full step-by-step algorithm, data structure choice, and complexity. No code yet.",
      "LEVEL 5: Full Solution. Provide complete code in Python/C++, explanation, and optimizations."
    ];

    const prompt = `
      You are a DSA Mentor. 
      Problem: ${problem.title}
      Statement: ${problem.statement}
      Level of help requested: ${hintLevel}
      Current User Code: \`\`\`${code}\`\`\`

      Instruction: ${levelPrompts[hintLevel]}
      
      CRITICAL FORMATTING: 
      - Always use standard Markdown.
      - Use backticks for technical terms and time complexity, e.g., \`O(N)\` or \`O(log N)\`. 
      - DO NOT use dollar signs ($) for math.
      - Interact naturally but stick to the level constraints.
    `;

    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    for await (const chunk of response) {
      yield {
        text: chunk.text,
        sources: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
      };
    }
  },

  async generateTakeaway(problem: Problem, chatHistory: string): Promise<Takeaway> {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following problem solving session and create a summary takeaway. 
      Focus on general learning and insights that the user can carry over to other similar problems.
      Problem: ${problem.title}
      Context: ${chatHistory}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: { type: Type.STRING, description: "Detailed approaches used during the session" },
            concept: { type: Type.STRING, description: "Key takeaways: knowledge and learning user can carry home to help in other problems" },
            category: { type: Type.STRING, description: "DSA Topic (e.g. Linked List, Sliding Window)" },
            importance: { type: Type.INTEGER, description: "1-5 rating of problem importance" }
          },
          required: ['notes', 'concept', 'category', 'importance']
        }
      }
    });

    const data = JSON.parse(response.text);
    return {
      id: Math.random().toString(36).substr(2, 9),
      problemTitle: problem.title,
      link: problem.sourceUrl || '',
      ...data
    };
  },

  async speak(text: string) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text.substring(0, 500)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  }
};
