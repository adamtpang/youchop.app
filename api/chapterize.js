// POST /api/chapterize  { url? | id? | videoId?, mock?, engine?: "auto"|"anthropic"|"heuristic" }
// Creator self-serve one-video path: transcript (timestamped) → chapters → paste-ready description block.
// Used for Adam's own essays after upload, and sold as the free sample / pack unit of work for creators.
//
// Engines:
//   anthropic  — ANTHROPIC_API_KEY (already on the Vercel project from the old app). Cheap Haiku.
//   heuristic  — free, no key: segment timed transcript by gaps + first-phrase titles.
//   auto       — anthropic if key present, else heuristic.
//
// Output is YouTube description-ready (must start at 0:00). Never posts to YouTube.

const { fetchTranscripts, parseVideoId, hms } = require("./transcripts");

const MODEL = process.env.CHAPTERIZE_MODEL || "claude-3-5-haiku-latest";
const MAX_TRANSCRIPT_CHARS = 120_000;

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

function heuristicChapters(segs) {
  if (!segs.length) return [];
  const lastStart = segs[segs.length - 1].start;
  const duration = Math.max(lastStart, 1);
  // Target ~1 chapter per 90–150s, min 3 max 20 for short/long
  const targetSec = duration < 180 ? 45 : duration < 900 ? 90 : 150;
  const maxCh = duration < 120 ? 4 : duration < 600 ? 12 : 20;

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
    const force = chapters.length < maxCh && longEnough && (hardGap || elapsed >= targetSec * 1.6);

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
  return out.slice(0, maxCh);
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

async function anthropicChapters({ title, author, transcript }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "no_anthropic_key" };

  const clipped = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]"
    : transcript;

  const prompt = `You write YouTube description chapters from a timestamped transcript.

Rules:
- Return ONLY a JSON array: [{"start":0,"title":"..."}, ...]
- First chapter MUST have start: 0
- start is integer seconds from the beginning of the video
- Titles: 3–7 words, topic-based, search-friendly. Never "Introduction", "Main Discussion", "Conclusion", "Part 1"
- Prefer natural topic shifts over fixed intervals
- About 1 chapter per 1.5–3 minutes; min 3, max 20
- No markdown, no commentary, no trailing commas

Video title: ${title || "(unknown)"}
Channel: ${author || "(unknown)"}

Timestamped transcript:
${clipped}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
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
  return { chapters: chapters.slice(0, 20), model: MODEL };
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

  if (!videoId && !wantMock) {
    return res.status(400).json({ error: "missing_video", message: "Provide url or id (YouTube video)." });
  }

  // 1) Transcript with timestamps
  const tx = await fetchTranscripts({
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
    const tryAnthropic =
      enginePref === "anthropic" || (enginePref === "auto" && !!process.env.ANTHROPIC_API_KEY);
    const tryHeuristic = enginePref === "heuristic" || enginePref === "auto" || enginePref === "anthropic";

    if (tryAnthropic) {
      const llm = await anthropicChapters({
        title: t.title,
        author: t.author,
        transcript: t.text,
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
        // Plain text only — single chapter from title
        chapters = [{ start: 0, title: cleanTitle(t.title || "Full video") }];
        engine = "heuristic";
        engineMeta.note = "no_timestamps_in_transcript";
      } else {
        chapters = heuristicChapters(segs);
        engine = "heuristic";
      }
    }
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
    chapters: chapters.map((c) => ({
      start: c.start,
      timestamp: c.start === 0 ? "0:00" : hms(c.start),
      title: c.title,
    })),
    paste,
    // URL-free watermark (see GROWTH.md) — creator can strip before pasting
    pasteWithCredit: paste + "\n\n⏱ Chapters by YouChop",
    transcriptProvider: tx.provider,
    engine,
    ...engineMeta,
  });
};
