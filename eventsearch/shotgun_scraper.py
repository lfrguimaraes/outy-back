#!/usr/bin/env python3
"""
Script to automatically search shotgun.live/fr for events and extract
correct ticket links and image URLs.
"""

import json
import time
import re
from playwright.sync_api import sync_playwright

def find_search_bar(page):
    """Find the search bar using multiple strategies."""
    # Common selectors for search bars
    selectors = [
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="recherche" i]',
        'input[placeholder*="Rechercher" i]',
        'input[name="search"]',
        'input[name="q"]',
        'input[class*="search"]',
        'input[id*="search"]',
        '[data-testid*="search"]',
        '.search input',
        '#search input',
        'input[aria-label*="search" i]',
        'input[aria-label*="recherche" i]',
    ]
    
    for selector in selectors:
        try:
            element = page.query_selector(selector)
            if element and element.is_visible():
                return element
        except:
            continue
    
    # Try clicking a search button first
    search_buttons = page.query_selector_all('button[aria-label*="search" i], button[aria-label*="recherche" i], [class*="search"][role="button"]')
    for btn in search_buttons:
        try:
            if btn.is_visible():
                btn.click()
                time.sleep(1)
                # Try selectors again after opening search
                for selector in selectors:
                    element = page.query_selector(selector)
                    if element and element.is_visible():
                        return element
        except:
            continue
    
    return None

def extract_image_url_from_page(page):
    """Extract Cloudinary image URL from the event page."""
    try:
        # Method 1: Check Open Graph meta tag
        og_image = page.query_selector('meta[property="og:image"]')
        if og_image:
            image_url = og_image.get_attribute('content')
            if image_url and 'cloudinary.com' in image_url:
                return image_url
        
        # Method 2: Check Twitter card meta tag
        twitter_image = page.query_selector('meta[name="twitter:image"]')
        if twitter_image:
            image_url = twitter_image.get_attribute('content')
            if image_url and 'cloudinary.com' in image_url:
                return image_url
        
        # Method 3: Find img tags with Cloudinary URLs
        images = page.query_selector_all('img')
        for img in images:
            src = img.get_attribute('src')
            srcset = img.get_attribute('srcset')
            
            for url in [src, srcset]:
                if not url:
                    continue
                    
                # Extract URLs from srcset if needed
                if 'cloudinary.com' in url:
                    # Clean up srcset format
                    if ',' in url:
                        url = url.split(',')[0].strip().split(' ')[0]
                    
                    if 'production/artworks' in url or 'artworks' in url:
                        if url.startswith('http'):
                            return url
                        elif url.startswith('//'):
                            return 'https:' + url
                        elif url.startswith('/'):
                            if 'res.cloudinary.com' in url:
                                return 'https:' + url
        
        # Method 4: Check background images in style attributes
        elements = page.query_selector_all('[style*="cloudinary.com"], [style*="background-image"]')
        for elem in elements:
            style = elem.get_attribute('style')
            if style and 'cloudinary.com' in style:
                # Extract URL from background-image: url(...)
                match = re.search(r'url\(["\']?([^"\')]+cloudinary\.com[^"\')]+)', style)
                if match:
                    url = match.group(1)
                    if 'production/artworks' in url or 'artworks' in url:
                        return url if url.startswith('http') else 'https:' + url if url.startswith('//') else url
        
        # Method 5: Check for picture/source elements
        pictures = page.query_selector_all('picture source[srcset*="cloudinary.com"]')
        for pic in pictures:
            srcset = pic.get_attribute('srcset')
            if srcset and 'cloudinary.com' in srcset:
                # Get first URL from srcset
                url = srcset.split(',')[0].strip().split(' ')[0]
                if 'production/artworks' in url or 'artworks' in url:
                    return url if url.startswith('http') else 'https:' + url if url.startswith('//') else url
                    
    except Exception as e:
        print(f"    Error extracting image URL: {e}")
    
    return None

def search_event_on_shotgun(playwright, event_name, event_date, headless=True):
    """Search for an event on shotgun.live/fr and return the URL and image."""
    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    )
    page = context.new_page()
    
    try:
        print(f"    Navigating to shotgun.live/fr...")
        page.goto('https://shotgun.live/fr', wait_until='networkidle', timeout=30000)
        time.sleep(3)  # Wait for page to fully load
        
        # Find search bar using page-level selectors (more reliable)
        print(f"    Looking for search bar...")
        
        # Try to find search input using page.locator (more stable)
        search_selectors = [
            'input[type="search"]',
            'input[placeholder*="recherche" i]',
            'input[placeholder*="Rechercher" i]',
            'input[name="search"]',
            'input[class*="search"]',
        ]
        
        search_locator = None
        for selector in search_selectors:
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=2000):
                    search_locator = locator
                    break
            except:
                continue
        
        if not search_locator:
            page.screenshot(path=f'eventsearch/debug_search_bar_{event_name[:20].replace(" ", "_")}.png')
            print(f"    Could not find search bar. Screenshot saved.")
            browser.close()
            return None, None
        
        print(f"    Found search bar, typing: {event_name}")
        
        # Use page.fill with the selector directly (more reliable)
        try:
            # Click to focus
            search_locator.click()
            time.sleep(0.5)
            
            # Clear and fill using page methods
            search_locator.fill('')
            time.sleep(0.3)
            search_locator.fill(event_name)
            time.sleep(3)  # Wait for search results
            
            # Take a screenshot to see what's happening
            page.screenshot(path=f'eventsearch/debug_search_{event_name[:10].replace(" ", "_")}.png')
            
        except Exception as e:
            print(f"    Error filling search bar: {e}")
            page.screenshot(path=f'eventsearch/debug_error_{event_name[:10].replace(" ", "_")}.png')
            browser.close()
            return None, None
        
        # Look for search results - they might be in a dropdown or new page
        print(f"    Looking for search results...")
        
        # Wait a bit for dropdown results to appear
        time.sleep(2)
        
        # First, try to find results in a dropdown/modal
        dropdown_results = page.query_selector_all('a[href*="/events/"]')
        
        if len(dropdown_results) > 0:
            print(f"    Found {len(dropdown_results)} results in dropdown")
            results = dropdown_results
        else:
            # If no dropdown results, try pressing Enter to submit search
            print(f"    No dropdown results, submitting search...")
            try:
                search_locator.press('Enter')
                time.sleep(4)  # Wait for results page to load
            except:
                # Try using keyboard on the page
                page.keyboard.press('Enter')
                time.sleep(4)
            
            # Now look for event links on the results page
            results = page.query_selector_all('a[href*="/events/"]')
        
        print(f"    Found {len(results)} potential event links")
        
        best_match = None
        best_match_url = None
        
        event_name_lower = event_name.lower().strip()
        # For very short names like "BBB", use the whole name
        if len(event_name) <= 5:
            event_words = [event_name_lower]
        else:
            event_words = [w for w in event_name_lower.split() if len(w) > 2]
        
        for result in results:
            try:
                text = result.inner_text().lower()
                href = result.get_attribute('href')
                
                if not href:
                    continue
                
                # Make sure it's a full URL
                if not href.startswith('http'):
                    href = 'https://shotgun.live' + href if href.startswith('/') else f'https://shotgun.live/{href}'
                
                href_lower = href.lower()
                
                # Debug: print what we found
                print(f"      Checking: {text[:50]}... -> {href}")
                
                # Check if this result matches our event name
                match_score = 0
                
                # Check if event name words are in the text
                for word in event_words:
                    if word in text:
                        match_score += 2  # Text match is worth more
                    if word in href_lower:
                        match_score += 1
                
                # Special handling for short event names like "BBB"
                if len(event_name) <= 5:
                    # For short names, check if they appear as whole words
                    if event_name_lower in text or event_name_lower in href_lower:
                        match_score += 5  # Strong match for exact short name
                
                # Check for partial matches in href (like "bbb-aya-destinee")
                if any(word in href_lower for word in event_words):
                    match_score += 3
                
                if match_score > 0:
                    if not best_match or match_score > best_match.get('score', 0):
                        best_match = {'element': result, 'url': href, 'score': match_score, 'text': text}
                        best_match_url = href
                        print(f"      Match score: {match_score}")
                        
            except Exception as e:
                print(f"    Error processing result: {e}")
                continue
        
        if best_match_url:
            print(f"    Best match found: {best_match_url}")
            print(f"    Navigating to event page...")
            page.goto(best_match_url, wait_until='networkidle', timeout=30000)
            time.sleep(2)
            
            # Extract image URL
            print(f"    Extracting image URL...")
            image_url = extract_image_url_from_page(page)
            
            browser.close()
            return best_match_url, image_url
        else:
            print(f"    No matching event found")
            browser.close()
            return None, None
            
    except Exception as e:
        print(f"    Error: {e}")
        page.screenshot(path=f'eventsearch/debug_error_{event_name[:20].replace(" ", "_")}.png')
        browser.close()
        return None, None

def update_events_json(json_file_path, headless=True):
    """Update the JSON file with correct ticket links and image URLs."""
    # Read the JSON file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"Found {len(events)} events to process\n")
    
    updated_count = 0
    
    with sync_playwright() as playwright:
        for i, event in enumerate(events, 1):
            event_name = event.get('name', '')
            event_date = event.get('date', '')
            current_link = event.get('ticketLink', '')
            
            print(f"[{i}/{len(events)}] Processing: {event_name} ({event_date})")
            
            # Skip if we already have a confirmed link
            if 'the-mayhem-ball-paris-after-parties-2025' in current_link:
                print(f"  ✓ Skipping - already has confirmed link")
                continue
            
            # Search for the event
            ticket_link, image_url = search_event_on_shotgun(playwright, event_name, event_date, headless=headless)
            
            updated = False
            if ticket_link:
                event['ticketLink'] = ticket_link
                updated = True
                print(f"  ✓ Updated ticket link")
            else:
                print(f"  ✗ Could not find ticket link")
            
            if image_url:
                event['imageUrl'] = image_url
                updated = True
                print(f"  ✓ Updated image URL")
            else:
                print(f"  ✗ Could not find image URL")
            
            if updated:
                updated_count += 1
            
            print()
            
            # Small delay between requests
            time.sleep(2)
    
    # Write the updated JSON back
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    
    print(f"✓ JSON file updated! ({updated_count} events updated)")

if __name__ == '__main__':
    import sys
    
    json_file = '../queer_events_2025-11-19_23.json'
    
    # Check if we should run in test mode
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        # Test with just one event first
        print("Testing with one event first...\n")
        # Test with BBB event - try searching with the event name
        # For short names like "BBB", we might need to search with additional context
        test_event = "BBB"
        with sync_playwright() as playwright:
            ticket_link, image_url = search_event_on_shotgun(playwright, test_event, "2025-11-23", headless=False)
            print(f"\nTest Results:")
            print(f"Ticket Link: {ticket_link}")
            print(f"Image URL: {image_url}")
    else:
        # Process all events
        headless_mode = '--headless' in sys.argv
        update_events_json(json_file, headless=headless_mode)

