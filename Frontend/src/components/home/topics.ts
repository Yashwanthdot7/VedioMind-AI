import { Atom, Calculator, Cpu, Globe2, Landmark, Languages, Leaf, Droplets, type LucideIcon } from 'lucide-react';

export interface SampleCard {
  topic: string;
  subject: string;
  blurb: string;
  icon: LucideIcon;
}

/** The three ready-made lessons on the home page (they play at once) */
export const SAMPLES: SampleCard[] = [
  { topic: 'Photosynthesis', subject: 'Biology', blurb: 'How plants turn sunlight, water and air into food.', icon: Leaf },
  { topic: 'The water cycle', subject: 'Earth science', blurb: 'Evaporation, clouds and rain, as the journey of one drop.', icon: Droplets },
  { topic: 'How computers store numbers', subject: 'Computer science', blurb: 'Bits, bytes and binary, and why 0.1 + 0.2 isn\'t 0.3.', icon: Cpu },
];

export interface Subject {
  name: string;
  topics: string[];
  icon: LucideIcon;
}

/** Subjects with starter topics; each topic opens the lesson form */
export const SUBJECTS: Subject[] = [
  { name: 'Science', topics: ['Newton\'s laws of motion', 'The human heart', 'Acids and bases'], icon: Atom },
  { name: 'Mathematics', topics: ['Fractions made easy', 'Pythagoras\' theorem', 'What is probability?'], icon: Calculator },
  { name: 'History', topics: ['Causes of the French Revolution', 'The Indus Valley civilisation', 'Why the Mughal empire grew'], icon: Landmark },
  { name: 'Languages', topics: ['Tenses in English', 'Hindi vowels and matras', 'How to write a formal letter'], icon: Languages },
  { name: 'Computer science', topics: ['What is an algorithm?', 'How the internet works', 'Loops in Python'], icon: Cpu },
  { name: 'Earth and space', topics: ['How volcanoes work', 'Why we have seasons', 'The solar system'], icon: Globe2 },
];
