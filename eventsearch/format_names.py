#!/usr/bin/env python3
"""
Script to format event names with Title Case.
Capitalizes first letter of each word except connectors.
"""

import json
import re

# Words that should remain lowercase (unless first or last word)
LOWERCASE_WORDS = {
    'of', 'from', 'and', 'the', 'to', 'for', 'in', 'on', 'at', 'by', 
    'with', 'a', 'an', 'as', 'but', 'or', 'nor', 'so', 'yet', 'de', 
    'la', 'le', 'les', 'du', 'des', 'et', 'ou', 'x'
}

def is_acronym(word):
    """Check if a word is an acronym (all caps, short)."""
    if len(word) <= 1:
        return False
    
    # Remove dots and check the base
    base = word.replace('.', '')
    
    # If it's all uppercase and short (like BFF, BBB, T7)
    if base.isupper() and len(base) <= 5:
        return True
    
    # If it's all uppercase letters (even if mixed case originally, treat as acronym if short)
    if base.isalpha() and len(base) <= 5 and base.upper() == base:
        return True
    
    return False

def title_case(name):
    """Convert event name to Title Case with proper handling of connectors."""
    if not name:
        return name
    
    # Check if entire name is an acronym
    if is_acronym(name.replace(' ', '').replace('-', '').replace('.', '')):
        return name  # Keep acronyms as-is
    
    # Split by spaces, hyphens, and other separators while preserving them
    # Use regex to split but keep separators
    parts = re.split(r'([\s\-–—/])', name)
    
    # Track which parts are actual words (not separators)
    word_indices = []
    for i, part in enumerate(parts):
        if part.strip() and part not in [' ', '-', '–', '—', '/', '*']:
            word_indices.append(i)
    
    result = []
    for i, part in enumerate(parts):
        if not part.strip():  # Whitespace or separator
            result.append(part)
            continue
        
        # Check if it's a separator
        if part in [' ', '-', '–', '—', '/', '*']:
            result.append(part)
            continue
        
        # Check if it's a connector (but not first or last word)
        word_pos = word_indices.index(i) if i in word_indices else -1
        is_first_word = word_pos == 0
        is_last_word = word_pos == len(word_indices) - 1
        
        part_lower = part.lower()
        
        # Handle acronyms - keep them uppercase
        if is_acronym(part):
            # Convert to uppercase, preserving dots
            if '.' in part:
                # Handle B.BOAT -> B.Boat (capitalize after dot)
                parts_dot = part.split('.')
                formatted_acronym = '.'.join([p.upper() if len(p) <= 1 else p[0].upper() + p[1:].lower() for p in parts_dot])
                result.append(formatted_acronym)
            else:
                result.append(part.upper())
        # Always capitalize first and last words, and if it's not a connector
        elif is_first_word or is_last_word or part_lower not in LOWERCASE_WORDS:
            # Capitalize first letter, preserve rest
            if part:
                formatted = part[0].upper() + part[1:].lower()
                result.append(formatted)
            else:
                result.append(part)
        else:
            # Keep connector lowercase
            result.append(part_lower)
    
    return ''.join(result)

def format_event_names(json_file_path):
    """Format all event names in the JSON file."""
    # Read the JSON file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"Formatting {len(events)} event names...\n")
    
    for i, event in enumerate(events, 1):
        old_name = event.get('name', '')
        new_name = title_case(old_name)
        
        if old_name != new_name:
            print(f"[{i}] {old_name}")
            print(f"    → {new_name}\n")
            event['name'] = new_name
    
    # Write the updated JSON back
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    
    print("✓ Event names formatted!")

if __name__ == '__main__':
    json_file = '../queer_events_2025-11-19_23.json'
    format_event_names(json_file)

