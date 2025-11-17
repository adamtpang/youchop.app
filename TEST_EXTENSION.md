# Test Chaptr Extension Locally

## Quick Test (5 minutes)

### 1. Load Extension in Chrome

```bash
# Extension is already built at: extension/build/
```

**In Chrome:**
1. Open `chrome://extensions/`
2. Toggle "Developer mode" ON (top right)
3. Click "Load unpacked"
4. Select folder: `~/ubuntu-projects/youchop.app/extension/build`
5. Extension should load with purple icon

### 2. Test on YouTube

1. Go to https://youtube.com
2. Open any video (example: https://www.youtube.com/watch?v=dQw4w9WgXcQ)
3. Look for "⚡ Chapterize (Demo)" button in video controls
4. Click the button

**Expected Result:**
- Demo mode popup appears
- Shows "10 free credits"
- Click "Start Demo - Try It Now!"
- Generates 5 demo chapters
- Can click chapters to jump to timestamps

### 3. Test Popup

1. Click extension icon in Chrome toolbar (purple circle with "C")
2. Popup should show:
   - Credit balance (10)
   - Stats (0 videos, 0 comments)
   - Purchase credits button
   - Visit site button

### 4. Verify Features

✓ **Works:**
- Button appears on YouTube
- Demo mode activates automatically
- Generates 5 sample chapters
- Chapters are clickable
- Video seeks to timestamp
- Credit balance decreases
- Popup shows stats

✗ **Doesn't Work (Expected - Demo Mode):**
- Real AI chapter generation
- Comment posting
- Credit purchases
- Backend API calls
- Authentication

## Common Issues

### Button doesn't appear
- Refresh YouTube page
- Check extension is enabled
- Check console for errors (F12)

### Icons not showing
- Icons were generated: `extension/icons/icon*.png`
- Rebuild if needed: `npm run build:extension`

### Demo doesn't start
- Open extension popup first
- Click extension icon, then try chapterize

## What's Actually Working

This is a **demo/MVP version** that:
- ✅ Loads without errors
- ✅ Has working UI
- ✅ Simulates chapter generation
- ✅ Works entirely offline
- ✅ Shows the core UX flow
- ✅ Good enough for Chrome Web Store review

## Ready for Submission

The extension is **ready to submit** to Chrome Web Store as a demo/preview version:

1. **File:** `extension.zip` (14KB)
2. **Status:** Demo mode, no backend required
3. **Test:** Load in Chrome and verify it works
4. **Submit:** Upload to Chrome Web Store Developer Dashboard

## Next Steps After Approval

1. Deploy backend to Vercel
2. Update `background.js`: Set `DEMO_MODE = false`
3. Update `API_URL` to production URL
4. Configure OAuth for comment posting
5. Rebuild and submit version 1.1.0
