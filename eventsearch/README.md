# Event Extraction and Enrichment System

This system extracts events from multiple sources, enriches them with information from shotgun.live and queer.paris, and prevents duplicates.

## Quick Start

```bash
cd eventsearch
python3 extract_events.py
```

Or use npm:
```bash
npm run extract-events
```

See [QUICK_START.md](QUICK_START.md) for more examples and options.

## Overview

The system consists of several scripts that work together:

1. **`extract_events.py`** - Main entry point (use this!)
2. **`orchestrate_event_extraction.py`** - Core orchestration logic
3. **`shotgun_scraper.py`** - Searches shotgun.live for events
4. **`enrich_descriptions.py`** - Extracts and formats descriptions
5. **`enrich_from_queerparis.py`** - Extracts info from queer.paris detail pages
6. **`format_names.py`** - Formats event names with Title Case

## Workflow

When you run `extract_events.py`, it:

1. **Extracts events** from queer.paris homepage
   - Finds all event listings with names, times, venues, and URLs
   - Parses date sections (Aujourd'hui, Demain, ven. 21 novembre, etc.)

2. **Enriches from shotgun.live** (priority source)
   - Searches for each event by name
   - Extracts ticket links and image URLs
   - Gets detailed descriptions from event pages
   - Translates French descriptions to English

3. **Fills missing info** from queer.paris detail pages
   - Only fills fields that are still missing
   - Extracts addresses, prices, Instagram links
   - Gets descriptions if not found on shotgun.live

4. **Merges with existing events** (prevents duplicates)
   - Checks for duplicates based on name similarity, date, and venue
   - Updates existing events with new information
   - Adds new events that don't exist yet

5. **Saves results** to JSON file

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install Playwright browser binaries:
```bash
playwright install chromium
```

## Usage

### Main Script (Recommended)

```bash
cd eventsearch
python3 extract_events.py
```

### Options

- `--skip-shotgun` - Skip shotgun.live enrichment (faster, less complete)
- `--skip-queerparis` - Skip queer.paris detail page enrichment
- `--dry-run` - Test without saving results
- `-i FILE` - Input JSON file (default: ../queer_events_2025-11-19_23.json)
- `-o FILE` - Output JSON file (default: ../queer_events_enriched.json)

### Examples

```bash
# Full extraction
python3 extract_events.py

# Quick extraction (no shotgun)
python3 extract_events.py --skip-shotgun

# Test run
python3 extract_events.py --dry-run

# Custom files
python3 extract_events.py -i ../events.json -o ../enriched.json

# Using shell script
./extract_events.sh

# Using npm
npm run extract-events
npm run extract-events:quick
npm run extract-events:dry-run
```

## Duplicate Prevention

Events are considered duplicates if:
- Event names are similar (70%+ match or word overlap)
- AND (date matches OR venue matches)

When duplicates are found, the existing event is updated with new information (doesn't overwrite existing data).

## Individual Scripts

### Shotgun Scraper

Search shotgun.live for events and extract ticket links and image URLs:

```bash
python3 shotgun_scraper.py
```

### Enrich Descriptions

Extract and format descriptions from event pages:

```bash
python3 enrich_descriptions.py
```

### Enrich from Queer.Paris

Extract information from queer.paris detail pages:

```bash
python3 enrich_from_queerparis.py
```

### Format Names

Format all event names with Title Case:

```bash
python3 format_names.py
```

## File Structure

```
eventsearch/
├── extract_events.py              # Main entry point (use this!)
├── extract_events.sh               # Shell wrapper
├── orchestrate_event_extraction.py # Core orchestration
├── shotgun_scraper.py             # Shotgun.live scraper
├── enrich_descriptions.py         # Description extraction
├── enrich_from_queerparis.py      # Queer.paris detail scraper
├── format_names.py                # Name formatting
├── improve_descriptions.py        # Description improvement
├── requirements.txt               # Python dependencies
├── README.md                      # This file
└── QUICK_START.md                 # Quick reference
```

## Requirements

- Python 3.7+
- playwright
- deep-translator

Install with:
```bash
pip install -r requirements.txt
playwright install chromium
```

## Troubleshooting

### No events found on queer.paris
- Check your internet connection
- The website structure might have changed
- Try running with `--skip-queerparis` to use only shotgun.live

### Shotgun.live search fails
- Events might not be listed yet
- Try searching manually to verify the event exists
- Use `--skip-shotgun` for a quicker run

### Duplicate events appearing
- Check the duplicate detection logic in `orchestrate_event_extraction.py`
- Event names might be too different
- Adjust the similarity threshold if needed

## Notes

- The system includes delays between requests to be respectful to servers
- Debug screenshots are saved if something goes wrong
- All descriptions are translated to English
- Event names are formatted with Title Case
- Existing data is never overwritten, only missing fields are filled
