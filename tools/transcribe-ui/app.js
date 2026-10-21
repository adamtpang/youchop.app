const $ = id => document.getElementById(id);
let token, jobId;
const session = fetch('/api/session').then(r => r.json()).then(d => { token = d.token; });
const url = new URLSearchParams(location.hash.slice(1)).get('url');
if (url) $('url').value = url;
history.replaceState(null, '', location.pathname);
$('file').addEventListener('change', () => { if ($('file').files.length) $('url').value = ''; });
$('url').addEventListener('input', () => { if ($('url').value) $('file').value = ''; });
async function request(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
async function poll() {
  try {
    const job = await request('/api/jobs/' + jobId);
    $('status').textContent = job.message;
    if (job.status === 'error') { $('go').disabled = false; return; }
    if (job.status !== 'done') { setTimeout(poll, 1000); return; }
    const r = job.result;
    $('text').value = r.segments.map(s => s.text).join('\n');
    $('meta').textContent = `${r.words.toLocaleString()} words · ${r.language} · ${Math.round(r.durationSeconds)} seconds · Whisper ${r.model}`;
    $('markdown').href = '/api/jobs/' + jobId + '/transcript.md';
    $('srt').href = '/api/jobs/' + jobId + '/transcript.srt';
    $('result').hidden = false;
    $('go').disabled = false;
  } catch (e) { $('status').textContent = e.message; $('go').disabled = false; }
}
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  $('go').disabled = true;
  $('result').hidden = true;
  $('status').textContent = 'Starting...';
  try {
    await session;
    const input = { model: $('model').value };
    const file = $('file').files[0];
    if (file) {
      if (file.size > 150 * 1024 * 1024) throw new Error('Choose a file under 150 MB.');
      $('status').textContent = 'Saving your file locally...';
      const upload = await request('/api/upload', { method: 'POST', headers: { 'X-YouChop-Token': token, 'X-Filename': file.name.replace(/[^\x20-\x7E]/g, '_'), 'Content-Type': 'application/octet-stream' }, body: file });
      input.upload = upload.upload;
    } else input.url = $('url').value;
    const job = await request('/api/jobs', { method: 'POST', headers: { 'X-YouChop-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    jobId = job.id;
    await poll();
  } catch (e) { $('status').textContent = e.message; $('go').disabled = false; }
});
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('text').value); $('status').textContent = 'Copied your edited text.'; }
  catch { $('status').textContent = 'Clipboard unavailable. Select the text and copy it.'; }
};
$('download').onclick = () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([$('text').value], { type: 'text/plain;charset=utf-8' }));
  link.download = 'transcript.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
