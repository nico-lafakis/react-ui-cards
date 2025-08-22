import requests
import time
import json

# --- Configuration ---
ACCESS_TOKEN = 'HUBSPOT_PRIVATE_ACCESS_TOKEN'
HEADERS = {
    'Authorization': f'Bearer {ACCESS_TOKEN}',
    'Content-Type': 'application/json'
}
PROPERTY_TO_CHECK = "location_id"
SOURCE_PROPERTY = "hs_number"


def batch_update_invoices_with_retry(update_payload, max_retries=5):
    """
    Updates a batch of invoices with retry logic for rate limiting.
    """
    if not update_payload:
        print("No updates to send in this batch.")
        return True
        
    update_url = "https://api.hubapi.com/crm/v3/objects/invoices/batch/update"
    payload = {"inputs": update_payload}
    
    retries = 0
    while retries < max_retries:
        try:
            response = requests.post(update_url, headers=HEADERS, data=json.dumps(payload))
            
            if response.status_code == 200:
                print(f"SUCCESS: Batch of {len(update_payload)} invoices submitted for update.")
                return True
            # Handle rate limiting
            elif response.status_code == 429:
                print("WARNING: Rate limit hit on batch update. Retrying after a short wait...")
                wait_time = (2 ** retries)
                time.sleep(wait_time)
                retries += 1
            else:
                print(f"ERROR: Failed to submit batch update. Status: {response.status_code}")
                print(f"Response: {response.text}")
                return False  # Stop on other errors

        except requests.exceptions.RequestException as e:
            print(f"ERROR: A network error occurred during batch update: {e}")
            retries += 1
            time.sleep((2 ** retries))

    print(f"FATAL: Could not submit batch update after {max_retries} retries.")
    return False


def process_invoices_in_batches():
    """
    Searches for and prepares batches of invoices for updating.
    """
    search_url = "https://api.hubapi.com/crm/v3/objects/invoices/search"
    after = None
    total_processed_count = 0
    
    while True:
        # Construct the search payload
        search_payload = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": PROPERTY_TO_CHECK,
                    "operator": "NOT_HAS_PROPERTY"
                }]
            }],
            "properties": ["hs_object_id", SOURCE_PROPERTY],
            "limit": 100
        }
        
        if after:
            search_payload["after"] = after

        print(f"\nSearching for next batch of records (after: {after})...")
        
        try:
            response = requests.post(search_url, headers=HEADERS, data=json.dumps(search_payload))
            response.raise_for_status()
            
            data = response.json()
            invoices_to_process = data.get("results", [])
            
            if not invoices_to_process:
                print("--- All invoices have been processed. ---")
                break
            
            print(f"Found {len(invoices_to_process)} invoices. Preparing batch update...")
            
            # Prepare the list of updates for the batch endpoint
            updates_for_batch = []
            for invoice in invoices_to_process:
                invoice_id = invoice.get("id")
                invoice_number = invoice.get("properties", {}).get(SOURCE_PROPERTY)
                
                if invoice_number and isinstance(invoice_number, str) and len(invoice_number) >= 6:
                    new_location_id = invoice_number[:6]
                    updates_for_batch.append({
                        "id": invoice_id,
                        "properties": {
                            PROPERTY_TO_CHECK: new_location_id
                        }
                    })
                else:
                    print(f"SKIPPED: Invoice {invoice_id} - '{SOURCE_PROPERTY}' is invalid or too short ('{invoice_number}').")
            
            # Send the batch update request
            if updates_for_batch:
                if not batch_update_invoices_with_retry(updates_for_batch):
                    print("Stopping script due to batch update failure.")
                    break # Stop if a batch fails completely
            
            total_processed_count += len(invoices_to_process)
            
            # Check for the next page
            if data.get("paging") and data["paging"].get("next"):
                after = data["paging"]["next"]["after"]
            else:
                print("--- Reached the end of the invoice list. ---")
                break

        except requests.exceptions.RequestException as e:
            print(f"FATAL: An error occurred during search: {e}")
            break

    print(f"\nScript finished. Total records fetched: {total_processed_count}")

# --- Run the script ---
if __name__ == "__main__":
    process_invoices_in_batches()