// Background service worker for Chaptr extension
const API_URL = 'https://chaptr.app'; // Change to your production URL

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chapterize') {
    handleChapterize(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'postComment') {
    handlePostComment(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getCredits') {
    getCredits()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'authenticate') {
    authenticateUser()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Authenticate user with Supabase
async function authenticateUser() {
  try {
    const { user } = await chrome.storage.local.get('user');

    if (user && user.id) {
      return { success: true, user };
    }

    // Open authentication page
    const authUrl = `${API_URL}/auth/extension`;
    const tab = await chrome.tabs.create({ url: authUrl });

    return new Promise((resolve) => {
      // Listen for auth completion
      chrome.runtime.onMessage.addListener(function listener(msg) {
        if (msg.action === 'authComplete') {
          chrome.tabs.remove(tab.id);
          chrome.runtime.onMessage.removeListener(listener);
          resolve({ success: true, user: msg.user });
        }
      });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Handle chapterization request
async function handleChapterize(data) {
  const { videoId, duration } = data;

  try {
    // Get user from storage
    const { user } = await chrome.storage.local.get('user');

    if (!user || !user.id) {
      return { error: 'Not authenticated', requiresAuth: true };
    }

    // Call API
    const response = await fetch(`${API_URL}/api/chapterize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        user_id: user.id,
        duration_seconds: duration
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Chapterization failed');
    }

    const result = await response.json();

    // Update credits in storage
    if (result.credits_remaining !== undefined) {
      user.credits_balance = result.credits_remaining;
      await chrome.storage.local.set({ user });
    }

    return {
      success: true,
      chapters: result.chapters,
      creditsRemaining: result.credits_remaining,
      wasCached: result.was_cached,
      videoTitle: result.video_title
    };
  } catch (error) {
    console.error('Chapterization error:', error);
    throw error;
  }
}

// Handle comment posting
async function handlePostComment(data) {
  const { videoId, chapters } = data;

  try {
    // Get user and YouTube token
    const { user } = await chrome.storage.local.get('user');

    if (!user || !user.id) {
      return { error: 'Not authenticated', requiresAuth: true };
    }

    // Get YouTube OAuth token
    const token = await getYouTubeToken();

    // Format comment
    const comment = formatChapterComment(chapters);

    // Call API to post comment
    const response = await fetch(`${API_URL}/api/comment/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
        user_id: user.id,
        chapters,
        youtube_token: token
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Comment posting failed');
    }

    const result = await response.json();

    // Update credits
    user.credits_balance = result.new_credit_balance;
    await chrome.storage.local.set({ user });

    return {
      success: true,
      newCreditBalance: result.new_credit_balance,
      creditsEarned: result.credits_earned
    };
  } catch (error) {
    console.error('Comment posting error:', error);
    throw error;
  }
}

// Get YouTube OAuth token
async function getYouTubeToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Format chapters for comment
function formatChapterComment(chapters) {
  let comment = '📑 **Chapters:**\n\n';

  chapters.forEach(chapter => {
    comment += `${chapter.timestamp} - ${chapter.title}\n`;
  });

  comment += '\n---\n⚡ Auto-chapterized by chaptr.app - Get the extension!';

  return comment;
}

// Get user credits
async function getCredits() {
  try {
    const { user } = await chrome.storage.local.get('user');

    if (!user || !user.id) {
      return { error: 'Not authenticated', requiresAuth: true };
    }

    const response = await fetch(`${API_URL}/api/user/credits?user_id=${user.id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch credits');
    }

    const result = await response.json();

    // Update local storage
    user.credits_balance = result.balance;
    await chrome.storage.local.set({ user });

    return result;
  } catch (error) {
    console.error('Get credits error:', error);
    throw error;
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({ url: `${API_URL}/welcome` });
  }
});
