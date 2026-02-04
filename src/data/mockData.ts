import { Subject, Topic, Lesson, Question, Achievement } from '@/types';

export const subjects: Subject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    description: 'Numbers, algebra, geometry and more',
    icon: '📐',
    color: 'bg-blue-500',
  },
  {
    id: 'physics',
    name: 'Physics',
    description: 'Motion, energy, forces and matter',
    icon: '⚛️',
    color: 'bg-purple-500',
  },
];

export const topics: Topic[] = [
  // Mathematics Topics
  {
    id: 'math-1',
    subjectId: 'mathematics',
    name: 'Algebra Basics',
    description: 'Learn about variables, expressions, and equations',
    difficulty: 'beginner',
    completed: false,
    progress: 0,
  },
  {
    id: 'math-2',
    subjectId: 'mathematics',
    name: 'Geometry',
    description: 'Shapes, angles, and spatial reasoning',
    difficulty: 'beginner',
    completed: false,
    progress: 0,
  },
  {
    id: 'math-3',
    subjectId: 'mathematics',
    name: 'Trigonometry',
    description: 'Sine, cosine, and tangent functions',
    difficulty: 'intermediate',
    completed: false,
    progress: 0,
  },
  {
    id: 'math-4',
    subjectId: 'mathematics',
    name: 'Calculus',
    description: 'Derivatives and integrals',
    difficulty: 'advanced',
    completed: false,
    progress: 0,
  },
  // Physics Topics
  {
    id: 'physics-1',
    subjectId: 'physics',
    name: 'Motion and Forces',
    description: "Newton's laws and kinematics",
    difficulty: 'beginner',
    completed: false,
    progress: 0,
  },
  {
    id: 'physics-2',
    subjectId: 'physics',
    name: 'Energy and Work',
    description: 'Kinetic and potential energy',
    difficulty: 'intermediate',
    completed: false,
    progress: 0,
  },
  {
    id: 'physics-3',
    subjectId: 'physics',
    name: 'Electricity and Magnetism',
    description: 'Circuits, current, and magnetic fields',
    difficulty: 'intermediate',
    completed: false,
    progress: 0,
  },
  {
    id: 'physics-4',
    subjectId: 'physics',
    name: 'Waves and Sound',
    description: 'Wave properties and sound phenomena',
    difficulty: 'beginner',
    completed: false,
    progress: 0,
  },
];

export const lessons: Lesson[] = [
  {
    id: 'lesson-1',
    topicId: 'math-1',
    title: 'Introduction to Variables',
    type: 'video',
    duration: '8 min',
    content: 'Learn what variables are and how they represent unknown values in mathematics.',
    completed: false,
  },
  {
    id: 'lesson-2',
    topicId: 'math-1',
    title: 'Solving Simple Equations',
    type: 'notes',
    content: 'Step-by-step guide to solving linear equations with one variable.',
    completed: false,
  },
  {
    id: 'lesson-3',
    topicId: 'math-1',
    title: 'Practice Examples',
    type: 'example',
    content: 'Work through real-world examples of algebraic equations.',
    completed: false,
  },
];

export const questions: Question[] = [
  {
    id: 'q1',
    topicId: 'math-1',
    question: 'Solve for x: 2x + 5 = 15',
    options: ['x = 5', 'x = 10', 'x = 7.5', 'x = 20'],
    correctAnswer: 0,
    explanation: 'Subtract 5 from both sides: 2x = 10, then divide by 2: x = 5',
  },
  {
    id: 'q2',
    topicId: 'math-1',
    question: 'What is the value of 3y when y = 4?',
    options: ['7', '12', '1', '34'],
    correctAnswer: 1,
    explanation: '3 × 4 = 12',
  },
  {
    id: 'q3',
    topicId: 'physics-1',
    question: "According to Newton's Second Law, F = ma. If mass is 5kg and acceleration is 2m/s², what is the force?",
    options: ['7N', '3N', '10N', '2.5N'],
    correctAnswer: 2,
    explanation: 'F = 5kg × 2m/s² = 10N',
  },
];

export const achievements: Achievement[] = [
  {
    id: 'ach-1',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: '🎯',
    unlocked: false,
  },
  {
    id: 'ach-2',
    title: 'Quiz Master',
    description: 'Score 100% on a quiz',
    icon: '🏆',
    unlocked: false,
  },
  {
    id: 'ach-3',
    title: 'Dedicated Learner',
    description: 'Study for 7 days in a row',
    icon: '🔥',
    unlocked: false,
  },
  {
    id: 'ach-4',
    title: 'Topic Champion',
    description: 'Complete an entire topic',
    icon: '⭐',
    unlocked: false,
  },
  {
    id: 'ach-5',
    title: 'Mathematics Expert',
    description: 'Complete all Mathematics topics',
    icon: '🧮',
    unlocked: false,
  },
  {
    id: 'ach-6',
    title: 'Physics Genius',
    description: 'Complete all Physics topics',
    icon: '🔬',
    unlocked: false,
  },
];
