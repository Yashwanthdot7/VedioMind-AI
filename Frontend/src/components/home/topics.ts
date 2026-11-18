import { Atom, Calculator, Cpu, Globe2, Landmark, Languages, Mountain, Droplets, Leaf } from 'lucide-react';
import type { WorldTheme } from '../art/WorldTile';

export interface ShowcaseTopic {
  topic: string;
  tags: string[];
  blurb: string;
  theme: WorldTheme;
}

/** Ready-made lessons for the showcase carousel */
export const SHOWCASE: ShowcaseTopic[] = [
  { topic: 'Photosynthesis', tags: ['Popular', 'Science'], blurb: 'How plants turn sunlight, water and air into food, in about a minute, with a quiz at the end.', theme: { from: '#3EBDD4', to: '#7CF2A0', icon: Leaf, seed: 3 } },
  { topic: 'The water cycle', tags: ['For kids', 'Science'], blurb: 'Evaporation, clouds, rain and rivers, told as one journey of a single drop of water.', theme: { from: '#1E9FB8', to: '#8A4FD6', icon: Droplets, seed: 21 } },
  { topic: 'How computers store numbers', tags: ['New', 'Computer science'], blurb: 'Bits, bytes and binary, and why 0.1 + 0.2 is not quite 0.3.', theme: { from: '#8A4FD6', to: '#3EBDD4', icon: Cpu, seed: 34 } },
  { topic: 'Causes of the French Revolution', tags: ['History'], blurb: 'Debt, bread prices and new ideas: why France boiled over in 1789.', theme: { from: '#00E5FF', to: '#F6A04D', icon: Landmark, seed: 55 } },
  { topic: 'How volcanoes work', tags: ['Earth science'], blurb: 'From magma deep underground to eruptions, and why people still farm beside them.', theme: { from: '#F6A04D', to: '#00E5FF', icon: Mountain, seed: 89 } },
];

export interface World {
  name: string;
  topics: string[];
  theme: WorldTheme;
}

/** Subjects shown as worlds; each topic starts a lesson */
export const WORLDS: World[] = [
  { name: 'Science', topics: ['Photosynthesis', 'Newton\'s laws of motion', 'The human heart'], theme: { from: '#3EBDD4', to: '#7CF2A0', icon: Atom, seed: 5 } },
  { name: 'Mathematics', topics: ['Fractions made easy', 'Pythagoras\' theorem', 'What is probability?'], theme: { from: '#8A4FD6', to: '#C29BF5', icon: Calculator, seed: 13 } },
  { name: 'History', topics: ['Causes of the French Revolution', 'The Indus Valley civilisation', 'Why the Mughal empire grew'], theme: { from: '#00E5FF', to: '#F6A04D', icon: Landmark, seed: 29 } },
  { name: 'Languages', topics: ['Tenses in English', 'Hindi vowels and matras', 'How to write a formal letter'], theme: { from: '#8FF7FF', to: '#8A4FD6', icon: Languages, seed: 47 } },
  { name: 'Computer science', topics: ['How computers store numbers', 'What is an algorithm?', 'How the internet works'], theme: { from: '#1E9FB8', to: '#8A4FD6', icon: Cpu, seed: 61 } },
  { name: 'Earth and space', topics: ['How volcanoes work', 'The water cycle', 'Why we have seasons'], theme: { from: '#F6A04D', to: '#3EBDD4', icon: Globe2, seed: 77 } },
];
