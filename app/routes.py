from flask import render_template, request, jsonify, redirect, session, url_for
from app import app # type: ignore
from app.sheets import ( # type: ignore
    get_all_items, add_item, update_item, delete_item,
    get_routine, add_to_routine, get_all_routines,
    test_sheets_connection, get_credentials, update_items_order,
    create_routine, update_routine_order, update_routine_item,
    remove_from_routine, delete_routine, get_active_routine, set_routine_active,
    get_worksheet, get_spread, sheet_to_records, get_all_routine_records,
    records_to_sheet
)
from google_auth_oauthlib.flow import Flow
import os
import logging
import time  # Add at the top with other imports

logging.basicConfig(level=logging.DEBUG)

# Main route
@app.route('/')
def index():
    return render_template('index.html.jinja')

# Item routes
@app.route('/api/items', methods=['GET', 'POST'])
def items():
    """Handle GET (list) and POST (create) for items"""
    if request.method == 'GET':
        return jsonify(get_all_items())
    elif request.method == 'POST':
        app.logger.debug("Received POST request to create item")
        app.logger.debug(f"Request Content-Type: {request.headers.get('Content-Type')}")
        app.logger.debug(f"Request body: {request.get_data(as_text=True)}")
        
        if not request.is_json:
            app.logger.error("Request is not JSON")
            return jsonify({"error": "Request must be JSON"}), 400
            
        new_item = request.json
        app.logger.debug(f"Creating new item with data: {new_item}")
        result = add_item(new_item)
        app.logger.debug(f"Item creation result: {result}")
        return jsonify(result)

@app.route('/api/items/order', methods=['PUT'])
def order_items():
    """Update the order of items"""
    items = request.json
    return jsonify(update_items_order(items))

@app.route('/api/items/<item_id>', methods=['GET', 'PUT', 'DELETE'])
def item(item_id):
    """Handle GET (fetch), PUT (update) and DELETE for individual items"""
    try:
        item_id = int(float(item_id))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid item ID"}), 400
        
    if request.method == 'GET':
        # Get all items and find the requested one
        all_items = get_all_items()
        item = next((item for item in all_items if int(float(item['A'])) == item_id), None)
        if item:
            return jsonify(item)
        return jsonify({"error": "Item not found"}), 404
    elif request.method == 'PUT':
        updated_item = request.json
        logging.debug(f"Received PUT request for item {item_id}")
        logging.debug(f"Request data: {updated_item}")
        return jsonify(update_item(item_id, updated_item))
    elif request.method == 'DELETE':
        delete_item(item_id)
        return '', 204

@app.route('/api/routines', methods=['GET', 'POST'])
def routines():
    """Handle GET (list) and POST (create) for routines"""
    if request.method == 'GET':
        return jsonify(get_all_routines())
    elif request.method == 'POST':
        try:
            app.logger.debug(f"Received POST request to create routine")
            app.logger.debug(f"Request Content-Type: {request.headers.get('Content-Type')}")
            app.logger.debug(f"Request body: {request.get_data(as_text=True)}")
            
            if not request.is_json:
                app.logger.error("Request is not JSON")
                return jsonify({"error": "Request must be JSON"}), 400
                
            routine_name = request.json.get('routineName')
            app.logger.debug(f"Extracted routine name: {routine_name}")
            
            if not routine_name:
                app.logger.error("No routine name provided")
                return jsonify({"error": "Routine name is required"}), 400
            
            # Log before creation attempt    
            app.logger.debug(f"Attempting to create routine: {routine_name}")
            
            try:
                result = create_routine(routine_name)
                if result:
                    # Add a small delay to ensure sheet is ready
                    time.sleep(2)
                app.logger.debug(f"Routine creation result: {result}")
                return jsonify({"success": result}), 201
            except ValueError as ve:
                app.logger.error(f"ValueError in create_routine: {str(ve)}")
                return jsonify({"error": str(ve)}), 400
            except Exception as e:
                app.logger.error(f"Unexpected error in create_routine: {str(e)}")
                return jsonify({"error": "Internal server error"}), 500
                
        except Exception as e:
            app.logger.error(f"Error processing routine creation request: {str(e)}")
            return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<int:routine_id>', methods=['GET', 'DELETE'])
def routine_operations(routine_id):
    """Handle GET (details) and DELETE for individual routines"""
    try:
        if request.method == 'GET':
            # Get the worksheet using routine ID as sheet name
            spread = get_spread()
            worksheet = spread.worksheet(str(routine_id))
            routine_data = sheet_to_records(worksheet, is_routine_worksheet=True)
            return jsonify(routine_data)
        elif request.method == 'DELETE':
            result = delete_routine(str(routine_id))
            if result:
                return '', 204
            return jsonify({"error": "Failed to delete routine"}), 500
    except Exception as e:
        app.logger.error(f"Error in routine_operations: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<int:routine_id>/details', methods=['GET'])
def get_routine_with_details(routine_id):
    """Get a routine with all item details and metadata."""
    try:
        # Get routine metadata from Routines sheet
        spread = get_spread()
        routines_sheet = spread.worksheet('Routines')
        all_routines = sheet_to_records(routines_sheet, is_routine_worksheet=False)
        routine_meta = next((r for r in all_routines if r['A'] == str(routine_id)), None)
        
        if not routine_meta:
            return jsonify({"error": "Routine not found"}), 404

        # Get the routine's items
        routine_worksheet = spread.worksheet(str(routine_id))
        routine_items = sheet_to_records(routine_worksheet, is_routine_worksheet=True)

        # Get all items from Items sheet
        items_worksheet = spread.worksheet('Items')
        all_items = sheet_to_records(items_worksheet, is_routine_worksheet=False)
        items_by_id = {item['B']: item for item in all_items}  # Index by Item ID (column B)

        # Combine routine items with their details
        items_with_details = []
        for routine_item in routine_items:
            item_id = routine_item['B']  # Item ID from routine's column B
            item_details = items_by_id.get(item_id, {})
            
            # Only include 'TRUE' for completed items, leave others empty
            if routine_item.get('D') != 'TRUE':
                routine_item['D'] = ''
                
            items_with_details.append({
                "routineEntry": routine_item,
                "itemDetails": item_details
            })

        return jsonify({
            "id": routine_meta['A'],
            "name": routine_meta['B'],
            "created": routine_meta['C'],
            "order": routine_meta['D'],
            "items": items_with_details
        })

    except Exception as e:
        app.logger.error(f"Error getting routine with details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<int:routine_id>/order', methods=['PUT'])
def update_routine_order_route(routine_id):
    """Update the order of items in a routine"""
    try:
        app.logger.debug(f"Received order update request for routine: {routine_id}")
        items = request.json
        app.logger.debug(f"Items to reorder: {items}")
        
        # Get the worksheet using routine ID as sheet name
        spread = get_spread()
        worksheet = spread.worksheet(str(routine_id))
        app.logger.debug(f"Found worksheet for routine: {routine_id}")
        
        # Get existing items to preserve all data
        existing_items = sheet_to_records(worksheet, is_routine_worksheet=True)
        app.logger.debug(f"Existing items: {existing_items}")
        
        # Create a map of routine entry IDs to their new order
        new_orders = {item['A']: item['C'] for item in items}
        app.logger.debug(f"New orders map: {new_orders}")
        
        # Update only the order (column C) for each item
        for item in existing_items:
            if item['A'] in new_orders:
                item['C'] = new_orders[item['A']]
                
        # Write back to sheet
        success = records_to_sheet(worksheet, existing_items, is_routine_worksheet=True)
        if success:
            app.logger.debug(f"Successfully updated order for routine: {routine_id}")
            return jsonify(existing_items)
            
        app.logger.error(f"Failed to write updated order to sheet for routine: {routine_id}")
        return jsonify({"error": "Failed to update order"}), 500
    except Exception as e:
        app.logger.error(f"Error updating routine order: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<routine_name>/items/<item_id>', methods=['PUT', 'DELETE'])
def routine_item_operations(routine_name, item_id):
    """Handle operations on items within a routine"""
    if request.method == 'DELETE':
        if remove_from_routine(routine_name, item_id):
            return '', 204
        return jsonify({"error": "Failed to remove item from routine"}), 400
    elif request.method == 'PUT':
        item = request.json
        result = update_routine_item(routine_name, item_id, item)
        if result:
            return jsonify(result)
        return jsonify({"error": "Failed to update routine item"}), 400

@app.route('/api/routines/<routine_name>/items', methods=['POST'])
def add_item_to_routine(routine_name):
    """Add an item to a routine"""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        item_id = request.json.get('itemId')
        notes = request.json.get('notes', '')
        
        if item_id is None:
            return jsonify({"error": "Item ID is required"}), 400
            
        app.logger.debug(f"Adding item {item_id} to routine {routine_name}")
        result = add_to_routine(routine_name, item_id, notes)
        
        if result:
            return jsonify(result)
        return jsonify({"error": "Failed to add item to routine"}), 500
    except ValueError as ve:
        app.logger.error(f"ValueError in add_item_to_routine: {str(ve)}")
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error in add_item_to_routine: {str(e)}")
        return jsonify({"error": str(e)}), 500

# OAuth and testing routes
@app.route('/logout')
def logout_and_redirect():
    """Handle logout and redirect to home"""
    try:
        if os.path.exists('token.json'):
            os.remove('token.json')
        get_credentials.cache_clear()  # Clear the credentials cache
        return redirect(url_for('index'))
    except Exception as e:
        logging.error(f"Error during logout: {str(e)}")
        return redirect(url_for('index'))  # Redirect even if there's an error

@app.route('/api/auth/status')
def auth_status():
    """Check if we have valid credentials and spreadsheet access"""
    try:
        creds, _ = get_credentials()
        if not creds or not creds.valid:
            return jsonify({"authenticated": False})

        # Test spreadsheet access
        test_result = test_sheets_connection()
        return jsonify({
            "authenticated": True,
            "hasSpreadsheetAccess": test_result.get("success", False)
        })
    except Exception as e:
        logging.error(f"Error checking auth status: {str(e)}")
        return jsonify({
            "authenticated": False,
            "error": str(e)
        })

@app.route('/authorize')
def authorize():
    """Initiate OAuth flow"""
    creds, flow = get_credentials()
    if creds:
        logging.debug("Credentials found, redirecting to index")
        return redirect(url_for('index'))
    flow.redirect_uri = url_for('oauth2callback', _external=True)
    authorization_url, state = flow.authorization_url(prompt='consent')
    session['state'] = state
    logging.debug(f"Authorization URL: {authorization_url}")
    return f'<a href="{authorization_url}">Click here to authorize</a>'

@app.route('/oauth2callback')
def oauth2callback():
    """Handle OAuth callback"""
    logging.debug("Entered oauth2callback")
    try:
        state = session['state']
        _, flow = get_credentials()
        flow.redirect_uri = url_for('oauth2callback', _external=True)

        logging.debug(f"Request URL: {request.url}")
        flow.fetch_token(authorization_response=request.url)

        creds = flow.credentials
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
        logging.debug("Credentials saved to token.json")
        
        # Clear the credentials cache
        get_credentials.cache_clear()
        
        # Verify credentials work by testing connection
        test_sheets_connection()
        
        return redirect(url_for('index'))
    except Exception as e:
        logging.error(f"Error in oauth2callback: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/routines/active', methods=['GET'])
def get_active_routine_route():
    """Get the ID of the currently active routine"""
    try:
        app.logger.debug("Fetching active routine ID")
        active_id = get_active_routine()
        app.logger.debug(f"Active routine ID: {active_id}")
        return jsonify({"active_id": active_id})
    except Exception as e:
        app.logger.error(f"Error getting active routine: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<int:routine_id>/active', methods=['PUT'])
def set_routine_active_route(routine_id):
    """Set a routine as active or inactive"""
    try:
        # Add debug logging
        app.logger.debug(f"Received activate request for routine ID: {routine_id}")
        app.logger.debug(f"Request JSON: {request.json}")
        
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        active = request.json.get('active', True)  # Default to activating
        app.logger.debug(f"Setting active status to: {active}")
        
        success = set_routine_active(str(routine_id), active)
        if success:
            return jsonify({"success": True, "active": active})
        return jsonify({"error": "Failed to update routine status"}), 500
    except Exception as e:
        app.logger.error(f"Error in set_routine_active_route: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/test_sheets')
def test_sheets():
    """Test connection to Google Sheets"""
    logging.debug("Entered test_sheets")
    creds, _ = get_credentials()
    if not creds:
        logging.debug("No credentials found, returning error")
        return jsonify({"success": False, "error": "No credentials. Please authorize."}), 401
    try:
        result = test_sheets_connection()
        logging.debug(f"Test result: {result}")
        return jsonify({"success": True, "result": result})
    except Exception as e:
        logging.error(f"Error in test_sheets: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/items/<int:item_id>/notes', methods=['GET', 'POST'])
def save_item_notes(item_id):
    if request.method == 'GET':
        # Get the worksheet for the Items sheet
        spread = get_spread()
        worksheet = spread.worksheet('Items')
        
        # Find the row with this item_id
        items = sheet_to_records(worksheet, is_routine_worksheet=False)
        for item in items:
            if item['A'] == str(item_id):  # Just convert route param to string once
                return jsonify({'notes': item.get('D', '')})  # Column D is Notes
        
        app.logger.debug(f"DEBUG:get_notes:Item {item_id} not found!")
        return jsonify({'error': 'Item not found'}), 404

    # POST method
    data = request.get_json()
    note_text = data.get('notes', '')
    app.logger.debug(f"DEBUG:save_notes:Received note text: {note_text}")
    
    # Get the worksheet for the Items sheet
    spread = get_spread()
    worksheet = spread.worksheet('Items')
    
    # Convert to records for ID-based lookup
    items = sheet_to_records(worksheet, is_routine_worksheet=False)
    
    # Find the item with matching ID
    target_item = None
    target_row_idx = None
    for idx, item in enumerate(items):
        if item['A'] == str(item_id):  # Just convert route param to string once
            target_item = item
            target_row_idx = idx + 2  # +2 for 1-based index and header row
            app.logger.debug(f"DEBUG:save_notes:Found item {item_id} at row {target_row_idx}")
            break
    
    if target_item is None:
        app.logger.debug(f"DEBUG:save_notes:Item {item_id} not found!")
        return jsonify({'error': 'Item not found'}), 404
        
    # Update the Notes column (column D)
    app.logger.debug(f"DEBUG:save_notes:Updating cell at row {target_row_idx}, col D with text: {note_text}")
    try:
        worksheet.update(f'D{target_row_idx}', note_text)
        app.logger.debug("DEBUG:save_notes:Update successful")
    except Exception as e:
        app.logger.error(f"DEBUG:save_notes:Error updating cell: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
    return jsonify({'success': True})

@app.route('/items')
def items_page():
    """Render the items page"""
    items = get_all_items()
    return render_template('items.html.jinja', items=items)

@app.route('/api/routines/<int:routine_id>/items/<int:item_id>/complete', methods=['PUT'])
def toggle_item_complete(routine_id, item_id):
    """Toggle completion state of an item in a routine"""
    try:
        app.logger.debug(f"Toggling completion for item {item_id} in routine {routine_id}")
        try:
            # Use routine_id directly as sheet name
            spread = get_spread()
            worksheet = spread.worksheet(str(routine_id))  # Sheet name is the routine ID
            app.logger.debug(f"Got worksheet for routine {routine_id}")
        except Exception as sheet_error:
            app.logger.error(f"Failed to get worksheet: {str(sheet_error)}")
            return jsonify({'error': f"Failed to get worksheet: {str(sheet_error)}"}), 500
        
        # Find the row with this routine entry ID (column A)
        items = sheet_to_records(worksheet, is_routine_worksheet=True)
        app.logger.debug(f"Converted sheet to records, got {len(items)} items")
        
        row_idx = None
        for idx, item in enumerate(items):
            app.logger.debug(f"Checking item: {item}")  # Debug log
            if item['A'] == str(item_id):  # Look for routine entry ID in column A
                row_idx = idx + 2  # +2 because sheets is 1-based and has header row
                app.logger.debug(f"Found item at row {row_idx}")
                break
        
        if row_idx is None:
            app.logger.error(f"Item {item_id} not found in routine {routine_id}")
            return jsonify({'error': 'Item not found'}), 404

        # Get the current completed state
        completed = request.json.get('completed', False)
        app.logger.debug(f"Setting completed state to: {completed}")
        
        # Use 'TRUE' for completed, empty string for not completed
        completed_value = 'TRUE' if completed else ' '  # Use a space instead of empty string
        app.logger.debug(f"About to update cell D{row_idx} to {completed_value}")
        try:
            # Get current value before update
            current_value = worksheet.acell(f'D{row_idx}').value
            app.logger.debug(f"Current value in D{row_idx}: {current_value}")
            
            # Use batch_update to clear the cell if needed
            if completed:
                worksheet.update(f'D{row_idx}', completed_value)
            else:
                worksheet.batch_clear([f'D{row_idx}'])
            
            # Verify the update
            new_value = worksheet.acell(f'D{row_idx}').value
            app.logger.debug(f"New value in D{row_idx}: {new_value}")
            
            # For uncompleted items, None or empty string is success
            if completed and new_value == completed_value or not completed and (new_value is None or new_value == ''):
                app.logger.debug(f"Successfully updated cell D{row_idx}")
            else:
                app.logger.error(f"Update failed - value is still {new_value}")
                return jsonify({'error': f"Update failed - value is still {new_value}"}), 500
                
        except Exception as update_error:
            app.logger.error(f"Failed to update cell: {str(update_error)}")
            app.logger.error(f"Error type: {type(update_error)}")
            app.logger.error(f"Error details: {update_error.__dict__}")
            return jsonify({'error': f"Failed to update cell: {str(update_error)}"}), 500
        
        return jsonify({'success': True, 'completed': completed})
    except Exception as e:
        app.logger.error(f"Error toggling item completion: {str(e)}")
        app.logger.error(f"Error type: {type(e)}")
        app.logger.error(f"Error details: {e.__dict__ if hasattr(e, '__dict__') else 'No details'}")
        return jsonify({'error': f"Error toggling item completion: {str(e)}"}), 500

@app.route('/api/routines/<int:routine_id>/reset', methods=['POST'])
def reset_routine_progress(routine_id):
    """Reset all items' completion state in a routine"""
    try:
        app.logger.debug(f"Resetting progress for routine: {routine_id}")
        spread = get_spread()
        worksheet = spread.worksheet(str(routine_id))  # Use ID as sheet name
        
        # Get all items
        items = sheet_to_records(worksheet, is_routine_worksheet=True)
        
        # Create a list of empty strings for all data rows
        if items:  # Only update if there are rows to update
            empty_values = [[''] for _ in range(len(items))]
            # Update all cells in column D starting from D2
            range_end = f'D{len(items) + 1}'  # +1 because items doesn't include header row
            worksheet.update(f'D2:{range_end}', empty_values)
        
        app.logger.debug("Reset complete")
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error resetting routine progress: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/practice/active-routine', methods=['GET'])
def get_active_routine_with_details():
    """Get the active routine with all item details for the Practice page."""
    try:
        # Get active routine ID
        active_id = get_active_routine()
        if not active_id:
            return jsonify({"active_id": None, "items": []})

        # Get routine name from Routines sheet
        spread = get_spread()
        routines_sheet = spread.worksheet('Routines')
        all_routines = sheet_to_records(routines_sheet, is_routine_worksheet=False)
        routine_meta = next((r for r in all_routines if r['A'] == str(active_id)), None)
        
        if not routine_meta:
            return jsonify({"error": "Active routine not found in Routines sheet"}), 404

        # Get the routine's items
        routine_worksheet = spread.worksheet(str(active_id))
        routine_items = sheet_to_records(routine_worksheet, is_routine_worksheet=True)

        # Get all items from Items sheet
        items_worksheet = spread.worksheet('Items')
        all_items = sheet_to_records(items_worksheet, is_routine_worksheet=False)
        items_by_id = {item['A']: item for item in all_items}  # Index by ID

        # Combine routine items with their details
        items_with_details = []
        for routine_item in routine_items:
            item_id = routine_item['B']  # Item ID from routine's column B
            item_details = items_by_id.get(item_id, {})
            items_with_details.append({
                "routineEntry": routine_item,
                "itemDetails": item_details
            })

        return jsonify({
            "active_id": active_id,
            "name": routine_meta['B'],  # Column B contains the routine name
            "items": items_with_details
        })

    except Exception as e:
        app.logger.error(f"Error getting active routine with details: {str(e)}")
        return jsonify({"error": str(e)}), 500