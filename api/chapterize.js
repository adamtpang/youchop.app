// POST /api/chapterize  { url? | id? | videoId?, mock?, engine?: "auto"|"anthropic"|"heuristic" }
// Creator self-serve one-video path: transcript (timestamped) → chapters → paste-ready description block.
// Used for Adam's own essays after upload, and sold as the free sample / pack unit of work for creators.
//
// Engines:
//   anthropic, ANTHROPIC_API_KEY (already on the Vercel project from the old app). Cheap Haiku.
//   heuristic, free, no key: segment timed transcript by gaps + first-phrase titles.
//   auto, anthropic if key present, else heuristic.
//
// Output is YouTube description-ready (must start at 0:00). Never posts to YouTube.

const { fetchTranscripts, parseVideoId, hms } = require("./transcripts");

// "claude-3-5-haiku-latest" (Claude 3.5-era) was the previous default; current
// lineup is Claude 5 / Haiku 4.5, updated 2026-08 alongside fixing the invalid
// ANTHROPIC_API_KEY that was silently forcing every request onto the heuristic
// fallback engine.
const MODEL = process.env.CHAPTERIZE_MODEL || "claude-haiku-4-5-20251001";
const MAX_TRANSCRIPT_CHARS = 600_000;
const MAX_SUPPLIED_SEGMENTS = 20_000;
const CHAPTER_CREDIT = "⏱ Chapters by https://youchop.app";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

// Real chapters (creator-added via description timestamps, or YouTube's own
// auto-chapters) render as an engagement panel whose target-id contains
// "macro-markers" — confirmed live 2026-08 across several videos while debugging
// the extension's transcript panel in this same session. That panel is
// server-rendered into the watch page's own HTML, so a plain fetch (no headless
// browser) sees it, same trick channel-videos.js already uses for channel pages.
// Checked BEFORE spending any transcript-provider quota, so a video that already
// has chapters never burns a request against the free tiers for nothing.
function timestampSeconds(value) {
  const parts = String(value || "").trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function textHasChapterSequence(text) {
  const starts = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+\S/);
    if (!match) continue;
    const start = timestampSeconds(match[1]);
    if (start !== null) starts.push(start);
  }
  if (starts.length < 3 || starts[0] !== 0) return false;
  return starts.every((start, index) => index === 0 || start - starts[index - 1] >= 10);
}

function htmlHasExistingChapters(html) {
  const source = String(html || "");
  if (/engagement-panel-macro-markers|ytd-macro-markers-list-item-renderer/i.test(source)) return true;

  // Creator-authored timestamps live in shortDescription even when YouTube does
  // not render the macro-marker panel into the initial HTML. Decode only that
  // JSON string and apply YouTube's own basic chapter rules: 0:00 first, at
  // least three entries, and at least ten seconds between entries.
  const descriptions = source.matchAll(/"shortDescription":"((?:\\.|[^"\\])*)"/g);
  for (const match of descriptions) {
    try {
      if (textHasChapterSequence(JSON.parse(`"${match[1]}"`))) return true;
    } catch {}
  }
  return false;
}

async function hasExistingChapters(videoId) {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    });
    if (!r.ok) return null; // unknown; do not block generation on a lookup failure
    const html = await r.text();
    return htmlHasExistingChapters(html);
  } catch {
    return null; // unknown; same reasoning
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(d || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function resolveVideoId(body, query) {
  const raw =
    (body && (body.id || body.videoId || body.url || body.v)) ||
    (query && (query.id || query.videoId || query.url || query.v)) ||
    "";
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^[\w-]{11}$/.test(s)) return s;
  return parseVideoId(s) || "";
}

function parseTimestamped(text) {
  const lines = String(text || "").split(/\r?\n/);
  const segs = [];
  for (const line of lines) {
    const m = line.match(/^\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]\s*(.*)$/);
    if (!m) continue;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = parseInt(m[2], 10);
    const sec = parseInt(m[3], 10);
    const start = h * 3600 + min * 60 + sec;
    const t = String(m[4] || "").replace(/\s+/g, " ").trim();
    if (t) segs.push({ start, text: t });
  }
  return segs;
}

/* The extension has already extracted timestamped rows in the user's own tab.
   Accept those rows directly instead of spending a second provider credit for
   the same transcript. Keep this input deliberately narrow and bounded because
   /api/chapterize is public and the transcript may later be sent to Anthropic. */
function readSuppliedSegments(body) {
  const raw = body && (body.segments ?? body.segs);
  if (!Array.isArray(raw)) return { provided: false, segments: [] };
  if (!raw.length) return { provided: true, error: "segments must not be empty" };
  if (raw.length > MAX_SUPPLIED_SEGMENTS) {
    return { provided: true, error: `segments exceeds the ${MAX_SUPPLIED_SEGMENTS.toLocaleString()} row limit` };
  }

  let chars = 0;
  const rows = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = Math.floor(Number(item.start ?? item.t ?? item.seconds));
    const text = String(item.text || "").replace(/\s+/g, " ").trim();
    if (!Number.isFinite(start) || start < 0 || start > 7 * 24 * 3600 || !text) continue;
    chars += text.length;
    if (chars > MAX_TRANSCRIPT_CHARS) {
      return { provided: true, error: `segments exceeds the ${MAX_TRANSCRIPT_CHARS.toLocaleString()} character limit` };
    }
    const key = `${start}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ start, text });
  }
  rows.sort((a, b) => a.start - b.start);
  if (!rows.length) return { provided: true, error: "segments contained no valid timestamped text" };
  return { provided: true, segments: rows };
}

function timestampedText(segments) {
  return segments.map((s) => `[${hms(s.start)}] ${s.text}`).join("\n");
}

function cleanTitle(s) {
  let t = String(s || "")
    .replace(/[\[\]]/g, "")
    .replace(/^[\d:.\-\s]+/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Drop filler openers creators hate pasting
  t = t.replace(/^(um+|uh+|so+|okay+|alright+|well+|yeah+|and+|but+|which+|because+)\b[\s,:-]*/i, "").trim();
  // Prefer the first clause that looks like a topic, not a trailing fragment
  const clauses = t.split(/[.!?]/).map((c) => c.trim()).filter((c) => c.length >= 8);
  if (clauses.length) t = clauses[0];
  // Drop trailing dangling glue words
  t = t.replace(/\b(and|or|but|the|a|an|to|of|for|with|that|this|these|those|is|are|was|were|be|been|being|have|has|had|will|would|can|could|should|might|from|into|about|like)\s*$/i, "").trim();
  t = t.replace(/[,:;]+\s*$/, "").trim();
  if (t.length > 56) t = t.slice(0, 53).replace(/\s+\S*$/, "") + "…";
  // Sentence case: capitalize first letter only (YouTube chapter style)
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t || "Section";
}

function targetChapterSeconds(duration) {
  return duration < 180 ? 45 : duration < 900 ? 90 : 150;
}

function heuristicChapters(segs, videoDuration = 0) {
  if (!segs.length) return [];
  const lastStart = segs[segs.length - 1].start;
  const duration = Math.max(lastStart, videoDuration, 1);
  // Keep cutting through the final transcript row. There is intentionally no
  // chapter-count ceiling: a long video needs more chapters, not an early stop.
  const targetSec = targetChapterSeconds(duration);

  const chapters = [{ start: 0, title: cleanTitle(segs[0].text) }];
  let bucketStart = 0;
  let bucketText = [];
  let lastCut = 0;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const prev = segs[i - 1];
    const gap = prev ? s.start - prev.start : 0;
    bucketText.push(s.text);

    const elapsed = s.start - bucketStart;
    const hardGap = gap >= 4; // caption silence / new beat
    const longEnough = elapsed >= targetSec;
    const force = longEnough && (hardGap || elapsed >= targetSec * 1.6);

    if (force && s.start - lastCut >= Math.min(30, targetSec * 0.5)) {
      chapters.push({ start: s.start, title: cleanTitle(s.text) });
      lastCut = s.start;
      bucketStart = s.start;
      bucketText = [];
    }
  }

  // Ensure first is 0:00; drop near-duplicates
  const out = [];
  for (const c of chapters) {
    const start = out.length === 0 ? 0 : c.start;
    if (out.length && start - out[out.length - 1].start < 15) continue;
    out.push({ start, title: c.title });
  }
  if (!out.length) out.push({ start: 0, title: "Introduction" });
  else out[0].start = 0;
  return out;
}

function ensureFullCoverage(chapters, segs, videoDuration = 0) {
  if (!chapters.length || !segs.length) return chapters;
  const transcriptEnd = segs[segs.length - 1].start;
  const duration = Math.max(videoDuration, transcriptEnd, 1);
  const maxGap = targetChapterSeconds(duration) * 2;
  const fallback = heuristicChapters(segs, duration);
  const out = chapters
    .map((chapter) => ({ start: Math.max(0, Math.floor(Number(chapter.start) || 0)), title: chapter.title }))
    .filter((chapter) => chapter.title && chapter.start <= duration)
    .sort((a, b) => a.start - b.start);

  // Fill every oversized gap with deterministic transcript-derived chapters.
  // This also repairs a model response that stops after a fixed number of items
  // while the transcript continues for another hour.
  for (const candidate of fallback) {
    const sorted = out.slice().sort((a, b) => a.start - b.start);
    let previous = sorted[0] || { start: 0 };
    let next = null;
    for (const chapter of sorted) {
      if (chapter.start <= candidate.start) previous = chapter;
      else { next = chapter; break; }
    }
    const gapEnd = next ? next.start : duration;
    if (
      gapEnd - previous.start > maxGap &&
      candidate.start - previous.start >= 10 &&
      (!next || next.start - candidate.start >= 10)
    ) {
      out.push(candidate);
    }
  }

  out.sort((a, b) => a.start - b.start);
  const deduped = [];
  for (const chapter of out) {
    if (deduped.length && chapter.start - deduped[deduped.length - 1].start < 10) continue;
    deduped.push(chapter);
  }
  if (deduped.length) deduped[0].start = 0;
  return deduped;
}

function toPaste(chapters) {
  return chapters
    .map((c) => {
      const ts = c.start === 0 ? "0:00" : hms(c.start);
      return ts + " " + c.title;
    })
    .join("\n");
}

function mockChapters() {
  return [
    { start: 0, title: "The port is the bottleneck" },
    { start: 6, title: "Why the ship isn't the problem" },
    { start: 12, title: "Twenty thousand boxes" },
    { start: 17, title: "Crane throughput math" },
  ];
}

async function anthropicChapters({ title, author, transcript, duration = 0 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "no_anthropic_key" };
  if (transcript.length > MAX_TRANSCRIPT_CHARS) return { error: "transcript_too_large" };

  const prompt = `You write YouTube description chapters from a timestamped transcript.

Rules:
- Return ONLY a JSON array: [{"start":0,"title":"..."}, ...]
- First chapter MUST have start: 0
- start is integer seconds from the beginning of the video
- Titles: 3–7 words, topic-based, search-friendly. Never "Introduction", "Main Discussion", "Conclusion", "Part 1"
- Prefer natural topic shifts over fixed intervals
- About 1 chapter per 1.5–3 minutes; minimum 3, with no fixed maximum
- Cover the complete video and every major topic through the final transcript timestamp
- Do not stop after 20 chapters or any other arbitrary count
- No markdown, no commentary, no trailing commas

Video title: ${title || "(unknown)"}
Channel: ${author || "(unknown)"}
Video duration: ${duration ? hms(duration) : "(infer from transcript)"}

Timestamped transcript:
${transcript}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || JSON.stringify(data).slice(0, 200);
    return { error: "anthropic_error", status: r.status, detail: msg };
  }
  const text = (data.content || []).map((c) => c.text || "").join("").trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { error: "bad_model_output", detail: text.slice(0, 240) };
  let arr;
  try {
    arr = JSON.parse(jsonMatch[0]);
  } catch {
    return { error: "bad_model_json", detail: jsonMatch[0].slice(0, 240) };
  }
  if (!Array.isArray(arr) || !arr.length) return { error: "empty_chapters" };

  const chapters = [];
  for (const item of arr) {
    const start = Math.max(0, Math.floor(Number(item.start ?? item.seconds ?? 0) || 0));
    const titleText = cleanTitle(item.title || item.name || item.label || "");
    if (chapters.length && start - chapters[chapters.length - 1].start < 10) continue;
    chapters.push({ start: chapters.length === 0 ? 0 : start, title: titleText });
  }
  if (!chapters.length) return { error: "empty_chapters" };
  chapters[0].start = 0;
  return { chapters, model: MODEL };
}

module.exports = async (req, res) => {
  // CORS for local tooling / future extension callers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = await readJson(req);
  const videoId = resolveVideoId(body, req.query);
  const wantMock = !!(body.mock || (req.query && req.query.mock === "1"));
  const enginePref = String(body.engine || "auto").toLowerCase();
  const supplied = readSuppliedSegments(body);

  if (!videoId && !wantMock) {
    return res.status(400).json({ error: "missing_video", message: "Provide url or id (YouTube video)." });
  }
  if (supplied.error) {
    return res.status(400).json({ error: "invalid_segments", message: supplied.error });
  }

  // Refuse before using transcript-provider or model quota. The extension also
  // checks the live DOM, but the server remains the final guard for web callers
  // and stale client pages.
  const existingStatus = (!wantMock && videoId) ? await hasExistingChapters(videoId) : false;
  if (existingStatus === true) {
    return res.status(409).json({
      error: "already_chapterized",
      message: "This video already has YouTube chapters, so YouChop did not generate a duplicate set.",
      videoId,
    });
  }

  // 1) Transcript with timestamps
  const suppliedMeta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const tx = supplied.provided
    ? {
        ok: true,
        provider: "browser-local",
        transcripts: [{
          videoId,
          title: String(suppliedMeta.title || "").slice(0, 500),
          author: String(suppliedMeta.author || "").slice(0, 500),
          language: String(body.lang || "en").slice(0, 16),
          ok: true,
          text: timestampedText(supplied.segments),
        }],
      }
    : await fetchTranscripts({
        ids: [videoId || "jNQXAC9IVRw"],
        timestamps: true,
        mock: wantMock,
        lang: body.lang,
      });
  if (!tx.ok) return res.status(tx.status || 502).json(tx.body || { error: "transcript_failed" });

  const t = (tx.transcripts || [])[0];
  if (!t || !t.ok || !t.text) {
    return res.status(422).json({
      error: "no_transcript",
      message: "No captions/transcript for this video. YouTube needs captions (auto is fine) before chapters can be built.",
      videoId: videoId || null,
      provider: tx.provider,
    });
  }

  // 2) Chapter generation
  let chapters = null;
  let engine = "heuristic";
  let engineMeta = {};

  if (wantMock) {
    chapters = mockChapters();
    engine = "mock";
  } else {
    const segs = parseTimestamped(t.text);
    const requestedDuration = Math.max(0, Math.floor(Number(suppliedMeta.duration) || 0));
    if (supplied.provided && requestedDuration && segs.length) {
      const transcriptEnd = segs[segs.length - 1].start;
      const tolerance = Math.max(180, Math.min(600, Math.floor(requestedDuration * 0.05)));
      if (transcriptEnd < requestedDuration - tolerance) {
        return res.status(422).json({
          error: "incomplete_transcript",
          message: `The extracted transcript stops at ${hms(transcriptEnd)}, but the video runs ${hms(requestedDuration)}. Reopen the full transcript and retry; YouChop will not return partial chapters.`,
          videoId,
          transcriptEnd,
          duration: requestedDuration,
        });
      }
    }
    const tryAnthropic =
      enginePref === "anthropic" || (enginePref === "auto" && !!process.env.ANTHROPIC_API_KEY);
    const tryHeuristic = enginePref === "heuristic" || enginePref === "auto" || enginePref === "anthropic";

    if (tryAnthropic) {
      const llm = await anthropicChapters({
        title: t.title,
        author: t.author,
        transcript: t.text,
        duration: requestedDuration,
      });
      if (llm.chapters) {
        chapters = llm.chapters;
        engine = "anthropic";
        engineMeta = { model: llm.model };
      } else if (enginePref === "anthropic") {
        return res.status(502).json({
          error: llm.error || "chapter_gen_failed",
          detail: llm.detail,
          status: llm.status,
          message: "Anthropic chapter generation failed. Retry or pass engine=heuristic.",
        });
      } else {
        engineMeta = { anthropicFallback: llm.error || "failed" };
      }
    }

    if (!chapters && tryHeuristic) {
      if (!segs.length) {
        // Plain text only, single chapter from title
        chapters = [{ start: 0, title: cleanTitle(t.title || "Full video") }];
        engine = "heuristic";
        engineMeta.note = "no_timestamps_in_transcript";
      } else {
        chapters = heuristicChapters(segs, requestedDuration);
        engine = "heuristic";
      }
    }
    chapters = ensureFullCoverage(chapters || [], segs, requestedDuration);
  }

  if (!chapters || !chapters.length) {
    return res.status(500).json({ error: "no_chapters", message: "Could not produce chapters." });
  }

  const paste = toPaste(chapters);
  return res.status(200).json({
    videoId: t.videoId || videoId,
    title: t.title || "",
    author: t.author || "",
    language: t.language || "",
    alreadyHasChapters: false,
    chapters: chapters.map((c) => ({
      start: c.start,
      timestamp: c.start === 0 ? "0:00" : hms(c.start),
      title: c.title,
    })),
    paste,
    pasteWithCredit: paste + "\n\n" + CHAPTER_CREDIT,
    transcriptProvider: tx.provider,
    transcriptCache: tx.cache || null,
    engine,
    ...engineMeta,
  });
};
