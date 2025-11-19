#!/usr/bin/env python3
"""
Script to enrich event information from queer.paris.
Checks for missing information and adds events from queer.paris.
"""

import json
import time
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from deep_translator import GoogleTranslator

def extract_event_info_from_queerparis(page, event_url):
    """Extract event information from a queer.paris event page."""
    try:
        page.goto(event_url, wait_until='networkidle', timeout=30000)
        time.sleep(2)
        
        # Dismiss cookies if present
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
        
        event_info = {}
        
        # Extract description
        body = page.locator('body')
        all_text = body.inner_text()
        
        # Look for description/content - try multiple strategies
        # Strategy 1: Look for "Description" section
        desc_sections = page.query_selector_all('[class*="description"], [class*="content"], [class*="text"]')
        for section in desc_sections:
            text = section.inner_text().strip()
            if len(text) > 100 and len(text) < 2000:
                # Check if it's actually a description (not navigation, etc.)
                if 'cookie' not in text.lower() and 'consent' not in text.lower():
                    event_info['description'] = text
                    break
        
        # Strategy 2: Extract from main text - look for event description
        if not event_info.get('description'):
            # Try to find the main event description (usually after event name, before other sections)
            # Look for text that's not in headers/navigation
            lines = all_text.split('\n')
            desc_start = None
            for i, line in enumerate(lines):
                # Look for lines that might start the description
                if len(line) > 30 and len(line) < 500:
                    # Skip navigation, headers
                    if ('revient' in line.lower() or 'pour' in line.lower() or 
                        'vibrer' in line.lower() or 'danser' in line.lower() or
                        'ensemble' in line.lower()):
                        desc_start = i
                        break
            
            if desc_start is not None:
                desc_lines = []
                for line in lines[desc_start:desc_start+5]:  # Get next 5 lines
                    line = line.strip()
                    if line and len(line) > 10:
                        # Stop if we hit price/address section
                        if 'euro' in line.lower() or 'rue' in line.lower() or 'avenue' in line.lower():
                            break
                        desc_lines.append(line)
                
                if desc_lines:
                    desc = ' '.join(desc_lines)
                    if len(desc) > 30:
                        event_info['description'] = desc
            
            # Fallback: use regex patterns
            if not event_info.get('description'):
                description_patterns = [
                    r'(Description[:\s]*.*?)(?=\n\n[^\n]{0,30}(?:Date|Heure|Lieu|Adresse|Prix|Contact|Instagram|$))',
                    r'(À propos[:\s]*.*?)(?=\n\n[^\n]{0,30}(?:Date|Heure|Lieu|Adresse|Prix|Contact|Instagram|$))',
                ]
                
                for pattern in description_patterns:
                    match = re.search(pattern, all_text, re.DOTALL | re.IGNORECASE)
                    if match:
                        desc = match.group(1).strip()
                        desc = re.sub(r'^(description|à propos)[:\s]*', '', desc, flags=re.IGNORECASE)
                        if len(desc) > 50:
                            event_info['description'] = desc
                            break
        
        # Extract address/venue - look for Paris addresses
        address_patterns = [
            r'(\d+\s+[Rr]ue[^,\n]+,\s*\d{5}\s+Paris[^,\n]*)',
            r'(\d+\s+[Aa]venue[^,\n]+,\s*\d{5}\s+Paris[^,\n]*)',
            r'(\d+\s+[Bb]oulevard[^,\n]+,\s*\d{5}\s+Paris[^,\n]*)',
            r'(Adresse[:\s]*([^\n]+))',
            r'(Lieu[:\s]*([^\n]+))',
        ]
        
        for pattern in address_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                addr = match.group(1).strip() if len(match.groups()) == 1 else match.group(2).strip()
                addr = re.sub(r'^(adresse|lieu)[:\s]*', '', addr, flags=re.IGNORECASE)
                if len(addr) > 10 and ('rue' in addr.lower() or 'avenue' in addr.lower() or 'boulevard' in addr.lower() or 'paris' in addr.lower()):
                    # Ensure it ends with France or Paris
                    if not addr.endswith('France'):
                        if 'Paris' in addr:
                            addr += ', France'
                    event_info['address'] = addr
                    break
        
        # Extract price - look for "euros", "€", "Entrée"
        price_patterns = [
            r'(Entrée[:\s—]*(\d+[.,]?\d*)\s*euro)',
            r'(Prix[:\s]*(\d+[.,]?\d*)\s*euro)',
            r'(\d+[.,]?\d*)\s*euro',
            r'(\d+[.,]?\d*)\s*€',
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                price_text = match.group(2) if len(match.groups()) > 1 else match.group(1)
                price_text = price_text.replace(',', '.')
                try:
                    float(price_text)  # Validate it's a number
                    event_info['price'] = price_text
                    break
                except:
                    continue
        
        # Extract Instagram
        instagram_match = re.search(r'instagram\.com/([a-zA-Z0-9_.]+)', all_text)
        if instagram_match:
            event_info['instagram'] = f"https://instagram.com/{instagram_match.group(1)}"
        
        # Extract website/ticket link
        ticket_links = page.query_selector_all('a[href*="shotgun"], a[href*="ticket"], a[href*="billet"], a[href*="queer.paris"]')
        for link in ticket_links:
            href = link.get_attribute('href')
            if href:
                if 'shotgun' in href:
                    if not href.startswith('http'):
                        href = 'https://shotgun.live' + href if href.startswith('/') else f'https://shotgun.live/{href}'
                    event_info['ticketLink'] = href
                    break
        
        return event_info
        
    except Exception as e:
        print(f"    Error extracting from {event_url}: {e}")
        return {}

def find_events_on_queerparis(playwright, start_date, end_date):
    """Find events on queer.paris for the date range."""
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
        
        # Get all event links from the page
        event_links = page.query_selector_all('a[href*="/"]')
        events_found = []
        
        for link in event_links:
            try:
                href = link.get_attribute('href')
                if not href or '/events/' not in href.lower():
                    continue
                
                if not href.startswith('http'):
                    href = 'https://queer.paris' + href if href.startswith('/') else f'https://queer.paris/{href}'
                
                # Get event name from link text
                text = link.inner_text().strip()
                if text and len(text) > 3:
                    events_found.append({
                        'name': text,
                        'url': href
                    })
            except:
                continue
        
        browser.close()
        return events_found
        
    except Exception as e:
        print(f"Error finding events: {e}")
        browser.close()
        return []

def enrich_events_from_queerparis(json_file_path):
    """Enrich events with information from queer.paris."""
    # Read existing events
    with open(json_file_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"Enriching {len(events)} events from queer.paris...\n")
    
    # Create a map of existing events by name (normalized)
    existing_events = {}
    for event in events:
        name_normalized = event.get('name', '').lower().strip()
        existing_events[name_normalized] = event
    
    translator = GoogleTranslator(source='auto', target='en')
    
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        # Check specific events that need enrichment
        events_to_check = [
            {'name': 'La Dimanche', 'url': 'https://queer.paris/LaDimanche-Cafe-A-431696'}
        ]
        
        # Also check all existing events for missing info
        for event in events:
            event_name = event.get('name', '')
            # Check if missing critical info
            missing_info = []
            if not event.get('description') or len(event.get('description', '')) < 50:
                missing_info.append('description')
            if not event.get('address') or event.get('address') == 'Paris, France':
                missing_info.append('address')
            if not event.get('ticketLink'):
                missing_info.append('ticketLink')
            
            if missing_info:
                print(f"Event '{event_name}' missing: {', '.join(missing_info)}")
                # Try to find on queer.paris
                # For now, we'll manually check known ones
        
        # Enrich events that need information
        events_to_enrich = [
            {'name': 'La Dimanche', 'url': 'https://queer.paris/LaDimanche-Cafe-A-431696'},
            # Add more events here as needed
        ]
        
        for event_to_enrich in events_to_enrich:
            event_name = event_to_enrich['name']
            event_url = event_to_enrich['url']
            
            print(f"\nEnriching {event_name}...")
            page = context.new_page()
            info = extract_event_info_from_queerparis(page, event_url)
            
            # Find event in existing events
            found = False
            for event in events:
                if event_name.lower() in event.get('name', '').lower() or event.get('name', '').lower() in event_name.lower():
                    print(f"  Found: {event.get('name')}")
                    found = True
                    
                    # Update missing information
                    if info.get('description') and (not event.get('description') or len(event.get('description', '')) < 50):
                        # Translate description
                        try:
                            desc_en = translator.translate(info['description'])
                            # Format it nicely
                            if desc_en:
                                event['description'] = desc_en
                                print(f"  ✓ Updated description: {desc_en[:100]}...")
                        except Exception as e:
                            event['description'] = info['description']
                            print(f"  ✓ Updated description (not translated): {info['description'][:100]}...")
                    
                    if info.get('address') and (not event.get('address') or event.get('address') == 'Paris, France'):
                        event['address'] = info['address']
                        print(f"  ✓ Updated address: {info['address']}")
                    
                    if info.get('ticketLink') and not event.get('ticketLink'):
                        event['ticketLink'] = info['ticketLink']
                        print(f"  ✓ Updated ticket link")
                    
                    if info.get('price') and not event.get('price'):
                        event['price'] = info['price']
                        print(f"  ✓ Updated price: {info['price']}")
                    
                    if info.get('instagram') and not event.get('instagram'):
                        event['instagram'] = info['instagram']
                        print(f"  ✓ Updated Instagram")
                    
                    break
            
            if not found:
                print(f"  ⚠ Event '{event_name}' not found in existing events")
            
            page.close()
            time.sleep(1)  # Be respectful
        
        browser.close()
    
    # Write updated JSON
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ JSON file updated!")

if __name__ == '__main__':
    json_file = '../queer_events_2025-11-19_23.json'
    enrich_events_from_queerparis(json_file)

