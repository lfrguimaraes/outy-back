#!/usr/bin/env python3
"""Test description extraction with one event."""

import sys
sys.path.insert(0, '.')
from enrich_descriptions import extract_description_from_page, extract_lineup_from_page, extract_dress_code_from_page, format_description
from playwright.sync_api import sync_playwright
from deep_translator import GoogleTranslator

def test_event(url):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(url, wait_until='networkidle', timeout=30000)
        time.sleep(3)
        
        print(f"Testing: {url}\n")
        
        # Take screenshot to see structure
        page.screenshot(path='eventsearch/debug_page.png')
        print("Screenshot saved to debug_page.png\n")
        
        # Print page structure
        print("Looking for description elements...\n")
        
        # Check main content area
        main = page.query_selector('main')
        if main:
            print(f"Main content text length: {len(main.inner_text())}\n")
            print(f"First 500 chars: {main.inner_text()[:500]}\n\n")
        
        # Get page HTML to inspect structure
        html_content = page.content()
        
        # Look for event-specific content
        # Check if event name appears in page
        event_name_in_page = 'bbb' in html_content.lower() or 'aya' in html_content.lower() or 'destinée' in html_content.lower()
        print(f"Event name found in page: {event_name_in_page}\n")
        
        # Try to find content near the event name
        # Look for h1, h2 tags
        headings = page.query_selector_all('h1, h2, h3')
        print(f"Found {len(headings)} headings\n")
        for i, h in enumerate(headings[:5]):
            text = h.inner_text().strip()
            if text:
                print(f"H[{i}]: {text}\n")
        
        # Look for sections with event info
        sections = page.query_selector_all('section, [class*="info"], [class*="detail"]')
        print(f"Found {len(sections)} sections\n")
        for i, s in enumerate(sections[:5]):
            text = s.inner_text().strip()
            if text and 50 < len(text) < 500:
                print(f"Section[{i}]: {text[:200]}...\n")
        
        description = extract_description_from_page(page)
        print(f"\nExtracted Description: {description[:300] if description else 'None'}...\n")
        
        lineup = extract_lineup_from_page(page)
        print(f"Lineup: {lineup}\n")
        
        dress_code = extract_dress_code_from_page(page)
        print(f"Dress Code: {dress_code}\n")
        
        formatted = format_description(description, lineup, dress_code)
        print(f"\nFormatted:\n{formatted}\n")
        
        browser.close()

if __name__ == '__main__':
    import time
    test_event('https://shotgun.live/fr/events/bbb-aya-destinee-release-party')

