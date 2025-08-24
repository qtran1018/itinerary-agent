export type QuestionType = 'buttons' | 'text' | 'checkbox' | 'dropdown';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  next?: Record<string, string | null>; // null for last question
}
