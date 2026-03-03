import { VideoData, Message } from './types';

export const mockVideoData: VideoData = {
  videoId: 'dQw4w9WgXcQ',
  title: 'The Future of AI and Machine Learning',
  transcript: [
    {
      timestamp: '0:00',
      seconds: 0,
      text: 'Welcome to this deep dive into the future of artificial intelligence and machine learning.',
    },
    {
      timestamp: '0:15',
      seconds: 15,
      text: 'Today, we\'re seeing unprecedented advances in neural networks and deep learning architectures.',
    },
    {
      timestamp: '0:32',
      seconds: 32,
      text: 'Large language models have transformed how we interact with computers and process information.',
    },
    {
      timestamp: '0:48',
      seconds: 48,
      text: 'The key to these advances lies in the combination of computational power, data availability, and algorithmic innovation.',
    },
    {
      timestamp: '1:05',
      seconds: 65,
      text: 'Computer vision has also made remarkable progress, enabling applications from autonomous vehicles to medical diagnosis.',
    },
    {
      timestamp: '1:22',
      seconds: 82,
      text: 'Looking ahead, we can expect AI to become even more integrated into our daily lives and work processes.',
    },
    {
      timestamp: '1:38',
      seconds: 98,
      text: 'The ethical considerations around AI development are becoming increasingly important as these systems grow more powerful.',
    },
    {
      timestamp: '1:55',
      seconds: 115,
      text: 'Thank you for joining me on this exploration of AI\'s future. The possibilities are truly endless.',
    },
  ],
  summary: `This video provides an **insightful overview** of the current state and future trajectory of artificial intelligence and machine learning.

The presenter discusses how *neural networks* and *deep learning* architectures have evolved, highlighting the transformative impact of large language models on human-computer interaction.

Key technological enablers include:
- Massive computational resources
- Vast datasets for training
- Innovative algorithmic approaches

The video also touches on **computer vision advances** and their applications in critical domains like autonomous driving and healthcare. The discussion concludes with important considerations about AI ethics and responsible development.`,
  keyTakeaways: [
    'AI and ML are experiencing unprecedented growth and innovation',
    'Large language models are revolutionizing human-computer interaction',
    'Computer vision enables breakthrough applications in multiple industries',
    'Ethical AI development is crucial as systems become more powerful',
    'The future promises deeper integration of AI in daily life',
  ],
};

export const mockMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hello! I\'ve analyzed this video. Feel free to ask me anything about the content.',
    timestamp: new Date(),
  },
];