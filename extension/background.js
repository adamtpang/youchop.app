// Background service worker for YouChop extension (MVP Demo Mode)
const API_URL = 'https://youchop.app'; // Update with your deployed Vercel URL
const DEMO_MODE = true; // Set to false when backend is ready

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chapterize') {
    handleChapterize(request.data)
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

// Demo authentication
async function authenticateUser() {
  if (DEMO_MODE) {
    // Create demo user
    const demoUser = {
      id: 'demo-user-' + Date.now(),
      email: 'demo@youchop.app',
      credits_balance: 10
    };
    await chrome.storage.local.set({ user: demoUser });
    return { success: true, user: demoUser };
  }

  // Real authentication (when backend is ready)
  try {
    const { user } = await chrome.storage.local.get('user');
    if (user && user.id) {
      return { success: true, user };
    }

    const authUrl = `${API_URL}/auth/extension`;
    const tab = await chrome.tabs.create({ url: authUrl });

    return new Promise((resolve) => {
      chrome.runtime.onMessage.addListener(function listener(msg) {
        if (msg.action === 'authComplete') {
          chrome.tabs.remove(tab.id);
          chrome.runtime.onMessage.removeListener(listener);
          resolve({ success: true, user: msg.user });
        }
      });
    });
  } catch (error) {
    throw error;
  }
}

// Demo chapterization
async function handleChapterize(data) {
  const { videoId, duration } = data;

  if (DEMO_MODE) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate demo chapters
    const demoChapters = [
      { timestamp: "00:00", title: "Introduction", description: "Overview of the video content" },
      { timestamp: "02:30", title: "Main Topic Begins", description: "Diving into the core subject matter" },
      { timestamp: "05:45", title: "Key Points", description: "Important details and examples" },
      { timestamp: "08:20", title: "Advanced Concepts", description: "More in-depth exploration" },
      { timestamp: "11:00", title: "Conclusion", description: "Summary and final thoughts" }
    ];

    // Get user and simulate credit deduction
    const { user } = await chrome.storage.local.get('user');
    if (user) {
      user.credits_balance = Math.max(0, user.credits_balance - 1);
      await chrome.storage.local.set({ user });
    }

    return {
      success: true,
      chapters: demoChapters,
      creditsRemaining: user?.credits_balance || 0,
      wasCached: false,
      videoTitle: 'Demo Video'
    };
  }

  // Real API call (when backend is ready)
  try {
    const { user } = await chrome.storage.local.get('user');
    if (!user || !user.id) {
      return { error: 'Not authenticated', requiresAuth: true };
    }

    const response = await fetch(`${API_URL}/api/chapterize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    throw error;
  }
}

// Get user credits
async function getCredits() {
  if (DEMO_MODE) {
    const { user } = await chrome.storage.local.get('user');
    if (!user) {
      return { error: 'Not authenticated', requiresAuth: true };
    }

    return {
      balance: user.credits_balance || 10,
      earned_lifetime: 10,
      spent_lifetime: 0,
      videos_chapterized: 0,
      comments_posted: 0
    };
  }

  // Real API call
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
    user.credits_balance = result.balance;
    await chrome.storage.local.set({ user });

    return result;
  } catch (error) {
    throw error;
  }
}

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    if (DEMO_MODE) {
      // Auto-create demo user
      const demoUser = {
        id: 'demo-user-' + Date.now(),
        email: 'demo@youchop.app',
        credits_balance: 10
      };
      chrome.storage.local.set({ user: demoUser });
    } else {
      chrome.tabs.create({ url: `${API_URL}/welcome` });
    }
  }
});

console.log('Chaptr background worker loaded', DEMO_MODE ? '(DEMO MODE)' : '(PRODUCTION)');
