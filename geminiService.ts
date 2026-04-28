
import Groq from "groq-sdk";
import { Problem, Takeaway } from './types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

const MODEL = 'llama-3.3-70b-versatile';

export const geminiService = {
  async normalizeProblem(input: string): Promise<Problem> {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a DSA problem normalizer. Given a problem title, link, or description, return a JSON object with this exact structure:
{
  "title": string,
  "platform": string (e.g. "LeetCode", "Codeforces", "GeeksForGeeks"),
  "difficulty": "Easy" | "Medium" | "Hard",
  "tags": string[],
  "statement": string (full problem statement),
  "constraints": string[],
  "examples": [{ "input": string, "output": string, "explanation": string }]
}
Always return valid JSON. If you don't know some fields, use reasonable defaults.`
        },
        {
          role: 'user',
          content: `Normalize this DSA problem and return valid JSON: ${input}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');
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
      "LEVEL 1: Ultra subtle hint. Do not give any concepts. Just a directional nudge or a pattern name. Preserve struggle. but give a subtle idea/Data Structure to guess the approach",
      "LEVEL 2: Conceptual hint + mini example. Explain the pattern without mentioning the code but explain the approach with a mini example. You can use a different problem as an example but it should be very similar in concept. Do not give code or pseudo code.",
      "LEVEL 3: Error rectification. If code is provided, point out logic errors specifically without giving the fix. Otherwise, provide a bit more detail on why a approach might fail or fundamentals and idea with a detailed theory(problem, Data Structure, example, dry runs, pseudo code) which will be used here, but need not to address this question, just address concept or method used",
      "LEVEL 4: Approach Mode. Provide a full step-by-step algorithm, data structure choice, and complexity. No code yet.",
      "LEVEL 5: Full Solution. Provide complete code in Python/C++, explanation, and optimizations. and DRY run on cases where user fails or cannot think"
    ];

    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a DSA Mentor. Your task is to assist and make the user learn fundamental DSA concepts.

CRITICAL FORMATTING:
- Always use standard Markdown.
- Use backticks for technical terms and time complexity, e.g. \`O(N)\` or \`O(log N)\`.
- DO NOT use dollar signs ($) for math.
- Interact naturally but stick to the level constraints.
- Keep language simple and in a way that the user will fall in love with the problem and DSA.`
        },
        ...chatHistory.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: `Problem: ${problem.title}
Statement: ${problem.statement}
Level of help requested: ${hintLevel}
Current User Code: \`\`\`${code}\`\`\`

Instruction: ${levelPrompts[hintLevel]}`
        }
      ],
      stream: true
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield { text, sources: undefined };
    }
  },

  async generateTakeaway(problem: Problem, chatHistory: string): Promise<Takeaway> {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a DSA learning assistant. Analyze problem-solving sessions and generate structured takeaways.
Return a JSON object with exactly these fields:
{
  "notes": string (detailed approaches used during the session),
  "concept": string (key generalizable takeaways the user can carry to similar problems),
  "category": string (DSA topic e.g. "Linked List", "Sliding Window", "Dynamic Programming"),
  "importance": number (1-5 rating of problem importance)
}
Always return valid JSON.`
        },
        {
          role: 'user',
          content: `Analyze this problem-solving session and create a summary takeaway. Focus on general learning and insights.
Problem: ${problem.title}
Context: ${chatHistory}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');
    return {
      id: Math.random().toString(36).substr(2, 9),
      problemTitle: problem.title,
      link: problem.sourceUrl || '',
      ...data
    };
  },

  async speak(text: string) {
    try {
      const response = await groq.audio.speech.create({
        model: 'playai-tts',
        voice: 'Fritz-PlayAI',
        input: text.substring(0, 500),
        response_format: 'wav'
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('TTS error:', err);
    }
  }
};
