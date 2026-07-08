
import Groq from "groq-sdk";
import { Problem, Takeaway } from './types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

const MODEL = 'openai/gpt-oss-120b';

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
    latestUserQuery: string,
    chatHistory: any[]
  ) {
    const levelPrompts: string[] = [
      `
LEVEL 0 — Clarification Only

Use this ONLY when:
- the user asks for clarification
- the problem statement is ambiguous
- important information is missing

Rules:
- Ask only necessary clarification questions.
- Do NOT give hints.
- Do NOT discuss patterns or solutions.
`,

      `
LEVEL 1 — Tiny Directional Hint

Rules:
- Focus ONLY on the user's current blockage.
- Give a very small nudge.
- Mention at most ONE:
  - pattern
  - invariant
  - observation
  - data structure
- No explanation.
- No algorithm steps.
- No pseudo code.
- Keep it under 3 sentences.
`,

      `
LEVEL 2 — Concept Unlock

Rules:
- Explain ONLY the key insight needed.
- Directly address the user's confusion.
- Use small examples ONLY if necessary.
- Connect to known patterns naturally.
- No code.
- No full algorithm.
- No implementation details.
`,

      `
LEVEL 3 — Guided Debugging / Deep Reasoning

If code exists:
- Analyze the user's code FIRST.
- Identify the EXACT logical issue.
- Explain:
  - where reasoning breaks
  - incorrect assumptions
  - failing edge cases
  - invariant violations
- Do NOT provide corrected code.

If no code:
- Explain the deeper reasoning needed.
- Focus on invariants and transitions.
- You may use light pseudo logic.
- No full solution.
`,

      `
LEVEL 4 — Algorithm Construction

Rules:
- Give step-by-step approach.
- Explicitly name the pattern.
- Explain WHY the approach works.
- Define key invariants.
- Mention edge cases.
- Include time + space complexity.
- No code.
`,

      `
LEVEL 5 — Full Solution

Rules:
- Provide optimal clean solution.
- Prefer both C++ and Python.
- Explain:
  - intuition
  - reasoning
  - pattern
  - edge cases
- Include dry run.
- Mention common mistakes.
`
    ];

    const systemPrompt = `
You are an elite DSA mentor helping the user become an independent problem solver.

PRIMARY OBJECTIVE:
Answer the USER'S MOST RECENT QUESTION directly and specifically.

Your response must ALWAYS adapt to:
- the user's latest doubt
- the user's current code
- the user's solving stage
- the requested hint depth

IMPORTANT BEHAVIOR:

1. PRIORITIZE USER CONFUSION
- Solve the user's CURRENT confusion.
- Do NOT give generic tutorials.
- Do NOT explain unrelated concepts.

2. CODE-FIRST REASONING
If code is provided:
- Analyze the user's code BEFORE theory.
- Refer to THEIR logic.
- Explain what THEIR code is doing.

3. DO NOT RESET CONTEXT
- Continue naturally from previous conversation.
- Assume the user remembers earlier discussion.
- Do not restart explanations from scratch.

4. AVOID GENERIC RESPONSES
BAD RESPONSES:
- Generic DSA lectures
- Full pattern explanations when unnecessary
- Ignoring user's actual question
- Repeating previous hints
- Giving unrelated optimizations

5. TEACH LIKE A TOP MENTOR
- Encourage thinking.
- Focus on WHY something works/fails.
- Reveal only the requested depth.
- Prefer targeted guidance over long explanations.

FORMAT RULES:
- Use Markdown.
- Use backticks for technical terms and complexity.
- Never use LaTeX.
- Keep responses concise but insightful.
`;

    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },

        ...chatHistory.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),

        {
          role: 'user',
          content: `
Problem Title:
${problem.title}

Problem Statement:
${problem.statement}

Latest User Question:
${latestUserQuery}

Current User Code:
\`\`\`
${code || 'No code provided'}
\`\`\`

Requested Hint Level:
${hintLevel}

Hint-Level Instructions:
${levelPrompts[hintLevel]}

IMPORTANT:
- Directly answer the latest user question.
- Use the user's code and reasoning.
- Avoid generic explanations.
`
        }
      ],

      temperature: hintLevel <= 2 ? 0.3 : 0.5,

      stream: true
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';

      if (text) {
        yield {
          text,
          sources: undefined
        };
      }
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
  "notes": string (detailed approaches used during the session, like explaing in the interview, like when we read the approach instantly we make the solution),
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
  },

  async *getMockInterviewStream(
    problem: Problem,
    code: string,
    latestUserResponse: string,
    chatHistory: any[]
  ) {
    const systemPrompt = `You are a Senior Technical Interviewer at a top-tier tech company.
Your goal is to conduct a realistic, mock technical interview for the problem: "${problem.title}".

The candidate has submitted the following code:
\`\`\`
${code || '// No code provided'}
\`\`\`

Problem Statement:
${problem.statement}

Constraints:
${problem.constraints.map(c => `- ${c}`).join('\n')}

INSTRUCTIONS:
1. Act in character as a thorough, encouraging, yet analytical interviewer.
2. Ask follow-up questions to understand the candidate's approach, code logic, time/space complexity, edge cases, or potential optimization.
3. Only ask ONE question or make ONE point at a time. Keep your messages concise (under 4 sentences) and highly conversational, as they will be spoken aloud to the candidate.
4. DO NOT provide code solutions or full answers. Instead, probe the user's reasoning. If they are stuck, give them a subtle hint, just like a real interviewer would.
5. If this is the start of the interview (no previous messages or only greetings), greet the candidate, mention that you've reviewed their solution code, and ask them to explain their core approach or intuition.
`;

    const formattedHistory = chatHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: latestUserResponse }
      ],
      temperature: 0.7,
      stream: true
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        yield { text };
      }
    }
  },

  async generateInterviewFeedback(
    problem: Problem,
    code: string,
    chatHistory: any[]
  ): Promise<{
    communicationScore: number;
    correctnessScore: number;
    strengths: string[];
    weaknesses: string[];
    feedbackSummary: string;
    tipsForImprovement: string[];
  }> {
    const chatTranscript = chatHistory
      .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a Senior Technical Interviewer. Analyze the mock technical interview transcript and provide a structured evaluation of the candidate.
Return a JSON object with exactly these fields:
{
  "communicationScore": number (1 to 100 representing how clearly they explained ideas),
  "correctnessScore": number (1 to 100 representing code logic and correctness),
  "strengths": string[] (list of strengths in their solution, reasoning, or communication),
  "weaknesses": string[] (list of weaknesses, code errors, or gaps in explanation),
  "feedbackSummary": string (a concise overview of how they did),
  "tipsForImprovement": string[] (actionable recommendations)
}
Always return valid JSON.`;

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Problem: ${problem.title}
Code:
\`\`\`
${code || '// No code provided'}
\`\`\`

Interview Transcript:
${chatTranscript}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
};
