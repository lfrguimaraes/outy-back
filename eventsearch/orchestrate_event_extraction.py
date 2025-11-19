#!/usr/bin/env python3
"""
Orchestrator module for event extraction and enrichment.
Provides functions for coordinating extraction from multiple sources.
"""

import json
import time
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from deep_translator import GoogleTranslator

def normalize_event_name(name):
    """Normalize event name for comparison."""
    if not name:
        return ""
    # Remove special characters, lowercase, strip
    normalized = re.sub(r'[^\w\s]', '', name.lower())
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized

def events_match(event1, event2):
    """Check if two events are the same (same name, date, venue)."""
    name1 = normalize_event_name(event1.get('name', ''))
    name2 = normalize_event_name(event2.get('name', ''))
    
    date1 = event1.get('date', '')
    date2 = event2.get('date', '')
    
    venue1 = normalize_event_name(event1.get('venueName', ''))
    venue2 = normalize_event_name(event2.get('venueName', ''))
    
    # Check name similarity (at least 70% match)
    if name1 and name2:
        # Simple similarity check
        if name1 in name2 or name2 in name1:
            name_match = True
        else:
            # Check word overlap
            words1 = set(name1.split())
            words2 = set(name2.split())
            if words1 and words2:
                overlap = len(words1 & words2) / max(len(words1), len(words2))
                name_match = overlap >= 0.5
            else:
                name_match = False
    else:
        name_match = False
    
    date_match = date1 == date2 if date1 and date2 else False
    venue_match = venue1 == venue2 if venue1 and venue2 else False
    
    # Events match if name is similar AND (date matches OR venue matches)
    return name_match and (date_match or venue_match)

def parse_date_from_section(date_section):
    """Parse date from section header like 'ven. 21 novembre'."""
    if not date_section:
        return None
    
    # Handle "Aujourd'hui", "Demain"
    today = datetime.now()
    if 'aujourd\'hui' in date_section.lower() or 'today' in date_section.lower():
        return today.strftime('%Y-%m-%d')
    elif 'demain' in date_section.lower() or 'tomorrow' in date_section.lower():
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Parse "ven. 21 novembre"
    months_fr = {
        'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
        'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12
    }
    
    match = re.search(r'(\d+)\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)', date_section, re.IGNORECASE)
    if match:
        day = int(match.group(1))
        month_name = match.group(2).lower()
        month = months_fr.get(month_name, today.month)
        year = today.year
        
        # If month has passed, assume next year
        if month < today.month or (month == today.month and day < today.day):
            year += 1
        
        try:
            return datetime(year, month, day).strftime('%Y-%m-%d')
        except:
            return None
    
    return None

def extract_events_from_queerparis_homepage(page):
    """Extract event listings from queer.paris homepage."""
    events = []
    
    try:
        # Get all text from page
        body = page.locator('body')
        all_text = body.inner_text()
        
        # Find all event links
        all_links = page.query_selector_all('a[href]')
        event_urls = {}
        
        for link in all_links:
            try:
                href = link.get_attribute('href')
                text = link.inner_text().strip()
                
                if not href or not text or len(text) < 3:
                    continue
                
                # Skip navigation links
                skip_keywords = ['ajoutez', 'sponsoriser', 'publicité', 'cgu', 'mentions', 'contact',
                               'explorer', 'se connecter', 's\'inscrire', 'voir sur', 'ajouter à',
                               'aujourd\'hui', 'demain', 'hier']
                if any(keyword in text.lower() for keyword in skip_keywords):
                    continue
                
                # Build full URL
                if not href.startswith('http'):
                    if href.startswith('/'):
                        full_url = 'https://queer.paris' + href
                    else:
                        full_url = f'https://queer.paris/{href}'
                else:
                    full_url = href
                
                # Store event URLs
                if 'queer.paris' in full_url:
                    if text not in event_urls:
                        event_urls[text] = full_url
            except:
                continue
        
        # Parse events from text structure
        # Structure: Event name on one line, time on next, venue on next
        lines = [l.strip() for l in all_text.split('\n') if l.strip()]
        current_date_section = None
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Detect date sections
            date_patterns = [
                r'^(Aujourd\'hui|Demain|Hier)$',
                r'^(lun|mar|mer|jeu|ven|sam|dim)\.?\s+\d+\s+(novembre|décembre|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre)',
            ]
            
            for pattern in date_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    current_date_section = line
                    break
            
            # Skip non-event lines
            skip_keywords = ['queer paris', 'événement sponsorisé', 'publicité', 'ajoutez vos événements',
                           'sponsoriser', 'publicité sur', 'cgu', 'mentions légales', 'contact']
            if any(keyword in line.lower() for keyword in skip_keywords):
                i += 1
                continue
            
            # Look for event pattern: name, then time, then venue
            if current_date_section and i + 2 < len(lines):
                event_name = line
                next_line = lines[i + 1] if i + 1 < len(lines) else ''
                next_next_line = lines[i + 2] if i + 2 < len(lines) else ''
                
                # Check if next line has time
                time_match = re.search(r'(\d{1,2}:\d{2})', next_line)
                
                if time_match and len(event_name) > 3:
                    # This looks like an event
                    time_str = time_match.group(1)
                    venue = next_next_line if next_next_line and 'paris' in next_next_line.lower() else None
                    
                    # Clean up venue
                    if venue:
                        venue = re.sub(r'\d+.*?Paris.*?France', '', venue)
                        venue = venue.strip()
                        if not venue or len(venue) < 3:
                            venue = None
                    
                    # Find URL
                    event_url = event_urls.get(event_name)
                    if not event_url:
                        # Try fuzzy matching
                        for name, url in event_urls.items():
                            if event_name.lower() in name.lower() or name.lower() in event_name.lower():
                                event_url = url
                                break
                    
                    # Parse date from section
                    event_date = parse_date_from_section(current_date_section)
                    
                    event = {
                        'name': event_name,
                        'time': time_str,
                        'venueName': venue,
                        'date': event_date,
                        'queerParisUrl': event_url,
                        'source': 'queer.paris'
                    }
                    
                    events.append(event)
                    i += 3  # Skip name, time, venue lines
                    continue
            
            i += 1
        
        return events
        
    except Exception as e:
        print(f"Error extracting from queer.paris: {e}")
        import traceback
        traceback.print_exc()
        return []

def enrich_event_from_shotgun(playwright, event):
    """Enrich event information from shotgun.live."""
    from shotgun_scraper import search_event_on_shotgun, extract_image_url_from_page
    from enrich_descriptions import extract_description_from_page, format_description
    
    event_name = event.get('name', '')
    event_date = event.get('date', '')
    
    print(f"  Searching shotgun.live for: {event_name}")
    
    ticket_link, image_url = search_event_on_shotgun(playwright, event_name, event_date, headless=True)
    
    if ticket_link:
        event['ticketLink'] = ticket_link
        print(f"  ✓ Found ticket link: {ticket_link}")
    
    if image_url:
        event['imageUrl'] = image_url
        print(f"  ✓ Found image URL")
    
    # If we have a ticket link, try to get description
    if ticket_link:
        try:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(ticket_link, wait_until='networkidle', timeout=30000)
            time.sleep(2)
            
            description = extract_description_from_page(page)
            if description:
                formatted_desc = format_description(description, None, None, event_name, event.get('venueName'))
                if formatted_desc:
                    event['description'] = formatted_desc
                    print(f"  ✓ Found description")
            
            page.close()
            browser.close()
        except Exception as e:
            print(f"  ⚠ Could not extract description: {e}")
    
    return event

def enrich_event_from_queerparis(page, event):
    """Enrich event information from queer.paris detail page."""
    from enrich_from_queerparis import extract_event_info_from_queerparis
    
    queer_url = event.get('queerParisUrl')
    if not queer_url:
        return event
    
    print(f"  Enriching from queer.paris: {queer_url}")
    
    info = extract_event_info_from_queerparis(page, queer_url)
    
    # Only update missing fields
    if info.get('description') and not event.get('description'):
        translator = GoogleTranslator(source='auto', target='en')
        try:
            desc_en = translator.translate(info['description'])
            event['description'] = desc_en
            print(f"  ✓ Updated description")
        except:
            event['description'] = info['description']
    
    if info.get('address') and not event.get('address'):
        event['address'] = info['address']
        print(f"  ✓ Updated address")
    
    if info.get('price') and not event.get('price'):
        event['price'] = info['price']
        print(f"  ✓ Updated price")
    
    if info.get('ticketLink') and not event.get('ticketLink'):
        event['ticketLink'] = info['ticketLink']
        print(f"  ✓ Updated ticket link")
    
    if info.get('instagram') and not event.get('instagram'):
        event['instagram'] = info['instagram']
        print(f"  ✓ Updated Instagram")
    
    return event

def merge_events(existing_events, new_events):
    """Merge new events with existing ones, preventing duplicates."""
    merged = existing_events.copy()
    
    for new_event in new_events:
        # Check if event already exists
        found_duplicate = False
        for i, existing_event in enumerate(merged):
            if events_match(new_event, existing_event):
                found_duplicate = True
                # Update existing event with new information (don't overwrite existing data)
                print(f"  Found duplicate: {new_event.get('name')} - Updating existing event")
                for key, value in new_event.items():
                    if value and not existing_event.get(key):
                        existing_event[key] = value
                merged[i] = existing_event
                break
        
        if not found_duplicate:
            merged.append(new_event)
            print(f"  Added new event: {new_event.get('name')}")
    
    return merged

