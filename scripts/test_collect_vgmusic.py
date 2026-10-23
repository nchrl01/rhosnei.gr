"""Offline checks for archive inventory and server backoff behavior."""
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("collector", Path(__file__).with_name("collect-vgmusic.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTests(unittest.TestCase):
    def test_unclosed_cells_preserve_title_game_author_and_provenance(self):
        page = b'''<table><tr class="gameheader"><td colspan="5">Game &amp; Game</tr>
        <tr><td><a href="song.mid">Main theme</a><td>123 bytes<td>A musician
        <td><a href="/file/abc.html#disqus_thread">Comments</a></tr></table>'''
        result = collector.parse_listing(page, collector.BASE + "music/console/test/")
        self.assertEqual(len(result.rows), 1)
        row = result.rows[0]
        self.assertEqual((row["game"], row["title"], row["sequencer"]), ("Game & Game", "Main theme", "A musician"))
        self.assertEqual(row["comments"], collector.BASE + "file/abc.html")
        self.assertEqual(row["url"], collector.BASE + "music/console/test/song.mid")

    def test_same_host_urls_preserve_case_and_escape_filenames(self):
        self.assertIsNone(collector.canonical_url(collector.BASE, "https://other.test/song.mid"))
        self.assertEqual(collector.canonical_url(collector.BASE, "/music/A Song.MID"), collector.BASE + "music/A%20Song.MID")
        self.assertEqual(collector.canonical_url(collector.BASE, "http://vgmusic.com/music/x.mid"), collector.BASE + "music/x.mid")

    def test_retry_after_never_shortens_server_requested_pause(self):
        now = datetime(2026, 10, 23, 16, 0, tzinfo=timezone.utc)
        self.assertEqual(collector.retry_delay("600", 0, now), 600)
        date = format_datetime(now + timedelta(seconds=900), usegmt=True)
        self.assertEqual(collector.retry_delay(date, 0, now), 900)
        self.assertEqual(collector.retry_delay("invalid", 2, now), 8)

    def test_wait_rechecks_pause_extended_by_another_worker(self):
        clock = [0.0]
        fetcher = collector.Fetcher(4)
        fetcher.next_request = 1
        def sleep(seconds):
            if clock[0] == 0:
                fetcher.pause_until = 10
            clock[0] += seconds
        with patch.object(collector.time, "monotonic", side_effect=lambda: clock[0]), patch.object(collector.time, "sleep", side_effect=sleep):
            fetcher.wait()
        self.assertEqual(clock[0], 10)
        self.assertEqual(fetcher.next_request, 10.25)


if __name__ == "__main__":
    unittest.main()
