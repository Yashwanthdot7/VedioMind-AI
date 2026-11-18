import { Lesson, LessonLayout, LessonQuizQuestion, LessonScene } from '../types';

/**
 * Ready-made lessons that ship with the site, so a first visit can watch one straight away:
 * no waiting, no AI quota, no account. They use the drawn slides and the browser's voice.
 */

type SceneInput = Partial<LessonScene> & { layout: LessonLayout; icon: string; heading: string; narration: string };

const scene = (s: SceneInput): LessonScene => ({
  bullets: [], highlight: '', leftTitle: '', left: [], rightTitle: '', right: [], audio: null, duration: null, image: null, imageStatus: 'skipped', ...s,
});

const q = (question: string, options: string[], answerIndex: number, explanation: string, difficulty: 'easy' | 'medium' | 'hard', sceneNo: number): LessonQuizQuestion => ({
  question, options, answerIndex, explanation, difficulty, scene: sceneNo, timestamp: '',
});

function sample(id: string, title: string, scenes: LessonScene[], quiz: LessonQuizQuestion[]): Lesson {
  return {
    id: `sample-${id}`,
    title,
    status: 'done',
    progress: 100,
    language: 'en',
    audience: 'student',
    length: 'short',
    voice: 'browser',
    voiceMode: 'browser',
    visuals: 'slides',
    source: 'text',
    sourceVideo: null,
    scenes,
    quiz,
    quizKind: 'quick',
    durationSec: null,
    error: null,
    createdAt: '2026-11-18T00:00:00.000Z',
    sample: true,
  };
}

export const SAMPLE_LESSONS: Record<string, Lesson> = {
  Photosynthesis: sample('photosynthesis', 'Photosynthesis', [
    scene({ layout: 'title', icon: '🌱', heading: 'How plants make food', narration: 'Plants don\'t eat the way we do. They make their own food out of sunlight, water and air. This process is called photosynthesis. Let\'s see how it works.' }),
    scene({ layout: 'bullets', icon: '🧪', heading: 'The ingredients', narration: 'A plant needs three things. Water comes up from the roots. Carbon dioxide enters through tiny holes in the leaves. And sunlight gives the energy to put them together.', bullets: ['Water from the roots', 'Carbon dioxide from the air', 'Energy from sunlight'] }),
    scene({ layout: 'fact', icon: '🍃', heading: 'Why leaves are green', narration: 'Leaves contain a pigment called chlorophyll. It soaks up red and blue light, but reflects green light back to our eyes. That is why most leaves look green.', highlight: 'Chlorophyll' }),
    scene({ layout: 'steps', icon: '⚙️', heading: 'Two stages', narration: 'First, light energy splits water, which releases oxygen. Then, in the Calvin cycle, the plant uses that stored energy to turn carbon dioxide into glucose, a kind of sugar.', bullets: ['Light splits water and releases oxygen', 'The Calvin cycle turns carbon dioxide into glucose'] }),
    scene({ layout: 'compare', icon: '🔁', heading: 'What goes in, what comes out', narration: 'So carbon dioxide and water go in, with light as the energy. Glucose and oxygen come out. The oxygen we breathe comes from plants splitting water.', leftTitle: 'In', left: ['Carbon dioxide', 'Water', 'Sunlight'], rightTitle: 'Out', right: ['Glucose', 'Oxygen'] }),
    scene({ layout: 'summary', icon: '✅', heading: 'Remember', narration: 'Photosynthesis turns light, water and carbon dioxide into food and oxygen. Almost every food chain on Earth starts with it, including the one that ends on your plate.', bullets: ['Chlorophyll captures light', 'Water is split, oxygen is released', 'Carbon dioxide becomes glucose'] }),
  ], [
    q('What gives a plant the energy for photosynthesis?', ['Soil', 'Sunlight', 'Rain', 'Wind'], 1, 'Sunlight provides the energy that joins water and carbon dioxide.', 'easy', 2),
    q('Why do most leaves look green?', ['They absorb green light', 'Chlorophyll reflects green light', 'They contain green water', 'Sunlight is green'], 1, 'Chlorophyll absorbs red and blue light and reflects green.', 'easy', 3),
    q('Where does the oxygen released by plants come from?', ['Carbon dioxide', 'Glucose', 'Splitting water', 'The soil'], 2, 'Light energy splits water molecules, which releases oxygen.', 'medium', 4),
    q('What does the Calvin cycle make?', ['Oxygen', 'Water', 'Glucose', 'Chlorophyll'], 2, 'The Calvin cycle uses stored energy to turn carbon dioxide into glucose.', 'medium', 4),
    q('Which of these goes INTO photosynthesis?', ['Oxygen', 'Glucose', 'Carbon dioxide', 'Starch'], 2, 'Carbon dioxide and water go in; glucose and oxygen come out.', 'hard', 5),
  ]),

  'The water cycle': sample('water-cycle', 'The water cycle', [
    scene({ layout: 'title', icon: '💧', heading: 'The journey of a drop', narration: 'The water you drink today may have fallen as rain on a mountain, or floated in the sea, years ago. Water keeps moving around our planet in a loop called the water cycle.' }),
    scene({ layout: 'bullets', icon: '☀️', heading: 'Evaporation', narration: 'The Sun warms oceans, lakes and rivers. Some water turns into invisible water vapour and rises into the air. Plants also release water vapour from their leaves.', bullets: ['The Sun heats the water', 'Water turns into vapour', 'Plants add vapour too'] }),
    scene({ layout: 'fact', icon: '☁️', heading: 'Condensation', narration: 'High up, the air is cooler. The vapour cools and turns back into tiny droplets around specks of dust. Billions of these droplets together make a cloud.', highlight: 'Clouds are tiny droplets' }),
    scene({ layout: 'steps', icon: '🌧️', heading: 'Precipitation', narration: 'Droplets bump into each other and grow. When they are too heavy to float, they fall as rain, or as snow or hail if the air is cold enough.', bullets: ['Droplets join and grow', 'Heavy drops fall', 'Rain, snow or hail'] }),
    scene({ layout: 'compare', icon: '🏞️', heading: 'Where the water goes', narration: 'Some rain runs over the ground into rivers and back to the sea. Some soaks into the soil and becomes groundwater, which can stay underground for thousands of years.', leftTitle: 'Runoff', left: ['Streams and rivers', 'Back to the sea'], rightTitle: 'Groundwater', right: ['Soaks into soil', 'Feeds wells'] }),
    scene({ layout: 'summary', icon: '✅', heading: 'The loop', narration: 'Evaporation, condensation, precipitation and collection, again and again. The same water has been going round this loop for billions of years.', bullets: ['Evaporation', 'Condensation', 'Precipitation', 'Collection'] }),
  ], [
    q('What powers evaporation?', ['The Moon', 'The Sun\'s heat', 'Wind only', 'Clouds'], 1, 'The Sun warms water so it turns into vapour.', 'easy', 2),
    q('What is a cloud made of?', ['Smoke', 'Water vapour you can see', 'Tiny water droplets', 'Dust only'], 2, 'Vapour cools into tiny droplets; billions of them make a cloud.', 'easy', 3),
    q('What is it called when water falls from clouds?', ['Evaporation', 'Condensation', 'Precipitation', 'Transpiration'], 2, 'Rain, snow and hail are all precipitation.', 'easy', 4),
    q('Why does vapour turn into droplets high up?', ['The air is cooler', 'The air is hotter', 'Clouds pull it', 'Birds stir it'], 0, 'Cooler air makes vapour condense into droplets.', 'medium', 3),
    q('What is water stored in the soil and rocks called?', ['Runoff', 'Groundwater', 'Vapour', 'Ice caps'], 1, 'Water that soaks in becomes groundwater.', 'medium', 5),
  ]),

  'How computers store numbers': sample('binary', 'How computers store numbers', [
    scene({ layout: 'title', icon: '💻', heading: 'Inside the switch', narration: 'A computer has no tiny digits written inside it. It is built from billions of switches called transistors. So how does it remember a number like two hundred and fifty five?' }),
    scene({ layout: 'fact', icon: '🔌', heading: 'Bits', narration: 'Each switch is either off or on. We write off as zero and on as one. One of these zeros or ones is called a bit, short for binary digit.', highlight: '0 = off, 1 = on' }),
    scene({ layout: 'steps', icon: '🔢', heading: 'Counting in binary', narration: 'In binary, each place is worth double the one to its right: ones, twos, fours, eights. So one zero one means one four, no twos and one one. That makes five.', bullets: ['Places: 8, 4, 2, 1', '101 = 4 + 0 + 1', '101 in binary = 5'] }),
    scene({ layout: 'bullets', icon: '📦', heading: 'Bytes', narration: 'Eight bits make a byte. A byte can hold two hundred and fifty six different values, from zero to two hundred and fifty five. That is why colours often go from zero to two fifty five.', bullets: ['8 bits = 1 byte', '256 values: 0 to 255', 'Used in colour codes'] }),
    scene({ layout: 'compare', icon: '🔤', heading: 'Not just numbers', narration: 'Text is numbers too. Every character has a code. In Unicode, letters from Hindi, Tamil and every other script get their own numbers, so computers can store any language.', leftTitle: 'Character', left: ['A', 'अ'], rightTitle: 'Unicode number', right: ['65', '2309'] }),
    scene({ layout: 'summary', icon: '✅', heading: 'Remember', narration: 'Switches make bits, bits make bytes, and clever codes turn bytes into numbers, text and colours. Everything on your screen is ones and zeros underneath.', bullets: ['Bit: 0 or 1', 'Byte: 8 bits, 0 to 255', 'Unicode stores every script'] }),
  ], [
    q('What is a bit?', ['A tiny chip', 'A single 0 or 1', 'Eight switches', 'A letter'], 1, 'A bit is one binary digit: 0 or 1.', 'easy', 2),
    q('What is 101 in binary as a normal number?', ['3', '5', '101', '7'], 1, '4 + 0 + 1 = 5.', 'medium', 3),
    q('How many bits are in a byte?', ['2', '4', '8', '16'], 2, 'A byte is eight bits.', 'easy', 4),
    q('What is the largest number one byte can hold?', ['8', '100', '255', '256'], 2, '256 values, from 0 up to 255.', 'medium', 4),
    q('How do computers store letters from many languages?', ['They can\'t', 'With Unicode numbers', 'As pictures only', 'In separate chips'], 1, 'Unicode gives every character in every script a number.', 'hard', 5),
  ]),
};

export const sampleFor = (topic: string): Lesson | null => SAMPLE_LESSONS[topic] ?? null;
