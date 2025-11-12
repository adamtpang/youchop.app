import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Get video details from YouTube API
 */
export async function getVideoDetails(videoId: string) {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'snippet,contentDetails',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = response.data.items[0];

    return {
      title: video.snippet.title,
      duration: parseDuration(video.contentDetails.duration),
      channelTitle: video.snippet.channelTitle
    };
  } catch (error: any) {
    console.error('YouTube API error:', error);
    throw new Error(`Failed to fetch video details: ${error.message}`);
  }
}

/**
 * Post a comment on a YouTube video
 */
export async function postComment(
  videoId: string,
  commentText: string,
  accessToken: string
) {
  try {
    const response = await axios.post(
      `${YOUTUBE_API_BASE}/commentThreads`,
      {
        snippet: {
          videoId: videoId,
          topLevelComment: {
            snippet: {
              textOriginal: commentText
            }
          }
        }
      },
      {
        params: {
          part: 'snippet'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      commentId: response.data.id
    };
  } catch (error: any) {
    console.error('Comment posting error:', error);

    if (error.response?.status === 403) {
      throw new Error('Comments are disabled for this video or you do not have permission');
    }

    throw new Error(`Failed to post comment: ${error.message}`);
  }
}

/**
 * Parse ISO 8601 duration to seconds
 * Example: PT1H2M30S = 3750 seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format chapters for YouTube comment
 */
export function formatChapterComment(chapters: any[]): string {
  let comment = '📑 **Chapters:**\n\n';

  chapters.forEach(chapter => {
    comment += `${chapter.timestamp} - ${chapter.title}\n`;
  });

  comment += '\n---\n⚡ Auto-chapterized by chaptr.app - Get the extension!';

  return comment;
}
