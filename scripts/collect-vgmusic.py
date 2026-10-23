#!/usr/bin/env python3
"""Inventory and resume a bounded download of VGMusic's publicly listed MIDIs.

Raw files and provenance stay in .local/vgmusic (gitignored). No upload or deploy.
Uses requests for verified TLS and connection reuse; respects Retry-After.
"""
import argparse
import concurrent.futures
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import threading
import time
from urllib.parse import urljoin, urlsplit, urlunsplit, quote, unquote
from urllib.robotparser import RobotFileParser

import requests

BASE = "https://www.vgmusic.com/"
USER_AGENT = "UPIC-MIDI-study/0.1"
MAX_BYTES = 16 * 1024 * 1024


def canonical_url(base, href):
    parsed = urlsplit(urljoin(base, href.strip()))
    if parsed.hostname not in {"vgmusic.com", "www.vgmusic.com"}:
        return None
    path = quote(unquote(parsed.path), safe="/!$&'()*+,;=:@-._~")
    return urlunsplit(("https", "www.vgmusic.com", path, parsed.query, ""))


class Listing(HTMLParser):
    """Accept the site's deliberately unclosed TD tags as well as normal HTML."""
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url = url
        self.links = []
        self.rows = []
        self.row = None
        self.cell = None
        self.anchor = None
        self.game = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.finish_row()
            self.row = {"class": attrs.get("class", ""), "cells": [], "links": []}
        elif tag in {"td", "th"} and self.row is not None:
            self.finish_cell()
            self.cell = []
        if tag == "a" and attrs.get("href"):
            self.finish_anchor()
            self.anchor = {"url": canonical_url(self.url, attrs["href"]), "text": []}

    def handle_endtag(self, tag):
        if tag == "a":
            self.finish_anchor()
        elif tag in {"td", "th"}:
            self.finish_cell()
        elif tag == "tr":
            self.finish_row()

    def handle_data(self, data):
        if self.anchor is not None:
            self.anchor["text"].append(data)
        if self.cell is not None:
            self.cell.append(data)

    def finish_anchor(self):
        if self.anchor is None:
            return
        link = {"url": self.anchor["url"], "text": " ".join("".join(self.anchor["text"]).split())}
        if link["url"]:
            self.links.append(link)
            if self.row is not None:
                self.row["links"].append(link)
        self.anchor = None

    def finish_cell(self):
        if self.cell is not None and self.row is not None:
            self.row["cells"].append(" ".join("".join(self.cell).split()))
        self.cell = None

    def finish_row(self):
        if self.row is None:
            return
        self.finish_anchor()
        self.finish_cell()
        if "gameheader" in self.row["class"]:
            self.game = " ".join(self.row["cells"])
        for link in self.row["links"]:
            if urlsplit(link["url"]).path.lower().endswith((".mid", ".midi", ".rmi")):
                comments = next((a["url"] for a in self.row["links"] if "/file/" in a["url"]), None)
                self.rows.append({"url": link["url"], "title": link["text"], "game": self.game,
                                  "sequencer": self.row["cells"][2] if len(self.row["cells"]) > 2 else "",
                                  "comments": comments, "index": self.url})
        self.row = None

    def close(self):
        super().close()
        self.finish_row()
        self.finish_anchor()


def atomic_json(path, value):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    tmp.replace(path)


def retry_delay(value, attempt, now=None):
    delay = 2 ** (attempt + 1)
    if value.isdigit():
        return max(delay, int(value))
    if value:
        try:
            when = parsedate_to_datetime(value)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            delay = max(delay, (when - (now or datetime.now(timezone.utc))).total_seconds())
        except (ValueError, TypeError, OverflowError):
            pass
    return delay


class Fetcher:
    def __init__(self, rate):
        self.rate = rate
        self.local = threading.local()
        self.lock = threading.Lock()
        self.next_request = 0
        self.pause_until = 0
        self.robot = None

    def wait(self):
        while True:
            with self.lock:
                now = time.monotonic()
                slot = max(self.next_request, self.pause_until)
                if slot <= now:
                    self.next_request = now + 1 / self.rate
                    return
            # Recheck after waking: another request may have received a longer
            # Retry-After while this worker was waiting for its next slot.
            time.sleep(max(.001, slot - now))

    def get(self, url):
        if self.robot is not None and not self.robot.can_fetch(USER_AGENT, url):
            raise ValueError("disallowed_by_robots")
        if not hasattr(self.local, "session"):
            self.local.session = requests.Session()
            self.local.session.headers.update({"User-Agent": USER_AGENT})
        for attempt in range(5):
            self.wait()
            try:
                with self.local.session.get(url, timeout=(15, 45), stream=True) as response:
                    if urlsplit(response.url).hostname not in {"www.vgmusic.com", "vgmusic.com"}:
                        raise ValueError("external_redirect")
                    if response.status_code in {429, 502, 503, 504}:
                        retry = response.headers.get("Retry-After", "")
                        delay = retry_delay(retry, attempt)
                        with self.lock:
                            self.pause_until = max(self.pause_until, time.monotonic() + delay)
                        if attempt < 4:
                            continue
                    response.raise_for_status()
                    chunks, size = [], 0
                    for chunk in response.iter_content(65536):
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise ValueError("file_exceeds_16_MiB_limit")
                        chunks.append(chunk)
                    return b"".join(chunks)
            except (requests.ConnectionError, requests.Timeout):
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
        raise RuntimeError("retries_exhausted")


def parse_listing(data, url):
    listing = Listing(url)
    listing.feed(data.decode("utf-8", errors="replace"))
    listing.close()
    return listing


def inventory(root, fetcher, refresh=False):
    pages = root / "pages"
    pages.mkdir(parents=True, exist_ok=True)
    def page(url):
        cache = pages / (hashlib.sha256(url.encode()).hexdigest() + ".html")
        if refresh or not cache.exists():
            data = fetcher.get(url)
            cache.write_bytes(data)
        return cache.read_bytes()
    home = parse_listing(page(BASE), BASE)
    sections = {link["url"]: link["text"] for link in home.links
                if urlsplit(link["url"]).path.startswith("/music/") and link["url"].endswith("/")}
    sections[urljoin(BASE, "new-files/")] = "Newly submitted files"
    found, diagnostics = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(page, url): (url, name) for url, name in sections.items()}
        for future in concurrent.futures.as_completed(futures):
            url, name = futures[future]
            try:
                data = future.result()
                listing = parse_listing(data, url)
                entries = listing.rows
                # Some archive sections may contain directly linked MIDIs outside tables.
                seen = {entry["url"] for entry in entries}
                for link in listing.links:
                    if link["url"] not in seen and urlsplit(link["url"]).path.lower().endswith((".mid", ".midi", ".rmi")):
                        entries.append({"url": link["url"], "title": link["text"], "index": url, "game": "", "sequencer": ""})
                        seen.add(link["url"])
                for entry in entries:
                    found.setdefault(entry["url"], {**entry, "section": name, "status": "pending"})
                diagnostics.append({"url": url, "section": name, "listed": len(entries),
                                    "status": "ok" if entries else "no_files_listed",
                                    "message": "Website database connection failed" if b"Connection failed" in data else ""})
                print(f"Inventory: {name}: {len(entries)} MIDI links", flush=True)
            except Exception as error:
                diagnostics.append({"url": url, "section": name, "status": "error", "error": str(error)})
    return {"version": 1, "site": BASE, "created": datetime.now(timezone.utc).isoformat(),
            "sections": sorted(diagnostics, key=lambda row: row["url"]),
            "sources": sorted(found.values(), key=lambda row: row["url"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(".local/vgmusic"))
    parser.add_argument("--inventory-only", action="store_true")
    parser.add_argument("--refresh-index", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--rate", type=float, default=12, help="Maximum requests per second across all workers")
    args = parser.parse_args()
    root = args.root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    objects = root / "midi"
    objects.mkdir(exist_ok=True)
    fetcher = Fetcher(max(.1, min(16, args.rate)))
    manifest_path, journal_path = root / "manifest.json", root / "downloads.jsonl"
    try:
        robot_data = fetcher.get(urljoin(BASE, "robots.txt"))
        fetcher.robot = RobotFileParser()
        fetcher.robot.parse(robot_data.decode(errors="replace").splitlines())
    except requests.HTTPError as error:
        if error.response.status_code != 404:
            raise
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    data = inventory(root, fetcher, args.refresh_index) if args.refresh_index or old is None else old
    rows = {row["url"]: row for row in data["sources"]}
    if old and args.refresh_index:
        for row in old["sources"]:
            if row["url"] in rows:
                rows[row["url"]].update({key: row[key] for key in ("path", "status", "sha256", "bytes", "error") if key in row})
    if journal_path.exists():
        for line in journal_path.read_text().splitlines():
            try:
                saved = json.loads(line)
                if saved["url"] in rows:
                    rows[saved["url"]].update(saved)
            except (json.JSONDecodeError, KeyError):
                continue
    def checkpoint():
        data["updated"] = datetime.now(timezone.utc).isoformat()
        data["counts"] = dict(Counter(row["status"] for row in data["sources"]))
        atomic_json(manifest_path, data)
        atomic_json(root / "download-status.json", {"updated": data["updated"], "total": len(rows), **data["counts"]})
    checkpoint()
    if args.inventory_only:
        return
    def download(row):
        try:
            raw = fetcher.get(row["url"])
            if raw[:4] not in {b"MThd", b"RIFF"}:
                raise ValueError("not_a_midi_or_rmid_file")
            digest = hashlib.sha256(raw).hexdigest()
            path = objects / (digest + ".mid")
            if not path.exists():
                # URL-specific temp names allow identical responses from concurrent requests.
                tmp = objects / (hashlib.sha256(row["url"].encode()).hexdigest() + ".tmp")
                tmp.write_bytes(raw)
                tmp.replace(path)
            return {"url": row["url"], "status": "downloaded", "sha256": digest, "bytes": len(raw), "path": str(path), "error": None}
        except Exception as error:
            return {"url": row["url"], "status": "error", "error": str(error)}
    def local_file_exists(row):
        if not row.get("path"):
            return False
        path = Path(row["path"])
        return (path if path.is_absolute() else root / path).is_file()
    pending = [row for row in rows.values() if row["status"] == "pending" or
               (row["status"] == "downloaded" and not local_file_exists(row)) or
               (args.retry_failed and row["status"] == "error")]
    print(f"Download: {len(pending)} remaining of {len(rows)} listed URLs", flush=True)
    started, last = time.monotonic(), time.monotonic()
    completed = 0
    with journal_path.open("a", buffering=1) as journal, concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(4, args.workers))) as pool:
        # Keep only a bounded queue rather than submitting tens of thousands of futures.
        iterator = iter(pending)
        futures = {}
        def fill():
            while len(futures) < max(1, min(4, args.workers)) * 2:
                row = next(iterator, None)
                if row is None:
                    break
                futures[pool.submit(download, row)] = row["url"]
        fill()
        while futures:
            done, _ = concurrent.futures.wait(futures, return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                futures.pop(future)
                result = future.result()
                rows[result["url"]].update(result)
                journal.write(json.dumps(result, separators=(",", ":")) + "\n")
                completed += 1
            fill()
            now = time.monotonic()
            if now - last >= 20:
                checkpoint()
                counts = data["counts"]
                print(f"Progress: {counts.get('downloaded',0)}/{len(rows)} downloaded; {counts.get('error',0)} errors; {completed/max(1,now-started):.1f} files/sec", flush=True)
                last = now
    checkpoint()
    print("Finished:", json.dumps(data["counts"]), flush=True)


if __name__ == "__main__":
    main()
