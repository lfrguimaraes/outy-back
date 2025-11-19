# Quick Start - Event Extraction

## Run Full Process
```bash
cd eventsearch
python3 extract_events.py
```

## Options

- `--skip-shotgun` - Skip shotgun.live enrichment (faster)
- `--skip-queerparis` - Skip queer.paris detail pages
- `--dry-run` - Test without saving
- `-i FILE` - Input JSON file (default: ../queer_events_2025-11-19_23.json)
- `-o FILE` - Output JSON file (default: ../queer_events_enriched.json)

## Examples

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

## What It Does

1. Extracts events from queer.paris homepage
2. Enriches from shotgun.live (ticket links, images, descriptions)
3. Fills missing info from queer.paris detail pages
4. Merges with existing events (prevents duplicates)
5. Saves to JSON file

## Duplicate Prevention

Events are considered duplicates if:
- Event names are similar (70%+ match or word overlap)
- AND (date matches OR venue matches)

When duplicates are found, the existing event is updated with new information (doesn't overwrite existing data).

