// Content script for YouTube pages
console.log('Chaptr extension loaded');

let userCredits = null;
let currentVideoId = null;
let videoData = null;

// Initialize extension
async function init() {
  // Wait for YouTube player to load
  await waitForElement('.ytp-right-controls');

  // Get current video ID
  currentVideoId = getVideoId();

  if (!currentVideoId) return;

  // Get video duration
  const duration = await getVideoDuration();

  videoData = {
    videoId: currentVideoId,
    duration: duration,
    title: document.title.replace(' - YouTube', '')
  };

  // Fetch user credits
  await fetchCredits();

  // Add Chapterize button
  addChapterizeButton();

  // Listen for video changes (YouTube SPA)
  observeUrlChanges();
}

// Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Element not found'));
    }, timeout);
  });
}

// Get current video ID from URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Get video duration in seconds
async function getVideoDuration() {
  const player = document.querySelector('video');
  if (player) {
    return Math.floor(player.duration);
  }
  return 0;
}

// Fetch user credits
async function fetchCredits() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCredits'
    });

    if (response.error) {
      if (response.requiresAuth) {
        userCredits = null;
      }
      return;
    }

    userCredits = response.balance;
  } catch (error) {
    console.error('Failed to fetch credits:', error);
  }
}

// Calculate credit cost based on duration
function calculateCreditCost(durationSeconds) {
  const minutes = durationSeconds / 60;
  if (minutes < 15) return 1;
  if (minutes < 60) return 2;
  return 3;
}

// Add Chapterize button to YouTube controls
function addChapterizeButton() {
  // Check if button already exists
  if (document.querySelector('#chaptr-button')) return;

  const rightControls = document.querySelector('.ytp-right-controls');
  if (!rightControls) return;

  const creditCost = calculateCreditCost(videoData.duration);

  // Create button
  const button = document.createElement('button');
  button.id = 'chaptr-button';
  button.className = 'ytp-button chaptr-button';

  // Determine button state
  let buttonText = '';
  let buttonTitle = '';
  let isDisabled = false;

  if (userCredits === null) {
    buttonText = '⚡ Chapterize';
    buttonTitle = 'Sign in to chapterize this video';
  } else if (userCredits < creditCost) {
    buttonText = `⚡ Chapterize (Need ${creditCost - userCredits} more)`;
    buttonTitle = `Insufficient credits. You need ${creditCost} credits but have ${userCredits}.`;
    isDisabled = true;
  } else {
    buttonText = `⚡ Chapterize (${creditCost} credits)`;
    buttonTitle = `Chapterize this video for ${creditCost} credit${creditCost > 1 ? 's' : ''}. Balance: ${userCredits}`;
  }

  button.innerHTML = `<span style="font-size: 18px; padding: 0 10px;">${buttonText}</span>`;
  button.title = buttonTitle;
  button.disabled = isDisabled;

  if (isDisabled) {
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
  }

  button.addEventListener('click', handleChapterizeClick);

  // Insert before first button in right controls
  rightControls.insertBefore(button, rightControls.firstChild);
}

// Handle Chapterize button click
async function handleChapterizeClick(e) {
  e.stopPropagation();

  const button = e.currentTarget;

  // Check if user is authenticated
  if (userCredits === null) {
    showAuthModal();
    return;
  }

  // Check credits
  const creditCost = calculateCreditCost(videoData.duration);
  if (userCredits < creditCost) {
    showInsufficientCreditsModal(creditCost);
    return;
  }

  // Disable button and show loading
  button.disabled = true;
  button.innerHTML = '<span style="font-size: 18px; padding: 0 10px;">⏳ Chapterizing...</span>';

  try {
    // Send chapterize request
    const response = await chrome.runtime.sendMessage({
      action: 'chapterize',
      data: videoData
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Update credits
    userCredits = response.creditsRemaining;

    // Show success modal
    showChaptersModal(response);

  } catch (error) {
    console.error('Chapterization failed:', error);
    alert(`Failed to chapterize video: ${error.message}`);
  } finally {
    // Re-enable button
    button.disabled = false;
    const creditCost = calculateCreditCost(videoData.duration);
    button.innerHTML = `<span style="font-size: 18px; padding: 0 10px;">⚡ Chapterize (${creditCost} credits)</span>`;
  }
}

// Show authentication modal
function showAuthModal() {
  const modal = createModal(`
    <div style="text-align: center; padding: 20px;">
      <h2 style="margin-bottom: 15px;">Welcome to Chaptr!</h2>
      <p style="margin-bottom: 20px;">Sign in to get 5 free credits and start chapterizing videos.</p>
      <button id="chaptr-auth-btn" style="
        background: #ff0000;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 4px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
      ">Sign In & Get 5 Free Credits</button>
    </div>
  `);

  document.getElementById('chaptr-auth-btn').addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
      if (response.success) {
        userCredits = response.user.credits_balance;
        modal.remove();
        addChapterizeButton();
      }
    } catch (error) {
      alert('Authentication failed: ' + error.message);
    }
  });
}

// Show insufficient credits modal
function showInsufficientCreditsModal(required) {
  const modal = createModal(`
    <div style="padding: 20px; text-align: center;">
      <h2 style="margin-bottom: 15px;">Need More Credits</h2>
      <p style="margin-bottom: 15px;">You need ${required} credits but have ${userCredits}.</p>

      <div style="margin: 20px 0;">
        <h3 style="margin-bottom: 10px;">💡 Earn Credits FREE</h3>
        <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
          Chapterize videos and post as comments to earn +2 credits each time!
        </p>
      </div>

      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3 style="margin-bottom: 10px;">💎 Or Purchase Credits</h3>
        <div style="text-align: left; margin: 15px 0;">
          <div style="margin: 8px 0;">$5 = 25 credits (~10 hours)</div>
          <div style="margin: 8px 0; font-weight: bold;">⭐ $10 = 60 credits (~25 hours) POPULAR</div>
          <div style="margin: 8px 0;">$25 = 150 credits (~60 hours)</div>
          <div style="margin: 8px 0;">$50 = 350 credits (~140 hours)</div>
        </div>
        <button id="chaptr-purchase-btn" style="
          background: #ff0000;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 10px;
          font-weight: bold;
        ">Purchase Credits</button>
      </div>

      <button id="chaptr-close-btn" style="
        background: transparent;
        border: 1px solid #ccc;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      ">Close</button>
    </div>
  `);

  document.getElementById('chaptr-purchase-btn').addEventListener('click', () => {
    window.open('https://chaptr.app/credits', '_blank');
  });

  document.getElementById('chaptr-close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// Show chapters modal after successful chapterization
function showChaptersModal(data) {
  const { chapters, creditsRemaining, wasCached } = data;

  const chaptersHtml = chapters.map(ch => `
    <div style="
      padding: 10px;
      margin: 8px 0;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    " class="chapter-item" data-timestamp="${ch.timestamp}">
      <div style="font-weight: bold; color: #ff0000;">${ch.timestamp} - ${ch.title}</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">${ch.description}</div>
    </div>
  `).join('');

  const modal = createModal(`
    <div style="padding: 20px; max-height: 600px; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin-bottom: 10px;">✓ ${chapters.length} Chapters Created</h2>
        <p style="color: #666;">Credits remaining: ${creditsRemaining}</p>
        ${wasCached ? '<p style="color: #00a000; font-size: 14px;">⚡ Loaded instantly from cache!</p>' : ''}
      </div>

      <div style="margin: 20px 0;">
        ${chaptersHtml}
      </div>

      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
        color: white;
      ">
        <h3 style="margin-bottom: 10px;">💬 Post as YouTube Comment?</h3>
        <p style="margin-bottom: 15px; font-size: 14px;">✨ Earn +2 credits back!</p>
        <p style="font-size: 13px; margin-bottom: 15px; opacity: 0.9;">
          Help others find this useful and earn credits!
        </p>
        <button id="chaptr-post-comment-btn" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          font-weight: bold;
          margin-right: 10px;
        ">✓ Yes, Post & Earn</button>
        <button id="chaptr-skip-btn" style="
          background: transparent;
          color: white;
          border: 2px solid white;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        ">Skip</button>
      </div>

      <div style="text-align: center;">
        <button id="chaptr-close-modal-btn" style="
          background: transparent;
          border: 1px solid #ccc;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Close</button>
      </div>
    </div>
  `);

  // Add click handlers for chapter items (seek video)
  modal.querySelectorAll('.chapter-item').forEach(item => {
    item.addEventListener('click', () => {
      const timestamp = item.getAttribute('data-timestamp');
      seekToTimestamp(timestamp);
    });

    item.addEventListener('mouseenter', (e) => {
      e.target.style.background = '#e0e0e0';
    });

    item.addEventListener('mouseleave', (e) => {
      e.target.style.background = '#f5f5f5';
    });
  });

  // Post comment handler
  document.getElementById('chaptr-post-comment-btn').addEventListener('click', async () => {
    const btn = document.getElementById('chaptr-post-comment-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Posting...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'postComment',
        data: { videoId: currentVideoId, chapters }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      userCredits = response.newCreditBalance;

      // Show success
      btn.innerHTML = `✓ Posted! +${response.creditsEarned} credits earned`;
      btn.style.background = '#00a000';

      setTimeout(() => {
        modal.remove();
      }, 2000);

    } catch (error) {
      alert('Failed to post comment: ' + error.message);
      btn.disabled = false;
      btn.innerHTML = '✓ Yes, Post & Earn';
    }
  });

  document.getElementById('chaptr-skip-btn').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('chaptr-close-modal-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// Seek video to timestamp
function seekToTimestamp(timestamp) {
  const parts = timestamp.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
  }
}

// Create modal
function createModal(content) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'chaptr-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = content;
  overlay.appendChild(modal);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

// Observe URL changes for YouTube SPA navigation
function observeUrlChanges() {
  let lastUrl = location.href;

  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;

      // Remove old button
      const oldButton = document.querySelector('#chaptr-button');
      if (oldButton) oldButton.remove();

      // Re-initialize if on watch page
      if (url.includes('/watch')) {
        setTimeout(init, 1000);
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

// Start initialization
if (window.location.href.includes('/watch')) {
  init();
}
