// Content script for YouTube pages (MVP Demo Version)
console.log('YouChop extension loaded (Demo Mode)');

let userCredits = null;
let currentVideoId = null;
let videoData = null;

// Initialize extension
async function init() {
  await waitForElement('.ytp-right-controls');
  currentVideoId = getVideoId();
  if (!currentVideoId) return;

  const duration = await getVideoDuration();
  videoData = {
    videoId: currentVideoId,
    duration: duration,
    title: document.title.replace(' - YouTube', '')
  };

  await fetchCredits();
  addChapterizeButton();
  observeUrlChanges();
}

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

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

async function getVideoDuration() {
  const player = document.querySelector('video');
  if (player) {
    return Math.floor(player.duration);
  }
  return 0;
}

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

function calculateCreditCost(durationSeconds) {
  const minutes = durationSeconds / 60;
  if (minutes < 15) return 1;
  if (minutes < 60) return 2;
  return 3;
}

function addChapterizeButton() {
  if (document.querySelector('#youchop-button')) return;

  const rightControls = document.querySelector('.ytp-right-controls');
  if (!rightControls) return;

  const creditCost = calculateCreditCost(videoData.duration);

  const button = document.createElement('button');
  button.id = 'youchop-button';
  button.className = 'ytp-button youchop-button';

  let buttonText = '';
  let buttonTitle = '';
  let isDisabled = false;

  if (userCredits === null) {
    buttonText = '⚡ Chapterize (Demo)';
    buttonTitle = 'Try YouChop - Demo Mode';
  } else if (userCredits < creditCost) {
    buttonText = `⚡ Need ${creditCost - userCredits} more`;
    buttonTitle = `Insufficient credits. You need ${creditCost} credits but have ${userCredits}.`;
    isDisabled = true;
  } else {
    buttonText = `⚡ Chapterize (${creditCost})`;
    buttonTitle = `Chapterize this video for ${creditCost} credit${creditCost > 1 ? 's' : ''}. Balance: ${userCredits}`;
  }

  button.innerHTML = `<span style="font-size: 14px; padding: 0 8px;">${buttonText}</span>`;
  button.title = buttonTitle;
  button.disabled = isDisabled;

  if (isDisabled) {
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
  }

  button.addEventListener('click', handleChapterizeClick);
  rightControls.insertBefore(button, rightControls.firstChild);
}

async function handleChapterizeClick(e) {
  e.stopPropagation();

  const button = e.currentTarget;

  if (userCredits === null) {
    showDemoModal();
    return;
  }

  const creditCost = calculateCreditCost(videoData.duration);
  if (userCredits < creditCost) {
    showInsufficientCreditsModal(creditCost);
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span style="font-size: 14px; padding: 0 8px;">⏳ Processing...</span>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chapterize',
      data: videoData
    });

    if (response.error) {
      throw new Error(response.error);
    }

    userCredits = response.creditsRemaining;
    showChaptersModal(response);

  } catch (error) {
    console.error('Chapterization failed:', error);
    alert(`Failed to chapterize video: ${error.message}`);
  } finally {
    button.disabled = false;
    const creditCost = calculateCreditCost(videoData.duration);
    button.innerHTML = `<span style="font-size: 14px; padding: 0 8px;">⚡ Chapterize (${creditCost})</span>`;
  }
}

function showDemoModal() {
  const modal = createModal(`
    <div style="text-align: center; padding: 30px;">
      <h2 style="margin-bottom: 15px; font-size: 28px;">⚡ YouChop Demo Mode</h2>
      <p style="margin-bottom: 20px; font-size: 16px; color: #666;">
        This is a demonstration of YouChop's AI-powered chapter generation.
      </p>
      <p style="margin-bottom: 25px; font-size: 14px; color: #888;">
        In demo mode, you have 10 free credits to try the extension.<br>
        Full version coming soon with real-time chapterization!
      </p>
      <button id="youchop-start-demo-btn" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 14px 28px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
      ">Start Demo - Try It Now!</button>
      <p style="margin-top: 20px; font-size: 12px; color: #aaa;">
        Credits: ${userCredits || 10} remaining
      </p>
    </div>
  `);

  document.getElementById('youchop-start-demo-btn').addEventListener('click', async () => {
    modal.remove();
    // Auto-authenticate for demo
    await chrome.runtime.sendMessage({ action: 'authenticate' });
    await fetchCredits();
    // Re-click the chapterize button
    document.getElementById('youchop-button').click();
  });
}

function showInsufficientCreditsModal(required) {
  const modal = createModal(`
    <div style="padding: 20px; text-align: center;">
      <h2 style="margin-bottom: 15px;">Need More Credits</h2>
      <p style="margin-bottom: 15px;">You need ${required} credits but have ${userCredits}.</p>

      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
          This is a demo version. In the full version, you can:
        </p>
        <ul style="text-align: left; margin: 10px 20px; color: #666;">
          <li>Purchase credit packages</li>
          <li>Earn +2 credits by posting chapters as comments</li>
          <li>Get +10 credits per referral</li>
        </ul>
      </div>

      <button id="youchop-close-btn" style="
        background: #667eea;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
      ">Got It</button>
    </div>
  `);

  document.getElementById('youchop-close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

function showChaptersModal(data) {
  const { chapters, creditsRemaining, wasCached } = data;

  const chaptersHtml = chapters.map(ch => `
    <div style="
      padding: 12px;
      margin: 8px 0;
      background: #f5f5f5;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    " class="chapter-item" data-timestamp="${ch.timestamp}">
      <div style="font-weight: bold; color: #667eea; font-size: 15px;">${ch.timestamp} - ${ch.title}</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">${ch.description}</div>
    </div>
  `).join('');

  const modal = createModal(`
    <div style="padding: 25px; max-height: 600px; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin-bottom: 10px; font-size: 24px;">✓ ${chapters.length} Chapters Generated</h2>
        <p style="color: #666; font-size: 14px;">Credits remaining: ${creditsRemaining}</p>
        ${wasCached ? '<p style="color: #00a000; font-size: 13px; margin-top: 5px;">⚡ Demo chapters generated</p>' : ''}
      </div>

      <div style="margin: 20px 0;">
        ${chaptersHtml}
      </div>

      <div style="
        background: #f9f9f9;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
        border: 1px dashed #ccc;
      ">
        <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
          💡 <strong>Tip:</strong> Click any chapter to jump to that timestamp
        </p>
      </div>

      <div style="text-align: center;">
        <button id="youchop-close-modal-btn" style="
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Close</button>
      </div>
    </div>
  `);

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

  document.getElementById('youchop-close-modal-btn').addEventListener('click', () => {
    modal.remove();
  });
}

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

function createModal(content) {
  const overlay = document.createElement('div');
  overlay.id = 'youchop-modal-overlay';
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

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = content;
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function observeUrlChanges() {
  let lastUrl = location.href;

  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;

      const oldButton = document.querySelector('#youchop-button');
      if (oldButton) oldButton.remove();

      if (url.includes('/watch')) {
        setTimeout(init, 1000);
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

if (window.location.href.includes('/watch')) {
  init();
}
