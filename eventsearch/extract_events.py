#!/usr/bin/env python3
"""
Main entry point for event extraction and enrichment.
Run this script manually whenever you want to update events.
"""

import sys
import os
import argparse
from datetime import datetime
import json
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from orchestrate_event_extraction import (
    extract_events_from_queerparis_homepage,
    enrich_event_from_shotgun,
    enrich_event_from_queerparis,
    merge_events
)
from playwright.sync_api import sync_playwright

def main():
    parser = argparse.ArgumentParser(description='Extract and enrich events from queer.paris and shotgun.live')
    parser.add_argument('--output', '-o', default='../queer_events_enriched.json',
                       help='Output JSON file path (default: ../queer_events_enriched.json)')
    parser.add_argument('--input', '-i', default='../queer_events_2025-11-19_23.json',
                       help='Input JSON file with existing events (default: ../queer_events_2025-11-19_23.json)')
    parser.add_argument('--skip-shotgun', action='store_true',
                       help='Skip shotgun.live enrichment (faster, less complete)')
    parser.add_argument('--skip-queerparis', action='store_true',
                       help='Skip queer.paris detail page enrichment')
    parser.add_argument('--dry-run', action='store_true',
                       help='Run without saving results')
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("EVENT EXTRACTION AND ENRICHMENT")
    print("=" * 70)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Input file: {args.input}")
    print(f"Output file: {args.output}")
    print()
    
    # Load existing events
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            existing_events = json.load(f)
        print(f"✓ Loaded {len(existing_events)} existing events from {args.input}")
    except FileNotFoundError:
        print(f"⚠ Input file not found: {args.input}")
        print("  Starting with empty event list")
        existing_events = []
    except Exception as e:
        print(f"✗ Error loading input file: {e}")
        return 1
    
    # Step 1: Extract from queer.paris
    print("\n" + "=" * 70)
    print("STEP 1: Extracting events from queer.paris homepage")
    print("=" * 70)
    
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            page.goto('https://queer.paris/', wait_until='networkidle', timeout=30000)
            time.sleep(3)
            
            # Dismiss cookies
            try:
                cookie_buttons = page.query_selector_all('button[id*="cookie"], button[class*="cookie"], [aria-label*="accept" i]')
                for btn in cookie_buttons:
                    if btn.is_visible():
                        btn.click()
                        time.sleep(1)
                        break
            except:
                pass
            
            time.sleep(2)
            
            queer_paris_events = extract_events_from_queerparis_homepage(page)
            print(f"\n✓ Extracted {len(queer_paris_events)} events from queer.paris")
            
            if not queer_paris_events:
                print("⚠ No events found on queer.paris")
                browser.close()
                return 1
            
            # Step 2: Enrich from shotgun.live
            if not args.skip_shotgun:
                print("\n" + "=" * 70)
                print("STEP 2: Enriching from shotgun.live (priority)")
                print("=" * 70)
                
                for i, event in enumerate(queer_paris_events, 1):
                    print(f"\n[{i}/{len(queer_paris_events)}] {event.get('name')}")
                    enrich_event_from_shotgun(playwright, event)
                    time.sleep(1)
            else:
                print("\n" + "=" * 70)
                print("STEP 2: Skipped (--skip-shotgun flag)")
                print("=" * 70)
            
            # Step 3: Fill missing info from queer.paris detail pages
            if not args.skip_queerparis:
                print("\n" + "=" * 70)
                print("STEP 3: Filling missing info from queer.paris detail pages")
                print("=" * 70)
                
                for i, event in enumerate(queer_paris_events, 1):
                    print(f"\n[{i}/{len(queer_paris_events)}] {event.get('name')}")
                    enrich_event_from_queerparis(page, event)
                    time.sleep(1)
            else:
                print("\n" + "=" * 70)
                print("STEP 3: Skipped (--skip-queerparis flag)")
                print("=" * 70)
            
            browser.close()
            
        except Exception as e:
            print(f"\n✗ Error during extraction: {e}")
            import traceback
            traceback.print_exc()
            browser.close()
            return 1
    
    # Step 4: Merge with existing events
    print("\n" + "=" * 70)
    print("STEP 4: Merging events (preventing duplicates)")
    print("=" * 70)
    
    merged_events = merge_events(existing_events, queer_paris_events)
    
    new_count = len(merged_events) - len(existing_events)
    updated_count = len(queer_paris_events) - new_count
    
    print(f"\n✓ Total events after merge: {len(merged_events)}")
    print(f"✓ New events added: {new_count}")
    print(f"✓ Existing events updated: {updated_count}")
    
    # Step 5: Save results
    if not args.dry_run:
        print("\n" + "=" * 70)
        print("STEP 5: Saving results")
        print("=" * 70)
        
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(merged_events, f, indent=2, ensure_ascii=False)
            print(f"✓ Saved {len(merged_events)} events to {args.output}")
        except Exception as e:
            print(f"✗ Error saving file: {e}")
            return 1
    else:
        print("\n" + "=" * 70)
        print("STEP 5: Skipped (--dry-run flag)")
        print("=" * 70)
        print(f"Would save {len(merged_events)} events to {args.output}")
    
    print("\n" + "=" * 70)
    print("COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

