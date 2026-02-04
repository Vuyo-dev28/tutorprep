export type Curriculum = 'CAPS' | 'IEB';

export type GradeLevel = 'primary' | 'high-school';

export interface UserProfile {
  name: string;
  grade: number;
  curriculum: Curriculum;
  gradeLevel: GradeLevel;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completed: boolean;
  progress: number;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  type: 'video' | 'notes' | 'example';
  duration?: string;
  content: string;
  completed: boolean;
}

export interface Question {
  id: string;
  topicId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedDate?: string;
}
