# Event Extraction System - Complete Overview

## 🎯 Purpose

Automatically extract events from queer.paris, enrich them with data from shotgun.live (priority) and queer.paris detail pages, and merge with existing events while preventing duplicates.

## 🚀 Quick Start

```bash
# Full extraction (recommended)
cd eventsearch
python3 extract_events.py

# Or use npm
npm run extract-events
```

## 📋 Complete Workflow

### Step 1: Extract from queer.paris Homepage
- Scrapes https://queer.paris/
- Finds all event listings
- Extracts: name, time, venue, date, URL

### Step 2: Enrich from shotgun.live (Priority)
- Searches shotgun.live/fr for each event
- Extracts: ticket links, image URLs, descriptions
- Translates descriptions to English
- Formats descriptions consistently

### Step 3: Fill Missing Info from queer.paris Detail Pages
- Only fills fields still missing
- Extracts: addresses, prices, Instagram links, descriptions

### Step 4: Merge with Existing Events
- Prevents duplicates based on:
  - Name similarity (70%+ match)
  - Date match OR venue match
- Updates existing events (doesn't overwrite)
- Adds new events

### Step 5: Save Results
- Saves to JSON file
- Preserves all existing data

## 📁 Files Created

### Main Scripts
- **`extract_events.py`** - Main entry point (use this!)
- **`extract_events.sh`** - Shell wrapper
- **`orchestrate_event_extraction.py`** - Core logic

### Supporting Scripts
- **`shotgun_scraper.py`** - Shotgun.live search & extraction
- **`enrich_descriptions.py`** - Description extraction & formatting
- **`enrich_from_queerparis.py`** - Queer.paris detail page scraper
- **`format_names.py`** - Title Case formatting
- **`improve_descriptions.py`** - Description improvement

### Documentation
- **`README.md`** - Complete documentation
- **`QUICK_START.md`** - Quick reference guide
- **`SYSTEM_OVERVIEW.md`** - This file

## 🔧 Usage Examples

### Basic Usage
```bash
python3 extract_events.py
```

### Quick Run (Skip shotgun.live)
```bash
python3 extract_events.py --skip-shotgun
```

### Test Run (No Save)
```bash
python3 extract_events.py --dry-run
```

### Custom Files
```bash
python3 extract_events.py -i ../my_events.json -o ../my_enriched.json
```

### Using Shell Script
```bash
./extract_events.sh
```

### Using NPM
```bash
npm run extract-events          # Full
npm run extract-events:quick   # Skip shotgun
npm run extract-events:dry-run # Test
```

## 🎛️ Command-Line Options

| Option | Description |
|--------|-------------|
| `-i, --input FILE` | Input JSON file (default: ../queer_events_2025-11-19_23.json) |
| `-o, --output FILE` | Output JSON file (default: ../queer_events_enriched.json) |
| `--skip-shotgun` | Skip shotgun.live enrichment (faster) |
| `--skip-queerparis` | Skip queer.paris detail pages |
| `--dry-run` | Test without saving |

## 🔄 Duplicate Detection

Events are considered duplicates if:
1. Names are similar (70%+ match or significant word overlap)
2. AND (date matches OR venue matches)

When duplicates are found:
- Existing event is updated
- New information fills missing fields
- Existing data is never overwritten

## 📊 Output Format

The system outputs JSON files with event objects containing:
- `name` - Event name (Title Case)
- `date` - Date (YYYY-MM-DD)
- `startDate` - ISO datetime
- `endDate` - ISO datetime
- `city` - City name
- `venueName` - Venue name
- `address` - Full address
- `description` - Formatted description (English)
- `imageUrl` - Image URL (Cloudinary preferred)
- `ticketLink` - Ticket purchase link
- `price` - Price (string or number)
- `instagram` - Instagram URL
- `website` - Website URL
- `music` - Array of music genres
- `type` - Event type (Bar, Club, etc.)

## ⚙️ Configuration

### Default Files
- Input: `../queer_events_2025-11-19_23.json`
- Output: `../queer_events_enriched.json`

### Dependencies
- Python 3.7+
- playwright
- deep-translator

Install with:
```bash
pip install -r requirements.txt
playwright install chromium
```

## 🐛 Troubleshooting

### No events found
- Check internet connection
- Website structure may have changed
- Try `--skip-queerparis` or `--skip-shotgun`

### Import errors
- Ensure all dependencies are installed
- Check Python version (3.7+)
- Verify Playwright browsers are installed

### Duplicate events
- Check duplicate detection logic
- Adjust similarity threshold if needed
- Verify date/venue matching

## 📝 Notes

- System includes delays to be respectful to servers
- All descriptions translated to English
- Event names formatted with Title Case
- Existing data never overwritten
- Debug screenshots saved on errors

## 🎉 Success!

The system is ready to use! Run `python3 extract_events.py` whenever you want to update your events.

