// Popup script for Chaptr extension
const app = document.getElementById('app');

// Load user data on popup open
async function init() {
  try {
    // Get user from storage
    const { user } = await chrome.storage.local.get('user');

    if (!user || !user.id) {
      showAuthPrompt();
      return;
    }

    // Fetch latest credits
    const response = await chrome.runtime.sendMessage({ action: 'getCredits' });

    if (response.error) {
      if (response.requiresAuth) {
        showAuthPrompt();
      } else {
        showError(response.error);
      }
      return;
    }

    // Show dashboard
    showDashboard(response);

  } catch (error) {
    console.error('Init error:', error);
    showError(error.message);
  }
}

// Show authentication prompt
function showAuthPrompt() {
  app.innerHTML = `
    <div class="header">
      <div class="logo">⚡</div>
      <h1>Chaptr</h1>
      <p class="tagline">AI YouTube Chapters</p>
    </div>

    <div class="auth-prompt">
      <p style="margin-bottom: 15px;">Sign in to start chapterizing videos!</p>
      <p style="font-size: 13px; opacity: 0.9; margin-bottom: 10px;">
        Get 5 free credits on signup
      </p>
      <button class="primary-btn" id="signin-btn">Sign In</button>
    </div>

    <div class="earn-tips">
      <h3>💡 How it works:</h3>
      <ul>
        <li>Chapterize videos (1-3 credits)</li>
        <li>Post chapters as comments</li>
        <li>Earn +2 credits per comment</li>
        <li>Unlimited earning potential!</li>
      </ul>
    </div>
  `;

  document.getElementById('signin-btn').addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
      if (response.success) {
        init();
      }
    } catch (error) {
      showError('Authentication failed: ' + error.message);
    }
  });
}

// Show dashboard with user stats
function showDashboard(data) {
  const {
    balance,
    earned_lifetime,
    spent_lifetime,
    videos_chapterized,
    comments_posted
  } = data;

  app.innerHTML = `
    <div class="header">
      <div class="logo">⚡</div>
      <h1>Chaptr</h1>
      <p class="tagline">AI YouTube Chapters</p>
    </div>

    <div class="credits-box">
      <div class="credits-balance">${balance}</div>
      <div class="credits-label">Credits Available</div>
    </div>

    <div class="stats">
      <div class="stat-box">
        <div class="stat-value">${videos_chapterized || 0}</div>
        <div class="stat-label">Videos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${comments_posted || 0}</div>
        <div class="stat-label">Comments</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${earned_lifetime || 0}</div>
        <div class="stat-label">Earned</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${spent_lifetime || 0}</div>
        <div class="stat-label">Spent</div>
      </div>
    </div>

    <div class="actions">
      <button class="primary-btn" id="buy-credits-btn">💎 Purchase Credits</button>
      <button class="secondary-btn" id="visit-site-btn">🌐 Visit chaptr.app</button>
    </div>

    <div class="earn-tips">
      <h3>💡 Earn Free Credits:</h3>
      <ul>
        <li>Post chapters as comments: +2 credits</li>
        <li>Refer friends: +10 credits</li>
        <li>Share on social: Bonus credits</li>
      </ul>
    </div>
  `;

  // Add event listeners
  document.getElementById('buy-credits-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://chaptr.app/credits' });
  });

  document.getElementById('visit-site-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://chaptr.app' });
  });
}

// Show error message
function showError(message) {
  app.innerHTML = `
    <div class="header">
      <div class="logo">⚡</div>
      <h1>Chaptr</h1>
    </div>

    <div class="error">
      ⚠️ ${message}
    </div>

    <button class="primary-btn" onclick="init()">Retry</button>
  `;
}

// Initialize on load
init();
