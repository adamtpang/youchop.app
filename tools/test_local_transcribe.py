import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
import sys
from types import SimpleNamespace
from unittest.mock import patch
from http.server import ThreadingHTTPServer

from local_transcribe import download_instagram, normalize_instagram_url, normalize_media_url, transcribe_media, render_outputs
from transcribe_server import State, handler_for


class TranscribeTests(unittest.TestCase):
    def test_url_restrictions_and_query_removal(self):
        self.assertEqual(normalize_instagram_url('https://www.instagram.com/reel/DeKieZFiL7e/?stkn=secret'),
                         'https://www.instagram.com/reel/DeKieZFiL7e/')
        for url in ['http://instagram.com/reel/ABC123/', 'https://instagram.com.evil.test/reel/ABC123/',
                    'https://user:password@instagram.com/reel/ABC123/', 'https://instagram.com/someone/',
                    'https://instagram.com:1234/p/ABC123/', 'file:///tmp/video.mp4']:
            with self.assertRaises(ValueError):
                normalize_instagram_url(url)

    def test_youtube_urls_reject_playlists_and_arbitrary_hosts(self):
        for url in ['https://youtu.be/miTYqqZnrXE?si=tracking', 'https://www.youtube.com/watch?v=miTYqqZnrXE&list=anything',
                    'https://youtube.com/shorts/miTYqqZnrXE', 'https://youtube.com/live/miTYqqZnrXE']:
            self.assertEqual(normalize_media_url(url), 'https://www.youtube.com/watch?v=miTYqqZnrXE')
        for url in ['https://youtube.com/playlist?list=abc', 'https://youtube.com/@someone',
                    'https://youtube.com.evil.test/watch?v=miTYqqZnrXE', 'https://user@youtube.com/watch?v=miTYqqZnrXE',
                    'http://youtube.com/watch?v=miTYqqZnrXE', 'https://youtube.com:99/watch?v=miTYqqZnrXE']:
            with self.assertRaises(ValueError):
                normalize_media_url(url)

    def test_long_audio_uses_bounded_chunks_and_absolute_timestamps(self):
        calls = []
        class Model:
            def transcribe(self, path, **kwargs):
                calls.append(path)
                return iter([SimpleNamespace(start=1.5, end=2.5, text=' speech ')]), SimpleNamespace(language='en')
        def run(command, **kwargs):
            return SimpleNamespace(returncode=0, stdout='{"format":{"duration":"361"}}')
        with tempfile.TemporaryDirectory() as folder:
            media = Path(folder) / 'source.mp3'
            media.write_bytes(b'audio fixture')
            with patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=None)}), \
                 patch.dict('local_transcribe._models', {'small': Model()}, clear=True), \
                 patch('local_transcribe.subprocess.run', side_effect=run):
                result = transcribe_media(media, Path(folder) / 'out')
            self.assertEqual(len(calls), 3)
            self.assertNotIn(str(media), calls)
            self.assertEqual([r['start'] for r in result['segments']], [1.5, 181.5])
            self.assertEqual(result['processedAudioSeconds'], 361)
            self.assertTrue((Path(folder) / 'out' / 'transcript.srt').exists())

    def test_chunk_failure_never_saves_a_complete_result(self):
        class Model:
            def transcribe(self, *args, **kwargs):
                return iter([SimpleNamespace(start=0, end=1, text='speech')]), SimpleNamespace(language='en')
        commands = []
        def run(command, **kwargs):
            commands.append(command)
            return SimpleNamespace(returncode=1 if len(commands) == 3 else 0,
                                   stdout='{"format":{"duration":"361"}}')
        with tempfile.TemporaryDirectory() as folder:
            media = Path(folder) / 'source.mp3'; media.write_bytes(b'fixture')
            out = Path(folder) / 'out'
            with patch.dict(sys.modules, {'faster_whisper': SimpleNamespace(WhisperModel=None)}), \
                 patch.dict('local_transcribe._models', {'small': Model()}, clear=True), \
                 patch('local_transcribe.subprocess.run', side_effect=run):
                with self.assertRaisesRegex(RuntimeError, 'No complete transcript'):
                    transcribe_media(media, out)
            self.assertFalse((out / 'transcript.json').exists())

    def test_output_preserves_words_and_valid_srt_times(self):
        result = {'title': 'A test', 'source': 'https://www.instagram.com/reel/ABC123/',
                  'segments': [{'start': 3599.9996, 'end': 3601.25, 'text': 'Names & numbers: 85%.'}]}
        out = render_outputs(result)
        self.assertIn('01:00:00,000 --> 01:00:01,250', out['transcript.srt'])
        self.assertEqual(json.loads(out['transcript.json'])['segments'][0]['text'], 'Names & numbers: 85%.')
        self.assertIn('85%', out['transcript.md'])

    def test_extract_adds_post_caption_and_date_for_profile_batches(self):
        with tempfile.TemporaryDirectory() as folder:
            media = Path(folder) / 'ABC123.m4a'
            media.write_bytes(b'audio')
            media.with_suffix('.info.json').write_text(json.dumps({'description': 'Sell the job', 'upload_date': '20261029'}))
            with patch('local_transcribe.download_media', return_value=(media, 'https://www.instagram.com/reel/ABC123/', 'Video')), \
                 patch('local_transcribe.transcribe_media', return_value={'segments': [], 'words': 0}):
                from local_transcribe import extract
                result = extract('https://www.instagram.com/reel/ABC123/', folder)
            self.assertEqual(result['caption'], 'Sell the job')
            self.assertEqual(result['posted'], '2026-10-29')

    def test_reused_output_folder_never_transcribes_an_older_posts_file(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / 'older.mp3').write_bytes(b'old audio')
            current = directory / 'ABC123.m4a'
            current.write_bytes(b'new audio')
            current.with_suffix('.info.json').write_text(json.dumps({'title': 'New post'}))
            class Process:
                returncode = 0
                stderr = ''
                stdout = 'YOUCHOP_MEDIA:' + str(current) + '\n'
            with patch('local_transcribe.subprocess.run', return_value=Process()):
                media, url, title = download_instagram('https://www.instagram.com/reel/ABC123/', directory)
            self.assertEqual(media, current.resolve())
            self.assertEqual(title, 'New post')
            Process.stdout = ''
            with patch('local_transcribe.subprocess.run', return_value=Process()):
                with self.assertRaises(RuntimeError):
                    download_instagram('https://www.instagram.com/p/PHOTO1/', directory)

    def test_loopback_server_rejects_external_origins_missing_tokens_and_path_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            state = State(directory)
            server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(state))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            port = server.server_address[1]
            def post(body, **headers):
                connection = http.client.HTTPConnection('127.0.0.1', port)
                connection.request('POST', '/api/jobs', json.dumps(body), {'Content-Type': 'application/json', **headers})
                response = connection.getresponse()
                status, data = response.status, json.loads(response.read())
                connection.close()
                return status, data
            try:
                self.assertEqual(post({'url': 'https://www.instagram.com/reel/ABC123/'})[0], 403)
                self.assertEqual(post({'url': 'https://www.instagram.com/reel/ABC123/'}, **{'X-YouChop-Token': state.token, 'Origin': 'https://evil.test'})[0], 403)
                self.assertEqual(post({'url': '/etc/passwd'}, **{'X-YouChop-Token': state.token})[0], 400)
                self.assertEqual(post([], **{'X-YouChop-Token': state.token})[0], 400)
                self.assertEqual(post({'url': 'https://www.instagram.com/reel/ABC123/'}, **{'X-YouChop-Token': state.token, 'Host': 'evil.test'})[0], 403)
                self.assertEqual(len(state.jobs), 0)
                with patch.object(state.pool, 'submit') as submit:
                    headers = {'X-YouChop-Token': state.token, 'Origin': 'chrome-extension://' + 'a' * 32}
                    body = {'url': 'https://youtu.be/miTYqqZnrXE'}
                    first = post(body, **headers)
                    second = post(body, **headers)
                    self.assertEqual(first[0], 202)
                    self.assertEqual(first, second)
                    submit.assert_called_once()
                    state.jobs[first[1]['id']]['status'] = 'done'
                    self.assertEqual(post(body, **headers), first)
                    self.assertEqual(post(body, **{**headers, 'Origin': 'chrome-extension://evil.test'})[0], 403)
            finally:
                server.shutdown(); server.server_close(); state.pool.shutdown()


if __name__ == '__main__':
    unittest.main()
