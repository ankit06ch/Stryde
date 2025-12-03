const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface WorkoutData {
  eventName: string;
  result: number;
  timestamp: any;
  distance?: number;
  duration?: number;
  steps?: number;
}

export const getAIInsights = async (workouts: WorkoutData[], stats: {
  totalWorkouts: number;
  personalRecords: number;
  thisWeekWorkouts: number;
  bestEvent: string | null;
}): Promise<string> => {
  try {
    // Prepare workout summary for Gemini
    const recentWorkouts = workouts.slice(0, 10).map(w => ({
      event: w.eventName || w.eventId || 'Unknown',
      result: w.result,
      date: w.timestamp?.toDate ? w.timestamp.toDate().toLocaleDateString() : 'Unknown',
      distance: w.distance,
      duration: w.duration,
      steps: w.steps,
    }));

    const prompt = `You are an expert track and field coach analyzing an athlete's performance data. Provide 2-3 concise, actionable insights based on this data:

Athlete Stats:
- Total Workouts: ${stats.totalWorkouts}
- Personal Records: ${stats.personalRecords}
- This Week's Workouts: ${stats.thisWeekWorkouts}
- Most Practiced Event: ${stats.bestEvent || 'N/A'}

Recent Workouts:
${JSON.stringify(recentWorkouts, null, 2)}

Provide insights in this format:
1. [Insight about performance trends or patterns]
2. [Insight about areas for improvement or strengths]
3. [Insight about training recommendations]

Keep each insight to 1-2 sentences. Be encouraging but honest. Focus on actionable advice for track and field athletes.`;

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error response:', errorData);
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data, null, 2));
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Invalid response from Gemini API');
  } catch (error: any) {
    console.error('Error fetching AI insights:', error);
    // Return a fallback message if API fails
    return 'Unable to generate insights at this time. Keep training hard!';
  }
};

export interface MentalNote {
  note: string;
  timestamp: any;
}

export const getMentalNotesInsights = async (mentalNotes: MentalNote[]): Promise<string> => {
  try {
    // Prepare mental notes summary for Gemini
    const recentNotes = mentalNotes.slice(-10).map(note => ({
      text: note.note,
      date: note.timestamp?.toDate ? note.timestamp.toDate().toLocaleDateString() : 'Unknown',
    }));

    const prompt = `You are a mental wellness and performance coach analyzing an athlete's mental notes and reflections. Provide 2-3 concise, supportive insights that offer mental clarity and perspective:

Mental Notes History:
${JSON.stringify(recentNotes, null, 2)}

Provide insights in this format:
1. [Insight about patterns, emotions, or mental state]
2. [Insight about growth, resilience, or positive observations]
3. [Insight about actionable mental strategies or encouragement]

Keep each insight to 1-2 sentences. Be empathetic, supportive, and focus on mental clarity, emotional awareness, and personal growth. Help the athlete understand their mental journey and offer perspective.`;

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error response:', errorData);
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data, null, 2));
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Invalid response from Gemini API');
  } catch (error: any) {
    console.error('Error fetching mental notes insights:', error);
    // Return a fallback message if API fails
    return 'Unable to generate mental clarity insights at this time. Keep reflecting and growing!';
  }
};

