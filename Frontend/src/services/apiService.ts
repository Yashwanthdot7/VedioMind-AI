// src/services/apiService.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function processVideo(url: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/video/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to process video');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
}

export async function askQuestion(question: string, videoContext: any) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, videoContext }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to get answer');
    }

    const data = await response.json();
    return data.answer;
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
}