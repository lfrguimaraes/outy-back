#!/bin/bash
# Simple wrapper script to extract events
# Usage: ./extract_events.sh [options]

cd "$(dirname "$0")"
python3 extract_events.py "$@"

