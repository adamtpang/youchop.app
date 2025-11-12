import Anthropic from '@anthropic-ai/sdk';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Chapter {
  timestamp: string;
  title: string;
  description: string;
}

export interface ChapterizeResult {
  chapters: Chapter[];
  transcript_source: 'youtube_native' | 'whisper_generated';
}

/**
 * Get transcript for a YouTube video
 */
async function getTranscript(videoId: string): Promise<{ text: string; source: 'youtube_native' | 'whisper_generated' }> {
  try {
    // Try to get YouTube native transcript first
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    const text = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
      .replace(/\s+/g, ' ')
      .trim();

    return {
      text,
      source: 'youtube_native'
    };
  } catch (error) {
    console.log('YouTube transcript not available, falling back to Whisper');

    // Fallback to Whisper API
    // Note: This requires downloading the audio first
    // For MVP, we'll throw an error. Implement audio download + Whisper in Phase 2
    throw new Error('YouTube transcript not available and Whisper fallback not yet implemented');
  }
}

/**
 * Chapterize a video using Claude API
 */
export async function chapterizeVideo(
  videoId: string,
  title: string,
  durationSeconds: number
): Promise<ChapterizeResult> {
  // Get transcript
  const { text: transcript, source } = await getTranscript(videoId);

  if (!transcript || transcript.length < 100) {
    throw new Error('Transcript too short or unavailable');
  }

  // Truncate very long transcripts to stay within token limits
  const maxTranscriptLength = 50000; // ~12k tokens
  const truncatedTranscript = transcript.length > maxTranscriptLength
    ? transcript.substring(0, maxTranscriptLength) + '...'
    : transcript;

  // Create chapterization prompt
  const prompt = `Analyze this YouTube video transcript and create a chapter structure with timestamps.

Video Title: ${title}
Duration: ${formatDuration(durationSeconds)}
Transcript: ${truncatedTranscript}

Create 5-15 chapters that:
1. Identify natural topic transitions
2. Have descriptive, engaging titles (5-8 words max)
3. Include brief 1-sentence descriptions
4. Are spaced at least 2 minutes apart (unless natural breaks)
5. Start with 00:00 timestamp

Return ONLY valid JSON:
{
  "chapters": [
    {
      "timestamp": "00:00",
      "title": "Introduction to Main Topic",
      "description": "Brief overview of what this section covers"
    }
  ]
}

No markdown, no code blocks, just JSON.`;

  try {
    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (in case Claude adds markdown)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const result = JSON.parse(jsonText);

    if (!result.chapters || !Array.isArray(result.chapters)) {
      throw new Error('Invalid chapter format returned by AI');
    }

    // Validate chapters
    const validatedChapters = result.chapters.map((ch: any) => ({
      timestamp: ch.timestamp || '00:00',
      title: (ch.title || 'Untitled Chapter').substring(0, 100),
      description: (ch.description || '').substring(0, 200)
    }));

    return {
      chapters: validatedChapters,
      transcript_source: source
    };

  } catch (error: any) {
    console.error('Chapterization error:', error);
    throw new Error(`Failed to chapterize video: ${error.message}`);
  }
}

/**
 * Format duration seconds to HH:MM:SS or MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate credit cost based on video duration
 */
export function calculateCreditCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  if (minutes < 15) return 1;
  if (minutes < 60) return 2;
  return 3;
}
