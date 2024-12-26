def get_items_sheet():
    sheet = get_sheet('Items')
    if not sheet.get('values', []):
        # Initialize headers if sheet is empty
        sheet.append_row([
            'ID', 'Title', 'Reminders', 'Duration', 'Related Link', 'Tuning', 'order'
        ])
    return sheet

def create_item(data):
    sheet = get_items_sheet()
    
    # Get next available ID
    ids = get_id_sequence()
    new_id = max(ids) + 1 if ids else 1
    
    # Get next order value
    orders = get_order_sequence()
    new_order = max(orders) + 1 if orders else 1
    
    # Prepare row data
    row = [
        new_id,
        data.get('title', '').strip(),
        data.get('reminders', '').strip(),
        data.get('duration', ''),
        data.get('related_link', '').strip(),
        data.get('tuning', '').strip(),
        new_order
    ]
    
    sheet.append_row(row)
    return new_id

def update_item(item_id, data):
    sheet = get_items_sheet()
    rows = sheet.get_all_values()
    headers = rows[0]
    
    # Find the row with matching ID
    for i, row in enumerate(rows[1:], start=1):
        if str(row[0]) == str(item_id):
            # Prepare updated row data
            updated_row = [
                item_id,  # Keep existing ID
                data.get('title', '').strip(),
                data.get('reminders', '').strip(),
                data.get('duration', ''),
                data.get('related_link', '').strip(),
                data.get('tuning', '').strip(),
                row[6]  # Keep existing order
            ]
            
            # Update the row
            sheet.update(f'A{i+1}:G{i+1}', [updated_row])
            return True
            
    return False 

def get_all_items():
    sheet = get_items_sheet()
    rows = sheet.get_all_values()
    
    if len(rows) <= 1:  # Only headers or empty
        return []
        
    headers = rows[0]
    items = []
    
    for row in rows[1:]:
        item = {
            'id': int(row[0]),
            'title': row[1],
            'reminders': row[2],
            'duration': row[3],
            'related_link': row[4],
            'tuning': row[5],
            'order': int(row[6])
        }
        items.append(item)
        
    return sorted(items, key=lambda x: x['order']) 