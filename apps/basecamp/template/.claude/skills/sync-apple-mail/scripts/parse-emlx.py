#!/usr/bin/env python3
"""Parse a macOS Mail .emlx or .partial.emlx file and output the plain text body.

Usage: python3 scripts/parse-emlx.py <path-to-emlx-file>

The .emlx format is: first line = byte count, then RFC822 message, then Apple
plist. This script extracts and prints the plain text body.

If the email has no text/plain part (HTML-only), falls back to stripping HTML
tags and outputting as plain text.

Exit codes:
  0 — success (body printed to stdout)
  1 — file not found or parse error (message on stderr)
"""

import email
import html as html_mod
import re
import sys


def html_to_text(html):
    """Strip HTML tags and convert to plain text. Uses only stdlib."""
    # Remove style and script blocks
    text = re.sub(
        r"<(style|script)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE
    )
    # Replace br and p tags with newlines
    text = re.sub(r"<br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode HTML entities
    text = html_mod.unescape(text)
    # Collapse whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_body(msg):
    """Extract plain text body from an email message, with HTML fallback."""
    body = None
    html_body = None

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and body is None:
                charset = part.get_content_charset() or "utf-8"
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode(charset, errors="replace")
            elif ct == "text/html" and html_body is None:
                charset = part.get_content_charset() or "utf-8"
                payload = part.get_payload(decode=True)
                if payload:
                    html_body = payload.decode(charset, errors="replace")
    else:
        ct = msg.get_content_type()
        charset = msg.get_content_charset() or "utf-8"
        payload = msg.get_payload(decode=True)
        if payload:
            text = payload.decode(charset, errors="replace")
            if ct == "text/plain":
                body = text
            elif ct == "text/html":
                html_body = text

    if body:
        return body
    elif html_body:
        return html_to_text(html_body)
    return None


def parse_emlx(path):
    try:
        with open(path, "rb") as f:
            byte_count = int(f.readline())
            raw = f.read(byte_count)
            msg = email.message_from_bytes(raw)

            print(f"From: {msg.get('From', 'Unknown')}")
            print(f"Date: {msg.get('Date', '')}")
            print("---")

            body = extract_body(msg)
            if body:
                print(body)
    except FileNotFoundError:
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error parsing {path}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/parse-emlx.py <path>", file=sys.stderr)
        sys.exit(1)
    parse_emlx(sys.argv[1])
