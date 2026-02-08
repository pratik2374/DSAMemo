
export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface Problem {
  id: string;
  title: string;
  platform: string;
  difficulty: Difficulty;
  tags: string[];
  statement: string;
  constraints: string[];
  examples: Array<{ input: string; output: string; explanation?: string }>;
  sourceUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  hintLevel?: number;
  sources?: Array<{ web: { uri: string; title: string } }>;
}

export interface Takeaway {
  id: string;
  problemTitle: string;
  notes: string;
  concept: string;
  link: string;
  category: string;
  importance: number; // 1-5 stars
}

export interface UserStats {
  problemsStarted: number;
  hintsUsedCount: Record<number, number>;
  totalTimeSeconds: number;
  solvedCount: number;
}
