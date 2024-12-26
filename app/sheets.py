from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from flask import current_app
import gspread
import os
import logging
from datetime import datetime
from functools import lru_cache

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Define column structure once to ensure consistency
COLUMN_STRUCTURE = [
    {'name': 'ID', 'type': 'int', 'default': '1'},           # Routine item entry ID
    {'name': 'Item ID', 'type': 'int', 'default': '0'},      # Reference to main Items sheet
    {'name': 'Title', 'type': 'str', 'default': ''},         # Copied from item for reference
    {'name': 'Notes', 'type': 'str', 'default': ''},         # Routine-specific notes
    {'name': 'Duration', 'type': 'str', 'default': ''},      # Copied from item
    {'name': 'Description', 'type': 'str', 'default': ''},   # Copied from item
    {'name': 'Tuning', 'type': 'str', 'default': ''},       # Guitar tuning for the item
    {'name': 'order', 'type': 'int', 'default': '0'},        # For drag-drop ordering
]

ROUTINE_WORKSHEET_STRUCTURE = [
    {'name': 'ID', 'type': 'int', 'default': '1'},           # Routine item entry ID
    {'name': 'Item ID', 'type': 'int', 'default': '0'},      # Reference to main Items sheet
    {'name': 'Title', 'type': 'str', 'default': ''},         # Copied from item for reference
    {'name': 'Notes', 'type': 'str', 'default': ''},         # Routine-specific notes
    {'name': 'Duration', 'type': 'str', 'default': ''},      # Copied from item
    {'name': 'Description', 'type': 'str', 'default': ''},   # Copied from item
    {'name': 'order', 'type': 'int', 'default': '0'},        # For drag-drop ordering
]

ROUTINES_COLUMN_STRUCTURE = [
    {'name': 'ID', 'type': 'int', 'default': '1'},
    {'name': 'RoutineName', 'type': 'str', 'default': ''},
    {'name': 'Created', 'type': 'str', 'default': ''}, 
    {'name': 'Order', 'type': 'int', 'default': '0'},
]

@lru_cache(maxsize=1)
def get_credentials():
    """Get or refresh Google OAuth2 credentials."""
    logging.debug("Entered get_credentials")
    token_file = 'token.json'
    try:
        if os.path.exists(token_file):
            logging.debug("Token file found")
            creds = Credentials.from_authorized_user_file(token_file)
            if creds and creds.valid:
                return creds, None
                
            if creds and creds.expired and creds.refresh_token:
                try:
                    logging.debug("Refreshing credentials")
                    creds.refresh(Request())
                    # Save refreshed credentials
                    with open(token_file, 'w') as token:
                        token.write(creds.to_json())
                    return creds, None
                except Exception as e:
                    logging.debug(f"Refresh failed: {str(e)}")
                    # If refresh fails, delete the token file and fall through to create new flow
                    os.remove(token_file)
                    
        # Either no token file or refresh failed
        logging.debug("Creating new flow")
        flow = Flow.from_client_secrets_file(
            'client_secret.json',
            scopes=['https://www.googleapis.com/auth/spreadsheets'],
            redirect_uri=current_app.config['OAUTH2_REDIRECT_URI']
        )
        return None, flow
    except Exception as e:
        logging.error(f"Error in get_credentials: {str(e)}")
        return None, None

@lru_cache(maxsize=1)
def get_spread():
    """Get the Google Spreadsheet instance."""
    logging.debug("Entered get_spread")
    spread_id = "***REDACTED_SPREADSHEET_ID***"
    creds, _ = get_credentials()
    if not creds:
        logging.debug("No valid credentials found")
        raise ValueError("No valid credentials available. Please authenticate first.")
    
    try:
        client = gspread.authorize(creds)
        spread = client.open_by_key(spread_id)
        return spread
    except Exception as e:
        logging.error(f"Error connecting to spreadsheet: {str(e)}")
        raise ValueError(f"Failed to connect to spreadsheet: {str(e)}")

def invalidate_caches():
    """Invalidate all caches when data is modified."""
    get_credentials.cache_clear()
    get_spread.cache_clear()

def sheet_to_records(worksheet, is_routine_worksheet=True):
    """Convert worksheet data to list of dictionaries with proper type conversion."""
    try:
        # Get all values including headers
        records = worksheet.get_all_records()
        logging.debug(f"Raw records from get_all_records: {records}") 
        if not records:
            return []
            
        logging.debug(f"Number of records: {len(records)}")
        
        # Use correct column structure
        column_structure = ROUTINE_WORKSHEET_STRUCTURE if is_routine_worksheet else COLUMN_STRUCTURE
        
        # Convert types and ensure all required fields
        processed_records = []
        for record in records:
            case_fixed = {}
            for col in column_structure:
                # Get value using exact column name
                value = record.get(col['name'], col['default'])
                
                # Convert based on type
                if col['type'] == 'int':
                    value = int(float(value)) if value else 0
                elif col['type'] == 'str':
                    value = str(value).strip()
                
                case_fixed[col['name']] = value
                
            processed_records.append(case_fixed)
        
        # Sort by order
        processed_records.sort(key=lambda x: x['order'])
        
        logging.debug(f"ID sequence: {[r.get('ID') for r in processed_records]}")
        logging.debug(f"Order sequence: {[r.get('order') for r in processed_records]}")
        
        return processed_records
    except Exception as e:
        logging.error(f"Error in sheet_to_records: {str(e)}")
        raise

def records_to_sheet(worksheet, records, is_routine_worksheet=True):
    """Convert list of dictionaries back to sheet format."""
    try:
        if not records:
            return False
            
        # Get column names from structure
        column_structure = ROUTINE_WORKSHEET_STRUCTURE if is_routine_worksheet else COLUMN_STRUCTURE
        headers = [col['name'] for col in column_structure]
            
        # Create the data rows
        rows = [headers]  # Start with headers
        for record in records:
            row = []
            for header in headers:
                # Convert values to strings
                value = str(record.get(header, ''))
                row.append(value)
            rows.append(row)
            
        # Clear existing content and update with new data
        worksheet.clear()
        worksheet.update('A1', rows)
        
        logging.debug(f"Updated sheet with {len(records)} records")
        
        return True
    except Exception as e:
        logging.error(f"Error in records_to_sheet: {str(e)}")
        raise

def validate_sheet_structure(worksheet):
    """Validate and fix sheet structure if needed."""
    try:
        # Get existing headers
        existing_headers = worksheet.row_values(1)
        
        # Get required headers from column structure
        required_headers = [col['name'] for col in COLUMN_STRUCTURE]
        
        # Check for missing headers
        missing_headers = [h for h in required_headers if h not in existing_headers]
        
        # Check for extra headers
        extra_headers = [h for h in existing_headers if h not in required_headers]
        
        if missing_headers or extra_headers:
            # Get all current data
            all_data = worksheet.get_all_values()
            headers = all_data[0] if all_data else []
            data = all_data[1:] if len(all_data) > 1 else []
            
            # Create mapping of column structure for defaults
            defaults_map = {col['name']: col['default'] for col in COLUMN_STRUCTURE}
            
            # Create new headers list with correct order
            new_headers = required_headers.copy()
            
            # Create new data rows with missing columns added and extra columns removed
            new_data = []
            for row in data:
                # Create dict of current row data
                row_dict = {h: v for h, v in zip(headers, row)}
                
                # Create new row with required columns
                new_row = []
                for header in new_headers:
                    value = row_dict.get(header, defaults_map[header])
                    new_row.append(value)
                
                new_data.append(new_row)
            
            # Update sheet with fixed structure
            worksheet.clear()
            worksheet.update('A1', [new_headers] + new_data)
            
            if missing_headers:
                logging.info(f"Added missing headers: {missing_headers}")
            if extra_headers:
                logging.info(f"Removed extra headers: {extra_headers}")
            
        return True
        
    except Exception as e:
        logging.error(f"Error validating sheet structure: {str(e)}")
        return False

def ensure_completed_column(worksheet):
    """Ensure the worksheet has a completed column in column H"""
    try:
        logging.debug("Ensuring completed column exists...")
        # Check if column H exists and has the correct header
        try:
            header = worksheet.cell(1, 8).value  # Column H is index 8
        except:
            header = None
        
        if header != 'completed':
            # Set header
            worksheet.update_cell(1, 8, 'completed')
            # Initialize all rows with FALSE
            all_values = worksheet.get_all_values()
            for i in range(2, len(all_values) + 1):
                worksheet.update_cell(i, 8, 'FALSE')
            
        logging.debug("Completed column verified in column H")
        return True
    except Exception as e:
        logging.error(f"Error ensuring completed column: {str(e)}")
        raise

def initialize_routines_sheet():
    """Create and initialize the Routines index sheet if it doesn't exist."""
    try:
        spread = get_spread()
        
        # Check if Routines sheet exists
        try:
            sheet = spread.worksheet('Routines')
            logging.debug("Routines sheet already exists")
            
            # Update headers to new format if needed
            current_headers = sheet.row_values(1)
            if 'Name' in current_headers and 'RoutineName' not in current_headers:
                logging.debug("Updating headers to new format")
                headers = [col['name'] for col in ROUTINES_COLUMN_STRUCTURE]
                sheet.update('A1', [headers])
                
        except:
            logging.debug("Creating new Routines sheet")
            sheet = spread.add_worksheet('Routines', rows=1000, cols=20)
            
            # Extract headers from column structure
            headers = [col['name'] for col in ROUTINES_COLUMN_STRUCTURE]
            
            # Initialize sheet with headers and format them
            sheet.update('A1', [headers])
            header_range = f'A1:{chr(ord("A") + len(headers) - 1)}1'
            sheet.format(header_range, {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9}
            })
            
        return True
    except Exception as e:
        logging.error(f"Error initializing Routines sheet: {str(e)}")
        raise

def create_routine(routine_name):
    """Create a new routine with proper sheet initialization and tracking."""
    try:
        spread = get_spread()
        routine_name = routine_name.lower()  # Convert to lowercase for consistency
        
        # Get current routines to check for duplicates and get next ID
        routines_sheet = spread.worksheet('Routines')
        current_routines = get_all_routine_records()
        
        # Check for duplicate names (case insensitive)
        if any(r['RoutineName'].lower() == routine_name for r in current_routines):
            raise ValueError(f"Routine '{routine_name}' already exists")
            
        # Generate new ID
        new_id = max([r['ID'] for r in current_routines], default=0) + 1
        
        # Generate new order
        new_order = max([r['Order'] for r in current_routines], default=-1) + 1
        
        # Create new worksheet
        worksheet = spread.add_worksheet(routine_name, rows=1000, cols=20)
        
        # Initialize with headers
        headers = [col['name'] for col in ROUTINE_WORKSHEET_STRUCTURE]
        worksheet.update('A1', [headers])
        
        # Ensure completed column exists
        ensure_completed_column(worksheet)
        
        # Add entry to Routines index
        new_routine = [
            str(new_id),                # ID
            routine_name,               # RoutineName
            datetime.now().isoformat(), # Created
            str(new_order)             # Order
        ]
        routines_sheet.append_row(new_routine)
        
        invalidate_caches()
        return {
            'ID': new_id,
            'RoutineName': routine_name,
            'created': new_routine[2],  # Fixed index to match new structure
            'order': new_order
        }
            
    except Exception as e:
        logging.error(f"Error in create_routine: {str(e)}")
        raise

def get_all_items():
    """Get all items from the Items sheet."""
    try:
        spread = get_spread()
        logging.debug("Reading from Items sheet...")
        
        worksheet = spread.worksheet('Items')
        records = sheet_to_records(worksheet)
        
        return records
    except Exception as e:
        logging.error(f"Error in get_all_items: {str(e)}")
        return []

def add_item(item):
    """Add a new item with proper error handling."""
    try:
        spread = get_spread()
        logging.debug("Starting add operation...")
        
        # Get the worksheet and current records
        worksheet = spread.worksheet('Items')
        records = sheet_to_records(worksheet)
        
        # Generate new ID
        new_id = max([r['ID'] for r in records], default=0) + 1
        item['ID'] = new_id
        
        # Check for duplicate titles
        base_title = item['Title']
        count = 1
        while any(r['Title'].lower() == item['Title'].lower() for r in records):
            item['Title'] = f"{base_title} ({count})"
            count += 1
        
        # Set order to end of list
        max_order = max([r['order'] for r in records], default=-1)
        item['order'] = max_order + 1
        
        # Add new record and save
        records.append(item)
        success = records_to_sheet(worksheet, records)
        
        if success:
            invalidate_caches()
            return item
            
        return None
    except Exception as e:
        logging.error(f"Error in add_item: {str(e)}")
        raise ValueError(f"Failed to add item: {str(e)}")

def update_item(item_id, item):
    """Update an item with error handling."""
    try:
        spread = get_spread()
        logging.debug(f"Starting update operation for item_id: {item_id}")
        
        # Get the worksheet and current records
        worksheet = spread.worksheet('Items')
        records = sheet_to_records(worksheet)
        
        # Find and update the item
        item_id = int(float(item_id))
        updated = False
        for record in records:
            if record['ID'] == item_id:
                # Preserve ID and order
                item['ID'] = record['ID']
                item['order'] = record['order']
                # Update the record
                record.update(item)
                updated = True
                break
                
        if not updated:
            raise ValueError(f"Item {item_id} not found")
            
        # Write back to sheet
        success = records_to_sheet(worksheet, records)
        if success:
            invalidate_caches()
            return item
            
        return None
    except Exception as e:
        logging.error(f"Error in update_item: {str(e)}")
        raise ValueError(f"Failed to update item: {str(e)}")

def delete_item(item_id):
    """Delete an item and update order values."""
    try:
        spread = get_spread()
        logging.debug(f"Starting delete operation for item_id: {item_id}")
        
        # Get the worksheet and current records
        worksheet = spread.worksheet('Items')
        records = sheet_to_records(worksheet)
        
        # Find the item to delete
        item_id = int(float(item_id))
        deleted_item = next((item for item in records if item['ID'] == item_id), None)
        
        if not deleted_item:
            logging.error(f"Item {item_id} not found")
            return False
            
        deleted_order = deleted_item['order']
        logging.debug(f"Found item {item_id} with order {deleted_order}")
        
        # Remove the item and update orders
        records = [r for r in records if r['ID'] != item_id]
        for record in records:
            if record['order'] > deleted_order:
                record['order'] -= 1
                
        # Write back to sheet
        success = records_to_sheet(worksheet, records)
        if success:
            invalidate_caches()
            
        return success
    except Exception as e:
        logging.error(f"Error in delete_item: {str(e)}")
        return False

def update_items_order(items):
    """Update items with their new order."""
    try:
        spread = get_spread()
        logging.debug("Starting order update operation...")
        
        # Get the worksheet
        worksheet = spread.worksheet('Items')
        
        # Update order values to match new positions
        for i, item in enumerate(items):
            item['order'] = i
            
        # Write back to sheet
        success = records_to_sheet(worksheet, items)
        if success:
            invalidate_caches()
            return items
            
        return []
    except Exception as e:
        logging.error(f"Error in update_items_order: {str(e)}")
        return []

def get_routine(routine_name):
    """Get a specific routine's items."""
    spread = get_spread()
    
    # Get all worksheet names
    all_worksheets = spread.worksheets()
    
    # Find the worksheet with a case-insensitive match
    worksheet = None
    for ws in all_worksheets:
        if ws.title.lower() == routine_name.lower():
            worksheet = ws
            break
            
    if not worksheet:
        raise ValueError(f"Routine '{routine_name}' not found")
        
    records = sheet_to_records(worksheet)
    return records

def get_active_routine():
    """Get the currently active routine name."""
    try:
        spread = get_spread()
        
        # Create ActiveRoutine sheet if it doesn't exist
        try:
            sheet = spread.worksheet('ActiveRoutine')
        except:
            sheet = spread.add_worksheet('ActiveRoutine', rows=1, cols=1)
            sheet.update('A1', '')
            
        # Get active routine name (or empty string) - convert to lowercase for consistency
        active_name = sheet.acell('A1').value
        return active_name.lower() if active_name else None
        
    except Exception as e:
        logging.error(f"Error getting active routine: {str(e)}")
        return None

def set_routine_active(routine_name, active=True):
    """Set the active status of a routine."""
    try:
        spread = get_spread()
        logging.debug(f"Setting routine active status: {routine_name}, active={active}")
        routine_name = routine_name.lower()  # Convert to lowercase for consistency
        
        # Get or create ActiveRoutine sheet
        try:
            sheet = spread.worksheet('ActiveRoutine')
        except:
            sheet = spread.add_worksheet('ActiveRoutine', rows=1, cols=1)
        
        # If activating, simply write the name
        if active:
            sheet.update('A1', routine_name)
            logging.debug(f"Set {routine_name} as active routine")
            return True
            
        # If deactivating, only clear if this routine is active
        current = sheet.acell('A1').value
        if current and current.lower() == routine_name:
            sheet.update('A1', '')
            logging.debug(f"Cleared active routine {routine_name}")
            return True
            
        return True  # No-op if deactivating non-active routine
        
    except Exception as e:
        logging.error(f"Error setting routine active status: {str(e)}")
        return False

def get_all_routine_records():
    """Get all records from the Routines index sheet."""
    try:
        spread = get_spread()
        worksheet = spread.worksheet('Routines')
        records = worksheet.get_all_records()
        
        # Convert all keys to lowercase for case-insensitive access
        normalized_records = []
        for record in records:
            # First convert all keys to lowercase
            lower_record = {k.lower(): v for k, v in record.items()}
            
            # Then create normalized record with proper field names
            normalized_record = {
                'ID': lower_record.get('id', 0),
                # Try routinename first, then name, then Name as fallbacks
                'RoutineName': lower_record.get('routinename') or lower_record.get('name') or lower_record.get('Name', ''),
                'Created': lower_record.get('created', ''),
                'Order': lower_record.get('order', 0)
            }
            normalized_records.append(normalized_record)
            
        # Sort by order field
        normalized_records.sort(key=lambda x: x['Order'])
        return normalized_records
        
    except Exception as e:
        logging.error(f"Error getting routine records: {str(e)}")
        return []

def get_all_routines():
    """Get all routines with metadata and active status."""
    spread = get_spread()
    active_name = get_active_routine()
    
    # Get complete routine records from Routines index sheet
    routine_records = get_all_routine_records()
    
    # Add active status to each record
    routines = []
    for record in routine_records:
        # Preserve the original case from the sheet for display
        routine = {
            'ID': record['ID'],
            'name': record['RoutineName'],  # Use 'name' consistently, but preserve original case
            'created': record['Created'],
            'order': record['Order'],
            'active': record['RoutineName'].lower() == (active_name.lower() if active_name else '')
        }
        routines.append(routine)
    
    # Sort by order field
    routines.sort(key=lambda x: x['order'])
    
    return routines

def test_sheets_connection():
    """Test the connection to the spreadsheet."""
    logging.debug("Entered test_sheets_connection")
    try:
        spread = get_spread()
        worksheet = spread.worksheet('Items')
        records = sheet_to_records(worksheet)
        logging.debug(f"Read {len(records)} items from the sheet")
        
        return {
            "success": True,
            "message": "Successfully tested sheets connection",
            "details": {
                "items_read": len(records)
            }
        }
    except Exception as e:
        logging.error(f"Test failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def add_to_routine(routine_name, item_id, notes=""):
    """Add an item to a routine."""
    try:
        spread = get_spread()
        worksheet = spread.worksheet(routine_name)
        records = sheet_to_records(worksheet, is_routine_worksheet=True)
        
        # Generate new ID for routine item
        new_id = max([r.get('ID', 0) for r in records], default=0) + 1
        
        # Set order to end of list
        max_order = max([r.get('order', 0) for r in records], default=-1)
        
        # Get item details from main Items sheet
        items_sheet = spread.worksheet('Items')
        items = sheet_to_records(items_sheet, is_routine_worksheet=False)
        item = next((i for i in items if i['ID'] == item_id), None)
        
        if not item:
            raise ValueError(f"Item {item_id} not found in Items sheet")
        
        new_record = {
            'ID': new_id,
            'Item ID': item_id,
            'Title': item.get('Title', ''),
            'Notes': notes,
            'Duration': item.get('Duration', ''),
            'Description': item.get('Description', ''),
            'order': max_order + 1
        }
        
        # Add new record and save
        records.append(new_record)
        success = records_to_sheet(worksheet, records, is_routine_worksheet=True)
        
        if success:
            invalidate_caches()
            return new_record
            
        return None
    except Exception as e:
        logging.error(f"Error in add_to_routine: {str(e)}")
        raise ValueError(f"Failed to add to routine: {str(e)}")

def update_routine_order(routine_name, items):
    """Update routine items with their new order."""
    try:
        spread = get_spread()
        logging.debug(f"Starting routine order update for {routine_name}...")
        
        worksheet = spread.worksheet(routine_name)
        
        # Update order values to match new positions
        for i, item in enumerate(items):
            item['order'] = i
            
        # Write back to sheet
        success = records_to_sheet(worksheet, items)
        if success:
            invalidate_caches()
            return items
            
        return []
    except Exception as e:
        logging.error(f"Error in update_routine_order: {str(e)}")
        return []
    
def delete_routine(routine_id):
    """Delete a routine by ID."""
    try:
        spread = get_spread()
        
        # Get routine info from Routines sheet
        routines = get_all_routine_records()
        routine = next((r for r in routines if r['ID'] == routine_id), None)
        
        if not routine:
            raise ValueError(f"Routine with ID {routine_id} not found")
            
        # Delete the worksheet
        worksheet = spread.worksheet(routine['RoutineName'])
        spread.del_worksheet(worksheet)
        
        # Remove from Routines index
        routines_sheet = spread.worksheet('Routines')
        records = sheet_to_records(routines_sheet)
        updated_records = [r for r in records if r['ID'] != routine_id]
        
        # Update order for remaining routines
        deleted_order = routine['Order']
        for record in updated_records:
            if record['Order'] > deleted_order:
                record['Order'] -= 1
                
        # Write back to sheet
        success = records_to_sheet(routines_sheet, updated_records)
        if success:
            invalidate_caches()
            
        return success
        
    except Exception as e:
        logging.error(f"Error in delete_routine: {str(e)}")
        return False

def update_routine_item(routine_name, item_id, item):
    """Update a single item in a routine (e.g., to update notes)."""
    try:
        spread = get_spread()
        worksheet = spread.worksheet(routine_name)
        records = sheet_to_records(worksheet)
        
        # Find and update the item
        item_id = int(float(item_id))
        updated = False
        for record in records:
            if record['ID'] == item_id:
                # Preserve ID and order
                item['ID'] = record['ID']
                item['order'] = record['order']
                # Update the record
                record.update(item)
                updated = True
                break
                
        if not updated:
            raise ValueError(f"Item {item_id} not found in routine {routine_name}")
            
        # Write back to sheet
        success = records_to_sheet(worksheet, records)
        if success:
            invalidate_caches()
            return item
            
        return None
    except Exception as e:
        logging.error(f"Error in update_routine_item: {str(e)}")
        raise ValueError(f"Failed to update routine item: {str(e)}")

def remove_from_routine(routine_name, item_id):
    """Remove an item from a routine."""
    try:
        spread = get_spread()
        worksheet = spread.worksheet(routine_name)
        records = sheet_to_records(worksheet)
        
        # Find the item to delete
        item_id = int(float(item_id))
        deleted_item = next((item for item in records if item['ID'] == item_id), None)
        
        if not deleted_item:
            logging.error(f"Item {item_id} not found in routine {routine_name}")
            return False
            
        deleted_order = deleted_item['order']
        logging.debug(f"Found item {item_id} with order {deleted_order}")
        
        # Remove the item and update orders
        records = [r for r in records if r['ID'] != item_id]
        for record in records:
            if record['order'] > deleted_order:
                record['order'] -= 1
                
        # Write back to sheet
        success = records_to_sheet(worksheet, records)
        if success:
            invalidate_caches()
            
        return success
    except Exception as e:
        logging.error(f"Error in remove_from_routine: {str(e)}")
        return False

def get_worksheet(worksheet_name):
    """Get a worksheet by name."""
    try:
        spread = get_spread()
        
        # Get all worksheet names
        all_worksheets = spread.worksheets()
        
        # Find the worksheet with a case-insensitive match
        for ws in all_worksheets:
            if ws.title.lower() == worksheet_name.lower():
                return ws
                
        raise gspread.exceptions.WorksheetNotFound(worksheet_name)
    except Exception as e:
        logging.error(f"Error getting worksheet {worksheet_name}: {str(e)}")
        raise