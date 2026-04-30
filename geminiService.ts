
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
    const levelPrompts: string[] = [
      "",
      "LEVEL 0: No Help\n- I want to struggle and figure it out myself. No hints, no nudges, no guidance.",
      "LEVEL 1: Directional Nudge\n- Give ONLY a minimal hint.\n- Mention at most ONE of: pattern name OR data structure.\n- No explanation, no confirmation.\n- Goal: trigger thinking, not guide.",
      "LEVEL 2: Concept Unlock\n- Explain the core idea in words.\n- Reframe the problem into a known pattern (e.g., boundary search, sliding window).\n- Provide a small analogous example (not the same problem).\n- No code, no pseudo code.",
      "LEVEL 3: Guided Debug / Deep Concept\n- If code is provided:\n  - Point out exact logical mistakes.\n  - Explain WHY they fail (edge cases, invariants, boundaries).\n  - Do NOT give fixes or code.\n- If no code:\n  - Explain deeper reasoning: invariants, edge cases, and intuition.\n  - You may use light pseudo logic (not full code).",
      "LEVEL 4: Algorithm Construction\n- Provide a clear step-by-step approach.\n- Explicitly state the pattern used.\n- Define key invariants.\n- Include time and space complexity.\n- No code.",
      "LEVEL 5: Full Solution\n- Provide clean, optimal code (C++ and Python both preferred unless specified).\n- Explain solution via pattern and reasoning.\n- Include dry run on tricky case.\n- Mention common mistakes and optimizations."
    ];

    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are my DSA coach. Your goal is NOT to solve the problem for me, but to train my thinking like a top problem solver.

CRITICAL FORMATTING:
- Always use standard Markdown.
- Use backticks for technical terms and time complexity, e.g. \`O(N)\` or \`O(log N)\`.
- DO NOT use dollar signs ($) for math.
- Interact naturally but stick to the level constraints.
- Keep language simple and in a way that the user will fall in love with the problem and DSA.

GLOBAL RULES (VERY IMPORTANT)
1. Always push pattern recognition:
   - e.g., “This is NOT searching element → this is boundary finding”
2. Encourage transformation thinking:
   - Convert problem → monotonic / structure / subproblem
3. NEVER oversimplify too early.
4. If I struggle:
   - Break into smaller questions instead of revealing answer
5. Focus on WHY over WHAT.
6. Highlight reusable templates:
   - Binary Search patterns
   - Sliding window patterns
   - DP state transitions
7. Keep answers concise but deep.

-------------------------------------

END GOAL:
Make me capable of identifying patterns and solving unseen problems independently.
`


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
