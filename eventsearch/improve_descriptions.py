#!/usr/bin/env python3
"""
Script to improve event descriptions by creating user-friendly,
consistent descriptions from event data.
"""

import json
import re

def create_description(event):
    """Create a user-friendly description from event data."""
    name = event.get('name', '')
    venue_name = event.get('venueName', '')
    city = event.get('city', 'Paris')
    music = event.get('music', [])
    event_type = event.get('type', '')
    start_date = event.get('startDate', '')
    end_date = event.get('endDate', '')
    
    parts = []
    
    # Main description line
    if venue_name:
        main_desc = f"{name} at {venue_name} in {city}."
    else:
        main_desc = f"{name} in {city}."
    
    parts.append(main_desc)
    
    # Extract time from dates if available
    if start_date and end_date:
        try:
            from datetime import datetime
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            
            start_time = start.strftime('%H:%M')
            end_time = end.strftime('%H:%M')
            
            parts.append(f"\n🕒 Hours: {start_time} → {end_time}")
        except:
            pass
    
    # Music genres
    if music:
        music_str = ', '.join(music)
        parts.append(f"\n🎧 Music: {music_str}")
    
    # Event type info
    if event_type:
        type_descriptions = {
            'Club': 'Dance floor ready with resident and guest DJs.',
            'Bar': 'Queer-friendly atmosphere with drinks and music.',
            'Concert': 'Live performance event.',
            'Warehouse': 'Underground warehouse party vibes.',
            'Boat': 'Party on the water with scenic views.',
        }
        if event_type in type_descriptions:
            parts.append(f"\n✨ {type_descriptions[event_type]}")
    
    # Add inclusive message
    parts.append("\n🌈 Queer crowd, inclusive energy, zero judgment.")
    
    return ''.join(parts)

def improve_descriptions(json_file_path):
    """Improve all event descriptions."""
    # Read the JSON file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"Improving descriptions for {len(events)} events...\n")
    
    for i, event in enumerate(events, 1):
        event_name = event.get('name', '')
        old_desc = event.get('description', '')
        
        # Skip if description is already good (not generic)
        if old_desc and 'discover upcoming events' not in old_desc.lower():
            # Check if it's a good description (has event-specific info)
            if len(old_desc) > 100 and event_name.lower()[:5] in old_desc.lower():
                print(f"[{i}/{len(events)}] {event_name}")
                print(f"  ✓ Keeping existing description")
                continue
        
        # Create new description
        new_desc = create_description(event)
        event['description'] = new_desc
        
        print(f"[{i}/{len(events)}] {event_name}")
        print(f"  ✓ Created new description")
    
    # Write the updated JSON back
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ JSON file updated!")

if __name__ == '__main__':
    json_file = '../queer_events_2025-11-19_23.json'
    improve_descriptions(json_file)

