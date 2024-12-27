from flask import render_template, request, jsonify, redirect, session, url_for
from app import app # type: ignore
from app.sheets import ( # type: ignore
    get_all_items, add_item, update_item, delete_item,
    get_routine, add_to_routine, get_all_routines,
    test_sheets_connection, get_credentials, update_items_order,
    create_routine, update_routine_order, update_routine_item,
    remove_from_routine, delete_routine, get_active_routine, set_routine_active,
    get_worksheet, get_spread, sheet_to_records
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

@app.route('/api/items/<item_id>', methods=['PUT', 'DELETE'])
def item(item_id):
    """Handle PUT (update) and DELETE for individual items"""
    try:
        item_id = int(float(item_id))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid item ID"}), 400
        
    if request.method == 'PUT':
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
                    # Add completed column to new routine
                    spread = get_spread()
                    worksheet = spread.worksheet(routine_name)
                    ensure_completed_column(worksheet)
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

@app.route('/api/routines/<routine_name>', methods=['GET', 'DELETE'])
def routine_operations(routine_name):
    """Handle GET (details) and DELETE for individual routines"""
    try:
        if request.method == 'GET':
            return jsonify(get_routine(routine_name))
        elif request.method == 'DELETE':
            result = delete_routine(routine_name)
            if result:
                return '', 204
            return jsonify({"error": "Failed to delete routine"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<routine_name>/order', methods=['PUT'])
def update_routine_order_route(routine_name):
    """Update the order of items in a routine"""
    try:
        items = request.json
        return jsonify(update_routine_order(routine_name, items))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<routine_name>/items/<int:item_id>', methods=['PUT', 'DELETE'])
def routine_item_operations(routine_name, item_id):
    """Update or remove an item from a routine"""
    try:
        if request.method == 'PUT':
            updated_item = request.json
            return jsonify(update_routine_item(routine_name, item_id, updated_item))
        elif request.method == 'DELETE':
            remove_from_routine(routine_name, item_id)
            return '', 204
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    """Get the currently active routine"""
    try:
        app.logger.debug("Fetching active routine name...")
        active_name = get_active_routine()
        app.logger.debug(f"Active routine name: {active_name}")
        
        if not active_name:
            app.logger.debug("No active routine found")
            return jsonify({"active_routine": None})
            
        # Get the full routine data
        app.logger.debug(f"Fetching routine data for: {active_name}")
        routine_data = get_routine(active_name)
        app.logger.debug(f"Got routine data: {routine_data}")
        
        response = {
            "active_routine": {
                "name": active_name,
                "items": routine_data
            }
        }
        app.logger.debug(f"Sending response: {response}")
        return jsonify(response)
    except Exception as e:
        app.logger.error(f"Error in get_active_routine_route: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<routine_name>/active', methods=['PUT'])
def set_routine_active_route(routine_name):
    """Set a routine as active or inactive"""
    try:
        # Add debug logging
        app.logger.debug(f"Received activate request for routine: {routine_name}")
        app.logger.debug(f"Request JSON: {request.json}")
        
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        active = request.json.get('active', True)  # Default to activating
        app.logger.debug(f"Setting active status to: {active}")
        
        success = set_routine_active(routine_name, active)
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
            if item['ID'] == item_id:
                return jsonify({'notes': item.get('Notes', '')})
        
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
        if item['ID'] == item_id:
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

@app.route('/api/routines/<routine_name>/items/<int:item_id>/complete', methods=['PUT'])
def toggle_item_complete(routine_name, item_id):
    """Toggle completion state of an item in a routine"""
    try:
        app.logger.debug(f"Toggling completion for item {item_id} in routine {routine_name}")
        spread = get_spread()
        worksheet = spread.worksheet(routine_name)
        
        # Find the row with this item_id
        items = sheet_to_records(worksheet, is_routine_worksheet=True)
        row_idx = None
        for idx, item in enumerate(items):
            app.logger.debug(f"Checking item: {item}")  # Debug log
            if item['ID'] == item_id:
                row_idx = idx + 2  # +2 because sheets is 1-based and has header row
                app.logger.debug(f"Found item at row {row_idx}")
                break
        
        if row_idx is None:
            app.logger.error(f"Item {item_id} not found in routine {routine_name}")
            return jsonify({'error': 'Item not found'}), 404

        # Get the current completed state
        completed = request.json.get('completed', False)
        app.logger.debug(f"Setting completed state to: {completed}")
        
        # Always use column D for completed state
        completed_value = 'TRUE' if completed else 'FALSE'
        worksheet.update(f'D{row_idx}', completed_value)
        app.logger.debug(f"Updated cell at row {row_idx}, col D with value {completed_value}")
        
        return jsonify({'success': True, 'completed': completed})
    except Exception as e:
        app.logger.error(f"Error toggling item completion: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/routines/<routine_name>/reset', methods=['POST'])
def reset_routine_progress(routine_name):
    """Reset all items' completion state in a routine"""
    try:
        app.logger.debug(f"Resetting progress for routine: {routine_name}")
        spread = get_spread()
        worksheet = spread.worksheet(routine_name)
        
        # Ensure completed column exists in column D
        ensure_completed_column(worksheet)
        
        # Get all items
        items = sheet_to_records(worksheet, is_routine_worksheet=True)
        
        # Create a list of FALSE values for all data rows
        if items:  # Only update if there are rows to update
            false_values = [['FALSE'] for _ in range(len(items))]
            # Update all cells in column D starting from D2
            range_end = f'D{len(items) + 1}'  # +1 because items doesn't include header row
            worksheet.update(f'D2:{range_end}', false_values)
        
        app.logger.debug("Reset complete")
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error resetting routine progress: {str(e)}")
        return jsonify({'error': str(e)}), 500

def ensure_completed_column(worksheet):
    """Ensure the worksheet has a completed column in column D"""
    try:
        # Get all values
        all_values = worksheet.get_all_values()
        if len(all_values) > 1:  # If there are data rows
            # Create a list of FALSE values for all data rows
            false_values = [['FALSE'] for _ in range(len(all_values) - 1)]
            # Update all cells in column D starting from D2
            if false_values:  # Only update if there are rows to update
                range_end = f'D{len(all_values)}'
                worksheet.update(f'D2:{range_end}', false_values)
            
        logging.debug("Completed column verified in column D")
        return True
    except Exception as e:
        logging.error(f"Error ensuring completed column: {str(e)}")
        raise