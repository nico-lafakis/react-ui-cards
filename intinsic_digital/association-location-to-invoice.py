import requests
import time
import json

# --- ⚙️ CONFIGURATION: REPLACE THESE TWO VALUES ---
ACCESS_TOKEN = 'HUBSPOT_PRIVATE_ACCESS_TOKEN'
# Find this in Settings > Objects > Custom Objects > Associations > View association details
ASSOCIATION_TYPE_ID_FROM_HUBSPOT = 123  # <-- Replace this with the real ID!


# --- Script Constants ---
CUSTOM_OBJECT_TYPE_ID = '2-16842375'
INVOICE_OBJECT_TYPE_ID = '0-53'
HEADERS = {
    'Authorization': f'Bearer {ACCESS_TOKEN}',
    'Content-Type': 'application/json'
}

def make_api_request_with_retry(method, url, payload=None, max_retries=5):
    """A robust function to make any API request with retry logic."""
    retries = 0
    while retries < max_retries:
        try:
            response = requests.request(method.upper(), url, headers=HEADERS, json=payload)
            if 200 <= response.status_code < 300:
                return response.json()
            elif response.status_code == 429:
                print(f"  [!] Rate limit hit. Pausing for {2**retries}s...")
                time.sleep(2**retries)
            else:
                print(f"  [!] API Error: {response.status_code} {response.text}. Retrying...")
                time.sleep(2**retries)
        except requests.exceptions.RequestException as e:
            print(f"  [!] Network Error: {e}. Retrying...")
            time.sleep(2**retries)
        retries += 1
    print(f"  [!!] FATAL: Request failed after {max_retries} attempts.")
    return None

def fetch_all_objects_by_location(object_type_id, object_name):
    """Fetches all objects of a given type and maps their location_id to their object_id."""
    print(f"[*] Starting fetch for all {object_name}...")
    object_map = {}
    after = None
    records_fetched = 0
    while True:
        search_payload = {
            "filterGroups": [{"filters": [{"propertyName": "location_id", "operator": "HAS_PROPERTY"}]}],
            "properties": ["location_id"],
            "limit": 100,
            "after": after
        }
        data = make_api_request_with_retry('POST', f"https://api.hubapi.com/crm/v3/objects/{object_type_id}/search", search_payload)

        if not data: return None # Permanent failure
        
        results = data.get("results", [])
        if not results: break

        for item in results:
            location_id = item.get("properties", {}).get("location_id")
            if location_id:
                object_map[location_id] = item.get("id")
        
        records_fetched += len(results)
        print(f"  [*] Fetched {records_fetched} {object_name} so far...")

        if data.get("paging") and data["paging"].get("next"):
            after = data["paging"]["next"]["after"]
        else:
            break
            
    print(f"[*] Finished fetch. Found {len(object_map)} unique {object_name} with a location_id.")
    return object_map

def run_bulk_association_script():
    """Main function to orchestrate the entire association process."""
    print("--- SCRIPT STARTED: BULK ASSOCIATING INVOICES WITH CUSTOM OBJECTS ---")
    
    # Step 1: Fetch all data from both objects
    invoice_map = fetch_all_objects_by_location(INVOICE_OBJECT_TYPE_ID, "Invoices")
    if invoice_map is None: return
    
    custom_object_map = fetch_all_objects_by_location(CUSTOM_OBJECT_TYPE_ID, "Custom Objects")
    if custom_object_map is None: return

    # Step 2: Pair objects and prepare the list of associations to create
    print("\n[*] Pairing objects and preparing associations...")
    associations_to_create = []
    # Iterate through the smaller dictionary for better performance
    source_map, target_map = (invoice_map, custom_object_map) if len(invoice_map) < len(custom_object_map) else (custom_object_map, invoice_map)

    for location_id, from_id in source_map.items():
        if location_id in target_map:
            to_id = target_map[location_id]
            # Ensure the 'from' and 'to' objects match our API call structure
            invoice_id = from_id if source_map == invoice_map else to_id
            custom_object_id = to_id if source_map == invoice_map else from_id

            associations_to_create.append({
                "from": {"id": invoice_id},
                "to": {"id": custom_object_id},
                "types": [{"associationCategory": "USER_DEFINED", "associationTypeId": ASSOCIATION_TYPE_ID_FROM_HUBSPOT}]
            })

    if not associations_to_create:
        print("\n--- SCRIPT COMPLETE: No matching pairs found to associate. ---")
        return

    print(f"[*] Found {len(associations_to_create)} pairs to associate. Now creating them in batches...")

    # Step 3: Use the batch endpoint to create the associations
    total_associated = 0
    # Process the associations in chunks of 100 (the API limit)
    for i in range(0, len(associations_to_create), 100):
        batch = associations_to_create[i:i + 100]
        batch_payload = {"inputs": batch}
        
        print(f"  [*] Submitting batch of {len(batch)} associations...")
        # Note: The 'from' object (Invoice) and 'to' object (Custom Object) are defined in the URL
        url = f"https://api.hubapi.com/crm/v4/associations/{INVOICE_OBJECT_TYPE_ID}/{CUSTOM_OBJECT_TYPE_ID}/batch/create"
        response = make_api_request_with_retry('POST', url, batch_payload)
        
        if response:
            total_associated += len(batch)
            print(f"  [*] SUCCESS. Total associated so far: {total_associated}")
        else:
            print("[!!] FATAL: A batch association failed permanently. Stopping script.")
            return

    print(f"\n--- SCRIPT COMPLETE: Successfully created {total_associated} associations. ---")


# --- Run the script ---
if __name__ == "__main__":
    run_bulk_association_script()