#!/usr/bin/env python3
"""
Script to enrich event descriptions by extracting from event pages,
translating to English, and formatting consistently.
"""

import json
import time
import re
from playwright.sync_api import sync_playwright
from deep_translator import GoogleTranslator

def extract_description_from_page(page):
    """Extract and parse description from event page."""
    try:
        # Strategy 0: Get all page text and search for description patterns
        # This is the most reliable method for shotgun.live pages
        
        body = page.locator('body')
        all_text = body.inner_text()
        
        # Look for description starting patterns (common French event description starts)
        description_patterns = [
            r'(Nouveauté pour.*?)(?=\n\n[^\n]{0,30}(?:VESTIAIRE|INFO|PRATIQUE|CONSENTEMENT|PARTENAIRES)|$)',
            r'(À propos[:\s]*.*?)(?=\n\n[^\n]{0,30}(?:VESTIAIRE|INFO|PRATIQUE|CONSENTEMENT|PARTENAIRES)|$)',
            r'(About[:\s]*.*?)(?=\n\n[^\n]{0,30}(?:VESTIAIRE|INFO|PRATIQUE|CONSENTEMENT|PARTENAIRES)|$)',
            r'(Description[:\s]*.*?)(?=\n\n[^\n]{0,30}(?:VESTIAIRE|INFO|PRATIQUE|CONSENTEMENT|PARTENAIRES)|$)',
        ]
        
        for pattern in description_patterns:
            match = re.search(pattern, all_text, re.DOTALL | re.IGNORECASE)
            if match:
                extracted = match.group(1).strip()
                # Remove "À propos" header if present
                extracted = re.sub(r'^[àa] propos[:\s]*', '', extracted, flags=re.IGNORECASE)
                extracted = re.sub(r'^about[:\s]*', '', extracted, flags=re.IGNORECASE)
                extracted = re.sub(r'^description[:\s]*', '', extracted, flags=re.IGNORECASE)
                
                if len(extracted) > 200:  # Substantial content
                    return extracted.strip()
        
        # Strategy 1: Fallback - look for divs with substantial content
        about_keywords = ['à propos', 'about', 'description', 'details', 'info']
        
        all_divs = page.query_selector_all('div')
        best_content = None
        best_length = 0
        
        for div in all_divs:
            try:
                text = div.inner_text()
                if not text:
                    continue
                
                text_lower = text.lower()
                
                # Look for divs that contain "À propos" or similar and have substantial content
                has_about_keyword = any(keyword in text_lower[:200] for keyword in about_keywords)
                has_event_keywords = any(keyword in text_lower for keyword in ['dj', 'music', 'scène', 'scene', 'stage', 'dress', 'tenue', 'lineup', 'line-up', 'mainstage', 'playstage'])
                
                # Filter for substantial content that looks like event description
                if (len(text) > 500 and  # Substantial content
                    len(text) < 10000 and  # Not too long
                    'cookie' not in text_lower and
                    'consent' not in text_lower and
                    'discover upcoming events' not in text_lower and
                    (has_about_keyword or has_event_keywords)):
                    
                    # Prefer content that has "À propos" and event keywords
                    score = len(text)
                    if has_about_keyword:
                        score += 1000
                    if has_event_keywords:
                        score += 500
                    
                    if score > best_length:
                        best_content = text
                        best_length = score
            except:
                continue
        
        if best_content and len(best_content) > 500:
            # Try to extract just the description part
            lines = best_content.split('\n')
            about_start = None
            for i, line in enumerate(lines):
                line_lower = line.lower().strip()
                if any(keyword in line_lower for keyword in about_keywords) and len(line) < 50:
                    about_start = i + 1
                    break
            
            if about_start is not None:
                stop_keywords = ['vestiaire', 'info', 'pratique', 'consentement', 'partenaires']
                extracted_lines = []
                for line in lines[about_start:]:
                    line_lower = line.lower().strip()
                    if any(keyword in line_lower for keyword in stop_keywords) and len(line.strip()) < 80:
                        if not (line_lower.startswith(keyword) or ':' in line[:20]):
                            break
                    extracted_lines.append(line)
                
                if extracted_lines:
                    result = '\n'.join(extracted_lines).strip()
                    result = re.sub(r'^[àa] propos[:\s]*', '', result, flags=re.IGNORECASE)
                    if len(result) > 200:
                        return result.strip()
            
            return best_content.strip()
        
        # Strategy 1: Check JSON-LD structured data
        try:
            json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
            for script in json_ld_scripts:
                try:
                    import json as json_lib
                    data = json_lib.loads(script.inner_text())
                    if isinstance(data, dict):
                        if 'description' in data:
                            desc = data['description']
                            if desc and len(desc) > 50:
                                return desc
                        # Check if it's an Event schema
                        if data.get('@type') == 'Event' and 'description' in data:
                            desc = data['description']
                            if desc and len(desc) > 50:
                                return desc
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get('@type') == 'Event':
                                if 'description' in item:
                                    desc = item['description']
                                    if desc and len(desc) > 50:
                                        return desc
                except:
                    continue
        except:
            pass
        
        # Strategy 1: Look for common description class names (prioritize these)
        description_selectors = [
            '[class*="description"]',
            '[class*="Description"]',
            '[class*="content"]',
            '[class*="text"]',
            '[data-testid*="description"]',
            '.event-description',
            '[itemprop="description"]',
        ]
        
        for selector in description_selectors:
            try:
                elements = page.query_selector_all(selector)
                for elem in elements:
                    text = elem.inner_text().strip()
                    # Filter out navigation, headers, ticket info, etc.
                    if (text and len(text) > 80 and  # Longer than meta description
                        len(text) < 2000 and  # Not too long
                        not text.startswith('http') and  # Not a URL
                        'billet' not in text.lower() and  # Not ticket info
                        'ticket' not in text.lower() and  # Not ticket info
                        'cookie' not in text.lower() and  # Not cookie notice
                        'privacy' not in text.lower() and  # Not privacy policy
                        'november' not in text.lower()[:50]):  # Not date info
                        return text
            except:
                continue
        
        # Strategy 2: Look for sections with event content
        try:
            sections = page.query_selector_all('section, [class*="event"], [class*="detail"], [class*="info"]')
            for section in sections:
                text = section.inner_text().strip()
                # Look for sections that contain event-specific info (not generic)
                if (text and len(text) > 100 and 
                    len(text) < 1000 and
                    not 'discover upcoming events' in text.lower() and
                    not 'billet' in text.lower()[:50] and
                    not text.startswith('http')):
                    # Check if it looks like event content (has venue, date, or event name patterns)
                    if any(keyword in text.lower() for keyword in ['club', 'venue', 'paris', 'rue', 'nov', 'dec', 'dj', 'music']):
                        # Extract just the descriptive part (skip ticket/date info)
                        lines = [l.strip() for l in text.split('\n') if l.strip()]
                        desc_lines = []
                        for line in lines:
                            # Skip lines that are clearly ticket/date info
                            if (not re.match(r'^\d+', line) and  # Doesn't start with number
                                '€' not in line and  # Not price
                                'billet' not in line.lower() and
                                'ticket' not in line.lower() and
                                len(line) > 20):
                                desc_lines.append(line)
                                if len(desc_lines) >= 3:
                                    break
                        
                        if desc_lines:
                            combined = ' '.join(desc_lines)
                            if len(combined) > 50:
                                return combined
        except:
            pass
        
        # Strategy 3: Get main content and extract meaningful paragraphs
        try:
            main_content = page.query_selector('main, [role="main"], article, [class*="event"]')
            if main_content:
                paragraphs = main_content.query_selector_all('p')
                texts = []
                for p in paragraphs:
                    text = p.inner_text().strip()
                    # Filter better
                    if (text and len(text) > 50 and 
                        len(text) < 500 and
                        not text.startswith('http') and
                        'billet' not in text.lower()[:30] and
                        'ticket' not in text.lower()[:30] and
                        'discover upcoming' not in text.lower() and
                        not re.match(r'^\d{1,2}\s+(nov|dec|jan)', text.lower())):  # Not date
                        texts.append(text)
                
                if texts:
                    # Join first 2-3 meaningful paragraphs
                    combined = ' '.join(texts[:3])
                    if len(combined) > 80:
                        return combined
        except:
            pass
        
        # Strategy 3: Try to find any substantial text block (excluding cookie/privacy)
        try:
            # Get text from main content area only
            main_content = page.query_selector('main, [role="main"], article, [class*="event"], [class*="Event"]')
            if main_content:
                all_text = main_content.inner_text()
            else:
                all_text = page.inner_text()
            
            # Look for paragraphs that are substantial
            lines = [line.strip() for line in all_text.split('\n') if line.strip()]
            meaningful_lines = []
            skip_keywords = ['cookie', 'consent', 'privacy', 'billet', 'ticket', 'november', 'nov', 'décembre', 'december']
            
            for line in lines:
                line_lower = line.lower()
                # Skip if contains skip keywords
                if any(keyword in line_lower[:50] for keyword in skip_keywords):
                    continue
                
                # Skip generic shotgun.live text
                if 'discover upcoming events' in line_lower or 'buy your tickets' in line_lower:
                    continue
                    
                if (len(line) > 50 and 
                    len(line) < 400 and
                    not line.startswith('http') and
                    '€' not in line and  # Not price
                    not re.match(r'^\d+', line) and  # Doesn't start with number
                    not re.match(r'^\d{1,2}\s+(nov|dec|jan)', line_lower)):
                    meaningful_lines.append(line)
                    if len(meaningful_lines) >= 3:  # Get 3 lines
                        break
            
            if meaningful_lines:
                combined = ' '.join(meaningful_lines)
                if len(combined) > 80:
                    return combined
        except:
            pass
        
        return None
        
    except Exception as e:
        print(f"    Error extracting description: {e}")
        return None

def extract_lineup_from_page(page):
    """Extract lineup/artists from event page."""
    try:
        # Get all text from page
        page_text = page.inner_text()
        
        # Look for lineup keywords and extract the section
        lineup_keywords = ['line-up', 'lineup', 'line up', 'artistes', 'artists', 'dj', 'djs', 'avec', 'with', 'feat', 'featuring']
        
        # Try to find sections with lineup keywords
        elements = page.query_selector_all('p, div, span, li')
        for elem in elements:
            text = elem.inner_text().strip().lower()
            if any(keyword in text for keyword in lineup_keywords):
                parent_text = elem.inner_text().strip()
                if len(parent_text) > 20 and len(parent_text) < 500:
                    return parent_text
        
        # Try to find artist names (common patterns)
        # Look for text that contains multiple capitalized words (likely artist names)
        for elem in elements:
            text = elem.inner_text().strip()
            # Check if it looks like a lineup (multiple words, some capitalized)
            words = text.split()
            if len(words) >= 2 and len(words) <= 10:
                capitalized_count = sum(1 for w in words if w and w[0].isupper())
                if capitalized_count >= len(words) * 0.5:  # At least 50% capitalized
                    return text
        
        return None
        
    except Exception as e:
        return None

def extract_dress_code_from_page(page):
    """Extract dress code information."""
    try:
        dress_code_keywords = ['dress code', 'tenue', 'code vestimentaire', 'black & white', 'black and white']
        
        # Search in all text
        page_text = page.inner_text().lower()
        for keyword in dress_code_keywords:
            if keyword in page_text:
                # Try to find the sentence containing this keyword
                elements = page.query_selector_all('p, div, span')
                for elem in elements:
                    text = elem.inner_text().lower()
                    if keyword in text:
                        return elem.inner_text().strip()
        
        return None
    except:
        return None

def parse_and_format_description(raw_description, event_name=None, venue_name=None):
    """Parse raw description and format it consistently."""
    if not raw_description:
        return None
    
    translator = GoogleTranslator(source='auto', target='en')
    
    # Translate to English
    try:
        description_en = translator.translate(raw_description)
    except Exception as e:
        print(f"    Translation error: {e}")
        description_en = raw_description
    
    # Clean up whitespace
    description_en = re.sub(r'\s+', ' ', description_en).strip()
    
    # Parse the description into sections
    parts = []
    
    # Extract main description (before lineup/dress code sections)
    main_desc = description_en
    
    # Look for lineup section
    lineup_match = re.search(r'(mainstage|playstage|line.?up|line-up|artists?|djs?)[:\s]+(.*?)(?=\n\n|dress|code|vestiaire|info|pratique|consentement|$)', 
                            description_en, re.IGNORECASE | re.DOTALL)
    
    # Look for dress code section
    dress_code_match = re.search(r'(dress.?code|tenue|code vestimentaire)[:\s]+(.*?)(?=\n\n|vestiaire|info|pratique|consentement|$)', 
                                 description_en, re.IGNORECASE | re.DOTALL)
    
    # Extract main description (before special sections)
    if lineup_match or dress_code_match:
        # Find the earliest special section
        positions = []
        if lineup_match:
            positions.append(lineup_match.start())
        if dress_code_match:
            positions.append(dress_code_match.start())
        
        if positions:
            main_desc = description_en[:min(positions)].strip()
    
    # Format main description (first 2-3 sentences, max 300 chars)
    if main_desc:
        sentences = re.split(r'[.!?]+', main_desc)
        sentences = [s.strip() for s in sentences if s.strip() and len(s) > 10]
        
        if sentences:
            # Take first 2-3 sentences
            main_text = '. '.join(sentences[:3])
            if len(main_text) > 300:
                main_text = main_text[:297] + "..."
            
            if main_text:
                parts.append(main_text)
    
    # Format lineup
    if lineup_match:
        lineup_text = lineup_match.group(2).strip()
        # Clean up lineup
        lineup_text = re.sub(r'\s+', ' ', lineup_text)
        # Remove URLs
        lineup_text = re.sub(r'https?://[^\s]+', '', lineup_text)
        # Remove Instagram handles but keep names
        lineup_text = re.sub(r'@[\w.]+', '', lineup_text)
        lineup_text = re.sub(r'\s+', ' ', lineup_text).strip()
        
        if lineup_text and len(lineup_text) > 20 and len(lineup_text) < 500:
            parts.append(f"\n\n🎧 Lineup:\n{lineup_text}")
    
    # Format dress code
    if dress_code_match:
        dress_code_text = dress_code_match.group(2).strip()
        # Clean up dress code
        dress_code_text = re.sub(r'\s+', ' ', dress_code_text)
        # Extract key info (first 2 sentences)
        dress_sentences = re.split(r'[.!?]+', dress_code_text)
        dress_sentences = [s.strip() for s in dress_sentences if s.strip() and len(s) > 10]
        
        if dress_sentences:
            dress_text = '. '.join(dress_sentences[:2])
            if len(dress_text) > 200:
                dress_text = dress_text[:197] + "..."
            
            if dress_text:
                parts.append(f"\n\n👔 Dress Code: {dress_text}")
    
    result = ''.join(parts).strip()
    return result if result else None

def format_description(raw_description, lineup=None, dress_code=None, event_name=None, venue_name=None):
    """Format description in a consistent, user-friendly pattern."""
    # Use the new parsing function
    return parse_and_format_description(raw_description, event_name, venue_name)

def enrich_event_descriptions(json_file_path):
    """Enrich descriptions for all events."""
    # Read the JSON file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"Enriching descriptions for {len(events)} events...\n")
    
    # Remove bad links first
    bad_links = ['https://shotgun.live/fr/events/la-dimanche']
    
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        
        for i, event in enumerate(events, 1):
            event_name = event.get('name', '')
            ticket_link = event.get('ticketLink', '')
            
            # Remove bad links
            if ticket_link in bad_links:
                print(f"[{i}/{len(events)}] {event_name}")
                print(f"  ✗ Removing bad link: {ticket_link}")
                event['ticketLink'] = ""
                continue
            
            if not ticket_link or not ticket_link.startswith('https://shotgun.live'):
                print(f"[{i}/{len(events)}] {event_name}")
                print(f"  ⏭ Skipping - no valid ticket link")
                continue
            
            print(f"[{i}/{len(events)}] {event_name}")
            print(f"  Processing: {ticket_link}")
            
            try:
                page = context.new_page()
                page.goto(ticket_link, wait_until='networkidle', timeout=30000)
                time.sleep(3)
                
                # Try to dismiss cookie dialog if present
                try:
                    cookie_buttons = page.query_selector_all('button[id*="cookie"], button[class*="cookie"], [aria-label*="accept" i], [aria-label*="accepter" i]')
                    for btn in cookie_buttons:
                        if btn.is_visible():
                            btn.click()
                            time.sleep(1)
                            break
                except:
                    pass
                
                # Wait a bit more for content to load
                time.sleep(2)
                
                # Extract information
                description = extract_description_from_page(page)
                
                # Format description (lineup and dress code are extracted from description)
                formatted_desc = format_description(
                    description,
                    None,  # lineup extracted from description
                    None,  # dress_code extracted from description
                    event_name,
                    event.get('venueName', '')
                )
                
                if formatted_desc:
                    event['description'] = formatted_desc
                    print(f"  ✓ Updated description")
                else:
                    print(f"  ⚠ Could not extract description")
                
                page.close()
                time.sleep(1)  # Be respectful
                
            except Exception as e:
                print(f"  ✗ Error: {e}")
                continue
        
        browser.close()
    
    # Write the updated JSON back
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ JSON file updated!")

if __name__ == '__main__':
    json_file = '../queer_events_2025-11-19_23.json'
    enrich_event_descriptions(json_file)

