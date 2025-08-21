from flask import render_template, request, jsonify, redirect, session, url_for
from app import app # type: ignore
from app.sheets import ( # type: ignore
    get_all_items, add_item, update_item, delete_item,
    get_routine, add_to_routine, get_all_routines,
    test_sheets_connection, get_credentials, update_items_order,
    create_routine, update_routine_order, update_routine_item,
    remove_from_routine, delete_routine, get_active_routine, set_routine_active,
    get_worksheet, get_spread, sheet_to_records, get_all_routine_records,
    records_to_sheet, get_chord_charts_for_item, add_chord_chart, 
    delete_chord_chart, update_chord_chart, update_chord_charts_order,
    get_common_chord_charts, search_common_chord_charts, seed_common_chord_charts, 
    bulk_import_chords_from_tormodkv, bulk_import_chords_from_local_file,
    copy_chord_charts_to_items
)
from google_auth_oauthlib.flow import Flow
import os
import logging
import time  # Add at the top with other imports
import math
from typing import List, Dict
from datetime import datetime
import subprocess
import platform
from difflib import get_close_matches
import re

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

@app.route('/api/items/lightweight', methods=['GET'])
def items_lightweight():
    """Get items with minimal data - only ID and Title for the list view"""
    try:
        spread = get_spread()
        
        # Get only columns A (ID) and C (Title) from Items sheet
        batch_data = spread.values_batch_get([
            "Items!A2:D"  # Get ID, Item ID, Title columns
        ])
        
        items_data = batch_data['valueRanges'][0].get('values', [])
        items = [
            {
                'A': r[0] if len(r) > 0 else '',  # ID (column A)
                'C': r[2] if len(r) > 2 else ''   # Title (column C)
            }
            for r in items_data
        ]
        
        return jsonify(items)
        
    except Exception as e:
        app.logger.error(f"Error getting lightweight items: {str(e)}")
        return jsonify({"error": str(e)}), 500

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
        spread = get_spread()
        
        # Batch get all required data
        batch_data = spread.values_batch_get([
            f"Routines!A2:D",  # Get routine metadata
            f"{routine_id}!A2:D",  # Get routine items
            "Items!A2:H"  # Get items data
        ])
        
        # Process routine metadata
        routines_data = batch_data['valueRanges'][0].get('values', [])
        routine_meta = next((
            {'A': r[0], 'B': r[1], 'C': r[2], 'D': r[3]} 
            for r in routines_data 
            if r[0] == str(routine_id)
        ), None)
        
        if not routine_meta:
            return jsonify({"error": "Routine not found"}), 404

        # Process routine items
        routine_items_data = batch_data['valueRanges'][1].get('values', [])
        routine_items = [
            {
                'A': r[0],  # ID
                'B': r[1],  # Item ID
                'C': r[2],  # Order
                'D': r[3] if len(r) > 3 and r[3] == 'TRUE' else ''  # Completed
            }
            for r in routine_items_data
        ]

        # Process items data
        items_data = batch_data['valueRanges'][2].get('values', [])
        items_by_id = {
            r[1]: {  # Index by Item ID (column B)
                'A': r[0],  # ID
                'B': r[1],  # Item ID
                'C': r[2],  # Title
                'D': r[3],  # Notes
                'E': r[4],  # Duration
                'F': r[5],  # Description
                'G': r[6],  # Order
                'H': r[7] if len(r) > 7 else ''  # Tuning
            }
            for r in items_data
        }

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

@app.route('/api/routines/<int:routine_id>/items/<item_id>', methods=['PUT', 'DELETE'])
def routine_item(routine_id, item_id):
    """Handle updates and deletions of routine items"""
    try:
        if request.method == 'DELETE':
            success = remove_from_routine(routine_id, item_id)
            if success:
                return jsonify({"success": True})
            return jsonify({"error": "Failed to remove item"}), 500
        elif request.method == 'PUT':
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
                
            item = request.json
            result = update_routine_item(routine_id, item_id, item)
            if result:
                return jsonify(result)
            return jsonify({"error": "Failed to update item"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/<int:routine_id>/items', methods=['POST'])
def add_routine_item(routine_id):
    """Add an item to a routine"""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        item_id = request.json.get('itemId')
        if not item_id:
            return jsonify({"error": "Item ID is required"}), 400
            
        result = add_to_routine(routine_id, item_id)
        if result:
            return jsonify(result), 201
        return jsonify({"error": "Failed to add item"}), 500
    except Exception as e:
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
    if creds and creds.valid:
        logging.debug("Valid credentials found, redirecting to index")
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

        spread = get_spread()
        
        # Batch get all required data
        batch_data = spread.values_batch_get([
            f"Routines!A2:D",  # Get routine metadata
            f"{active_id}!A2:D",  # Get routine items
            "Items!A2:H"  # Get items data
        ])
        
        # Process routine metadata
        routines_data = batch_data['valueRanges'][0].get('values', [])
        routine_meta = next((
            {'A': r[0], 'B': r[1], 'C': r[2], 'D': r[3]} 
            for r in routines_data 
            if r[0] == str(active_id)
        ), None)
        
        if not routine_meta:
            return jsonify({"error": "Active routine not found in Routines sheet"}), 404

        # Process routine items
        routine_items_data = batch_data['valueRanges'][1].get('values', [])
        routine_items = [
            {
                'A': r[0],  # ID
                'B': r[1],  # Item ID
                'C': r[2],  # Order
                'D': r[3] if len(r) > 3 and r[3] == 'TRUE' else ''  # Completed
            }
            for r in routine_items_data
        ]

        # Process items data
        items_data = batch_data['valueRanges'][2].get('values', [])
        items_by_id = {
            r[0]: {  # Index by ID (column A)
                'A': r[0],  # ID
                'B': r[1],  # Item ID
                'C': r[2],  # Title
                'D': r[3],  # Notes
                'E': r[4],  # Duration
                'F': r[5],  # Description
                'G': r[6],  # Order
                'H': r[7] if len(r) > 7 else ''  # Tuning
            }
            for r in items_data
        }

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

@app.route('/api/practice/active-routine/lightweight', methods=['GET'])
def get_active_routine_lightweight():
    """Get the active routine with minimal data - only titles and basic info for collapsed view."""
    try:
        # Get active routine ID
        active_id = get_active_routine()
        if not active_id:
            return jsonify({"active_id": None, "items": []})

        spread = get_spread()
        
        # Batch get only essential data - no full item details
        batch_data = spread.values_batch_get([
            f"Routines!A2:D",  # Get routine metadata
            f"{active_id}!A2:D",  # Get routine items
            "Items!A2:D"  # Get ID, Item ID, and Title (columns A, B, C)
        ])
        
        # Process routine metadata
        routines_data = batch_data['valueRanges'][0].get('values', [])
        routine_meta = next((
            {'A': r[0], 'B': r[1], 'C': r[2], 'D': r[3]} 
            for r in routines_data 
            if r[0] == str(active_id)
        ), None)
        
        if not routine_meta:
            return jsonify({"error": "Active routine not found in Routines sheet"}), 404

        # Process routine items
        routine_items_data = batch_data['valueRanges'][1].get('values', [])
        routine_items = [
            {
                'A': r[0],  # ID
                'B': r[1],  # Item ID
                'C': r[2],  # Order
                'D': r[3] if len(r) > 3 and r[3] == 'TRUE' else ''  # Completed
            }
            for r in routine_items_data
        ]

        # Process minimal items data (only ID and Title)
        items_data = batch_data['valueRanges'][2].get('values', [])
        items_by_id = {
            r[1]: {  # Index by Item ID (column B) - this is what routine items reference
                'A': r[0],  # ID (column A)
                'C': r[2] if len(r) > 2 else '',  # Title (column C)
            }
            for r in items_data
        }

        # Combine routine items with minimal details
        items_with_minimal_details = []
        for routine_item in routine_items:
            item_id = routine_item['B']  # Item ID from routine's column B
            item_minimal = items_by_id.get(item_id, {})
            items_with_minimal_details.append({
                "routineEntry": routine_item,
                "itemMinimal": item_minimal
            })

        return jsonify({
            "active_id": active_id,
            "name": routine_meta['B'],  # Column B contains the routine name
            "items": items_with_minimal_details
        })

    except Exception as e:
        app.logger.error(f"Error getting lightweight active routine: {str(e)}")
        return jsonify({"error": str(e)}), 500

def batch_items(items: List[Dict], batch_size: int = 5) -> List[List[Dict]]:
    """Split items into batches of 5"""
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]

def exponential_backoff(attempt: int) -> None:
    """Wait with exponential backoff, starting with a longer base delay"""
    base_delay = 5  # Start with 5 seconds
    delay = min(base_delay * math.pow(2, attempt), 30)  # Cap at 30 seconds
    time.sleep(delay)

@app.route('/api/items/bulk', methods=['POST'])
def bulk_import_items():
    """Handle bulk import of items by appending them to the Items sheet"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    items = request.json
    if not isinstance(items, list):
        return jsonify({"error": "Request body must be an array"}), 400

    try:
        # Get the Items sheet
        spread = get_spread()
        items_sheet = spread.worksheet('Items')
        
        # Find first empty row (row 1 is header)
        first_empty_row = len(items_sheet.col_values(1)) + 1
        next_id = first_empty_row - 1  # Row number minus header row
        
        # Convert items to rows
        rows = []
        for idx, item in enumerate(items):
            row_id = str(next_id + idx)
            rows.append([
                row_id,              # A: ID
                row_id,              # B: Item ID
                item['title'],       # C: Title
                '',                  # D: Notes
                item['duration'],    # E: Duration
                '',                  # F: Description
                row_id,              # G: Order
                ''                   # H: Tuning
            ])
        
        if rows:
            # Append the rows
            items_sheet.append_rows(rows, value_input_option='USER_ENTERED')
        
        return jsonify({
            "success": True,
            "imported": len(rows)
        })

    except Exception as e:
        app.logger.error(f"Error in bulk import: {str(e)}")
        return jsonify({
            "error": str(e)
        }), 500

def records_to_sheet(worksheet, records, is_routine_worksheet=False):
    """Write records back to sheet, handling all columns at once"""
    if not records:
        return True
        
    # Determine range based on worksheet type
    num_cols = 4 if is_routine_worksheet else 8
    col_end = 'D' if is_routine_worksheet else 'H'
    
    # Convert records to rows, preserving all columns
    rows = []
    for record in records:
        app.logger.debug(f"Processing record: {record}")
        row = []
        for col in 'ABCDEFGH'[:num_cols]:  # Only process columns we need
            row.append(record.get(col, ''))
        rows.append(row)
    
    # Calculate range
    range_start = f'A2'
    range_end = f'{col_end}{len(rows) + 1}'  # +1 because we start at row 2
    range_str = f'{range_start}:{range_end}'
    app.logger.debug(f"Writing to range: {range_str}")
    app.logger.debug(f"Data rows to write: {rows}")
    
    # Clear the range first
    worksheet.batch_clear([f'A2:{col_end}'])
    app.logger.debug(f"Clearing sheet range before write: A2:{col_end}")
    
    # Write all data at once
    worksheet.update(range_str, rows, value_input_option='USER_ENTERED')
    app.logger.debug(f"Sheet update completed")
    app.logger.debug(f"Updated sheet with {len(rows)} records")
    
    return True

@app.route('/api/routines/bulk', methods=['POST'])
def bulk_import_routines():
    """Handle bulk import of routine definitions (Phase 1)"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    routines = request.json
    if not isinstance(routines, list):
        return jsonify({"error": "Request body must be an array"}), 400

    try:
        # Validate all routines first
        for routine in routines:
            if not isinstance(routine, dict):
                return jsonify({"error": "Each routine must be an object"}), 400
            if 'name' not in routine:
                return jsonify({"error": "Each routine must have a name"}), 400

        # Get current routines once at the start
        spread = get_spread()
        routines_sheet = spread.worksheet('Routines')
        current_records = sheet_to_records(routines_sheet, is_routine_worksheet=True)
        
        # Get the next available ID and order
        next_id = str(max([int(r['A']) for r in current_records], default=0) + 1)
        next_order = str(max([int(r['D']) for r in current_records], default=0) + 1)
        
        # Generate timestamp in our format
        now = datetime.now()
        timestamp = now.strftime('%Y-%m-%d %H:%M:%S')
        
        # Process all routines first, accumulating them in memory
        imported_routines = []
        for routine in routines:
            new_routine = {
                'A': next_id,      # ID
                'B': routine['name'],  # Name
                'C': timestamp,    # Created
                'D': next_order    # Order
            }
            current_records.append(new_routine)
            imported_routines.append(new_routine)
            
            # Create the routine's worksheet using ID as name
            worksheet = spread.add_worksheet(str(next_id), rows=1000, cols=20)
            # Add header row
            header_row = ['ID', 'Item ID', 'order', 'completed']
            worksheet.update('A1:D1', [header_row])
            
            next_id = str(int(next_id) + 1)
            next_order = str(int(next_order) + 1)

        # Write all records in one batch with exponential backoff
        max_attempts = 5
        attempt = 0
        while attempt < max_attempts:
            try:
                records_to_sheet(routines_sheet, current_records, is_routine_worksheet=True)
                break
            except Exception as e:
                app.logger.error(f"Error in batch write, attempt {attempt}: {str(e)}")
                if "quota" in str(e).lower() and attempt < max_attempts - 1:
                    exponential_backoff(attempt)
                    attempt += 1
                else:
                    raise

        return jsonify({
            "success": True,
            "imported": len(imported_routines),
            "routines": imported_routines
        })

    except Exception as e:
        app.logger.error(f"Error in bulk routine import: {str(e)}")
        return jsonify({
            "error": str(e),
            "imported": len(imported_routines) if 'imported_routines' in locals() else 0,
            "routines": imported_routines if 'imported_routines' in locals() else []
        }), 500

@app.route('/api/routines/<int:routine_id>/items/bulk', methods=['POST'])
def bulk_import_routine_items(routine_id):
    """Import multiple items into a routine by matching titles."""
    try:
        app.logger.debug(f"Received bulk import request for routine {routine_id}")
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        items_to_import = request.json
        app.logger.debug(f"Items to import: {items_to_import}")

        # Get all existing items to match against
        all_items = get_all_items()
        items_by_title = {item['C'].lower(): item for item in all_items}  # Case-insensitive lookup

        # Get the worksheet for this routine
        spread = get_spread()
        worksheet = spread.worksheet(str(routine_id))
        existing_routine_items = sheet_to_records(worksheet, is_routine_worksheet=True)
        
        # Track which items are already in the routine
        existing_item_ids = {item['B'] for item in existing_routine_items}  # Set of item IDs
        
        # Get next available ID for column A
        next_id = 1
        if existing_routine_items:
            next_id = max(int(item['A']) for item in existing_routine_items if item['A'].isdigit()) + 1
        
        # Process each item to import
        items_to_add = []
        not_found_titles = []
        
        for idx, item in enumerate(items_to_import):
            title = item.get('title', '')
            if not title:
                continue
            
            # Look for exact match first (case-insensitive)
            matching_item = items_by_title.get(title.lower())
            
            if matching_item:
                # Only add if not already in routine
                if matching_item['B'] not in existing_item_ids:
                    items_to_add.append({
                        'A': str(next_id + idx),  # Simple incrementing ID
                        'B': matching_item['B'],  # Item ID from Items sheet
                        'C': str(idx),  # Order based on position in import list
                        'D': ''  # Empty string for completed column
                    })
            else:
                # Item not found - add to not_found list
                not_found_titles.append(title)
                # Still add to routine but without an Item ID
                items_to_add.append({
                    'A': str(next_id + idx),  # Simple incrementing ID
                    'B': '',  # No Item ID yet
                    'C': str(idx),  # Order based on position in import list
                    'D': ''  # Empty string for completed column
                })

        if not items_to_add:
            return jsonify({
                "error": "No items were processed",
                "not_found": not_found_titles
            }), 400

        # Add all new items to the worksheet
        all_items = existing_routine_items + items_to_add
        success = records_to_sheet(worksheet, all_items, is_routine_worksheet=True)

        response_data = {
            "imported": len(items_to_add),
            "not_found": not_found_titles
        }

        if not_found_titles:
            response_data["message"] = f"These items were not found, you'll need to create them, and add the Item IDs to the routine sheet: {', '.join(not_found_titles)}"

        if success:
            return jsonify(response_data)
        else:
            return jsonify({"error": "Failed to import items"}), 500

    except Exception as e:
        app.logger.error(f"Error importing routine items: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/routines/order', methods=['PUT'])
def update_routines_order():
    """Update the order of routines in the Routines sheet"""
    try:
        app.logger.debug("Received routines order update request")
        updates = request.json
        app.logger.debug(f"Updates to apply: {updates}")
        
        # Wrap the entire operation in retry logic
        def do_update():
            # Get the Routines sheet
            spread = get_spread()
            routines_sheet = spread.worksheet('Routines')
            
            # Get existing routines
            existing_routines = sheet_to_records(routines_sheet, is_routine_worksheet=True)
            
            # Create a map of ID to new order
            order_map = {update['A']: update['D'] for update in updates}
            
            # Update orders for routines that are in the updates
            for routine in existing_routines:
                if routine['A'] in order_map:
                    routine['D'] = order_map[routine['A']]
            
            # Write back to sheet
            success = records_to_sheet(routines_sheet, existing_routines, is_routine_worksheet=True)
            
            if not success:
                raise Exception("Failed to write updated order to sheet")
                
            return success
        
        # Use retry logic with exponential backoff
        from app.sheets import retry_on_rate_limit
        success = retry_on_rate_limit(do_update, max_retries=3, base_delay=2)
        
        if success:
            app.logger.debug("Successfully updated routines order")
            return jsonify({"success": True})
            
    except Exception as e:
        app.logger.error(f"Error updating routines order: {str(e)}")
        error_str = str(e).lower()
        # Check if it's a rate limit error to provide better feedback
        if any(phrase in error_str for phrase in ['quota', 'rate limit', '429', 'too many']):
            return jsonify({"error": "Google Sheets rate limit reached. Please wait a moment and try again."}), 429
        return jsonify({"error": str(e)}), 500

@app.route('/api/open-folder', methods=['POST'])
def open_folder():
    try:
        folder_path = request.json.get('path')
        if not folder_path:
            return jsonify({'error': 'No path provided'}), 400

        app.logger.debug(f"Opening folder: {folder_path}")

        # Keep Windows path format but ensure proper escaping
        windows_path = folder_path.replace('/', '\\')
        
        # In WSL, we'll use explorer.exe to open Windows File Explorer
        try:
            # Use the Windows path directly with explorer.exe
            subprocess.run(['explorer.exe', windows_path], check=True)
            return jsonify({'success': True})
        except subprocess.CalledProcessError as e:
            app.logger.error(f"Failed to open folder: {str(e)}")
            return jsonify({'error': f'Failed to open folder: {str(e)}'}), 500

    except Exception as e:
        app.logger.error(f"Error in open_folder: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/items/update-songbook-paths', methods=['POST'])
def update_songbook_paths():
    """Bulk update songbook paths based on folder names matching item titles."""
    try:
        folder_paths = request.json.get('paths', [])
        if not folder_paths:
            return jsonify({'error': 'No paths provided'}), 400

        # Get all items
        spread = get_spread()
        items_sheet = spread.worksheet('Items')
        items = sheet_to_records(items_sheet, is_routine_worksheet=False)

        # Extract folder names and create a mapping
        folder_names = [path.split('\\')[-1] for path in folder_paths]
        
        # Function to normalize strings for comparison
        def normalize(s):
            # Remove special characters and convert to lowercase
            return re.sub(r'[^\w\s]', '', s).lower().strip()

        # Create normalized versions of folder names for matching
        norm_folder_map = {normalize(name): path for name, path in zip(folder_names, folder_paths)}

        # Track updates
        updates = []
        updated_count = 0

        # Process each item
        for item in items:
            title = item['C']  # Column C is Title
            norm_title = normalize(title)
            
            # Try to find a matching folder
            matches = get_close_matches(norm_title, norm_folder_map.keys(), n=1, cutoff=0.8)
            
            if matches:
                matched_folder = matches[0]
                folder_path = norm_folder_map[matched_folder]
                
                # Update the item's songbook path (Column F)
                row_idx = items.index(item) + 2  # +2 for 1-based index and header row
                items_sheet.update(f'F{row_idx}', folder_path)
                
                updates.append({
                    'title': title,
                    'path': folder_path
                })
                updated_count += 1

        return jsonify({
            'success': True,
            'updated_count': updated_count,
            'updates': updates
        })

    except Exception as e:
        app.logger.error(f"Error updating songbook paths: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Chord Charts API endpoints
@app.route('/api/items/<int:item_id>/chord-charts', methods=['GET', 'POST'])
def chord_charts_for_item(item_id):
    """Get or create chord charts for an item."""
    if request.method == 'GET':
        try:
            charts = get_chord_charts_for_item(item_id)
            response = jsonify(charts)
            # Add anti-caching headers to prevent stale data
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        except Exception as e:
            app.logger.error(f"Error getting chord charts for item {item_id}: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            if not request.is_json:
                return jsonify({"error": "Request must be JSON"}), 400
            
            chord_data = request.json
            app.logger.debug(f"Creating chord chart for item {item_id} with data: {chord_data}")
            
            result = add_chord_chart(item_id, chord_data)
            if result:
                return jsonify(result)
            else:
                return jsonify({"error": "Failed to create chord chart"}), 500
                
        except Exception as e:
            app.logger.error(f"Error creating chord chart: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/<int:chord_id>', methods=['DELETE'])
def delete_chord_chart_route(chord_id):
    """Delete a chord chart by ID."""
    try:
        success = delete_chord_chart(chord_id)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to delete chord chart'}), 500
    except ValueError as e:
        error_msg = str(e).lower()
        # Handle case where chord chart doesn't exist
        if "not found" in error_msg:
            app.logger.warning(f"Chord chart {chord_id} not found: {str(e)}")
            return jsonify({'error': 'Chord chart not found'}), 404
        # Handle rate limit errors specifically
        elif "quota exceeded" in error_msg or "rate_limit_exceeded" in error_msg:
            app.logger.warning(f"Rate limit exceeded deleting chord chart {chord_id}: {str(e)}")
            return jsonify({
                'error': 'Rate limit exceeded. Please try again in a moment.',
                'retry_after': 60  # Suggest waiting 60 seconds
            }), 429
        else:
            app.logger.error(f"ValueError deleting chord chart {chord_id}: {str(e)}")
            return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f"Error deleting chord chart {chord_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/batch-delete', methods=['POST'])
def batch_delete_chord_charts_route():
    """Delete multiple chord charts by IDs in a single transaction."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        chord_ids = data.get('chord_ids', [])
        
        if not chord_ids:
            return jsonify({"error": "No chord IDs provided"}), 400
        
        if not isinstance(chord_ids, list):
            return jsonify({"error": "chord_ids must be an array"}), 400
        
        app.logger.info(f"Batch deleting chord charts: {chord_ids}")
        
        # Import the function from sheets module
        from app.sheets import batch_delete_chord_charts
        
        result = batch_delete_chord_charts(chord_ids)
        
        if result['success']:
            app.logger.info(f"Successfully batch deleted {len(result['deleted'])} chord charts")
            return jsonify(result)
        else:
            app.logger.error(f"Batch delete failed: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500
            
    except Exception as e:
        app.logger.error(f"Error in batch delete chord charts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/common/search', methods=['GET'])
def search_common_chord_charts_route():
    """Search for specific common chord charts by name."""
    try:
        chord_name = request.args.get('name', '').strip()
        if not chord_name:
            return jsonify({'error': 'Chord name parameter required'}), 400
            
        app.logger.info(f"Searching common chord charts for: {chord_name}")
        matching_chords = search_common_chord_charts(chord_name)
        
        # Cache search results for longer since they're specific
        response = jsonify(matching_chords)
        response.headers['Cache-Control'] = 'public, max-age=1800'  # Cache for 30 minutes
        
        app.logger.info(f"Found {len(matching_chords)} matching chord charts for '{chord_name}'")
        return response
        
    except Exception as e:
        app.logger.error(f"Error searching common chord charts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/common', methods=['GET'])
def get_common_chord_charts_route():
    """Get all common chord charts from the CommonChords sheet."""
    try:
        app.logger.info("Fetching common chord charts")
        common_chords = get_common_chord_charts()
        
        # Add cache control headers to allow caching but ensure freshness
        response = jsonify(common_chords)
        response.headers['Cache-Control'] = 'public, max-age=300'  # Cache for 5 minutes
        
        app.logger.info(f"Returning {len(common_chords)} common chord charts")
        return response
        
    except Exception as e:
        app.logger.error(f"Error fetching common chord charts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/seed', methods=['POST'])
def seed_common_chord_charts_route():
    """Seed the CommonChords sheet with essential chords."""
    try:
        app.logger.info("Seeding common chord charts")
        success = seed_common_chord_charts()
        
        if success:
            app.logger.info("Successfully seeded common chord charts")
            return jsonify({'success': True, 'message': 'Common chords seeded successfully'})
        else:
            app.logger.error("Failed to seed common chord charts")
            return jsonify({'success': False, 'error': 'Failed to seed common chords'}), 500
            
    except Exception as e:
        app.logger.error(f"Error seeding common chord charts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chord-charts/<int:chord_id>', methods=['PUT'])
def update_chord_chart_route(chord_id):
    """Update a chord chart by ID."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        chord_data = request.json
        app.logger.debug(f"Updating chord chart {chord_id} with data: {chord_data}")
        
        result = update_chord_chart(chord_id, chord_data)
        if result:
            return jsonify(result)
        else:
            return jsonify({'error': 'Failed to update chord chart'}), 500
    except Exception as e:
        app.logger.error(f"Error updating chord chart {chord_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/items/<int:item_id>/chord-charts/order', methods=['PUT'])
def update_chord_charts_order_route(item_id):
    """Update the order of chord charts for an item."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        chord_charts = request.json
        app.logger.debug(f"Updating chord chart order for item {item_id}: {chord_charts}")
        
        success = update_chord_charts_order(item_id, chord_charts)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to update chord chart order'}), 500
            
    except Exception as e:
        app.logger.error(f"Error updating chord chart order: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chord-charts/bulk-import', methods=['POST'])
def bulk_import_chords_route():
    """Import chords from TormodKv's SVGuitar-ChordCollection repository."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        chord_names = data.get('chord_names', None)  # None means import all available
        
        app.logger.info(f"Starting bulk import of chords: {chord_names or 'all available'}")
        
        # Import chords using our bulk import function
        results = bulk_import_chords_from_tormodkv(chord_names)
        
        # Log results
        imported_count = len(results.get('imported', []))
        skipped_count = len(results.get('skipped', []))
        failed_count = len(results.get('failed', []))
        
        app.logger.info(f"Bulk import completed: {imported_count} imported, {skipped_count} skipped, {failed_count} failed")
        
        # Return success response with detailed results
        return jsonify({
            'success': True,
            'results': results,
            'summary': {
                'imported': imported_count,
                'skipped': skipped_count,
                'failed': failed_count
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error in bulk import: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chord-charts/bulk-import-local', methods=['POST'])
def bulk_import_chords_local_route():
    """Import chords from local TormodKv chord collection file."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        chord_names = data.get('chord_names', None)  # None means import all available
        
        app.logger.info(f"Starting local bulk import of chords: {chord_names or 'all available'}")
        
        # Import chords using our local bulk import function
        results = bulk_import_chords_from_local_file(chord_names)
        
        # Log results
        imported_count = len(results.get('imported', []))
        skipped_count = len(results.get('skipped', []))
        failed_count = len(results.get('failed', []))
        
        app.logger.info(f"Local bulk import completed: {imported_count} imported, {skipped_count} skipped, {failed_count} failed")
        
        return jsonify({
            'success': True, 
            'results': results,
            'summary': {
                'imported': imported_count,
                'skipped': skipped_count,
                'failed': failed_count
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error in local bulk import: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chord-charts/copy', methods=['POST'])
def copy_chord_charts_route():
    """Copy chord charts from one song to multiple other songs."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        source_item_id = data.get('source_item_id')
        target_item_ids = data.get('target_item_ids', [])
        
        if not source_item_id:
            return jsonify({"error": "source_item_id is required"}), 400
            
        if not target_item_ids or not isinstance(target_item_ids, list):
            return jsonify({"error": "target_item_ids must be a non-empty array"}), 400
        
        app.logger.info(f"Copying chord charts from item {source_item_id} to items {target_item_ids}")
        
        result = copy_chord_charts_to_items(source_item_id, target_item_ids)
        
        app.logger.info(f"Successfully copied {result['charts_found']} chord charts to {len(result['target_items'])} items")
        
        return jsonify({
            'success': True,
            'message': f"Copied {result['charts_found']} chord charts to {len(result['target_items'])} songs",
            'result': result
        })
        
    except Exception as e:
        app.logger.error(f"Error copying chord charts: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/debug/log', methods=['POST'])
def debug_log_route():
    """Endpoint for frontend to send debug logs to backend."""
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        message = data.get('message', '')
        level = data.get('level', 'DEBUG')
        context = data.get('context', {})
        
        # Format the message with context if provided
        if context:
            formatted_message = f"[FRONTEND {level}] {message} | Context: {context}"
        else:
            formatted_message = f"[FRONTEND {level}] {message}"
        
        # Log at appropriate level
        if level.upper() == 'ERROR':
            app.logger.error(formatted_message)
        elif level.upper() == 'WARNING':
            app.logger.warning(formatted_message)
        else:
            app.logger.info(formatted_message)
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        app.logger.error(f"Error in debug log endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500