import requests
import json

def get_nws_zones_data():
    """Fetches NWS zone data from the API."""
    url = "https://api.weather.gov/zones"
    headers = {
        # NWS API requires a User-Agent header
        # Best practice is to use your email or project URL
        "User-Agent": "NWSZoneDumper/1.0 (your_email@example.com)" # REMEMBER TO CHANGE THIS!
    }
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from NWS API: {e}")
        return None

def format_as_markdown_table(zones_data):
    """Formats a list of zone dictionaries into a Markdown table."""
    if not zones_data:
        return "No data to display."

    # Define the headers
    headers = ["State", "Name", "Zone ID"]

    # Extract the rows and prepare for sorting
    # Each item in `zones_data` is a dictionary: {'state': 'WA', 'name': '...', 'zone_id': 'WAZ...'}
    rows = []
    for item in zones_data:
        rows.append([item['state'], item['name'], item['zone_id']])

    # Sort rows by state (index 0) then by name (index 1)
    # The fix ensures that x[0] and x[1] are always strings before comparison
    rows.sort(key=lambda x: (x[0], x[1]))

    # Calculate maximum column widths for alignment
    col_widths = [len(header) for header in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))

    # Build the header row
    header_line = " | ".join(header.ljust(col_widths[i]) for i, header in enumerate(headers))

    # Build the separator line
    separator_line = " | ".join("-" * col_widths[i] for i in range(len(headers)))

    # Build the data rows
    data_lines = []
    for row in rows:
        data_lines.append(" | ".join(str(cell).ljust(col_widths[i]) for i, cell in enumerate(row)))

    return "\n".join([header_line, separator_line] + data_lines)

def main():
    """Main function to fetch, process, and display NWS zone data."""
    data = get_nws_zones_data()

    if data:
        extracted_zones = []
        for feature in data.get('features', []):
            properties = feature.get('properties')
            if properties:
                # Explicitly check for None and replace with 'N/A' before adding to list
                # This ensures that state and name are always strings for sorting
                state_val = properties.get('state')
                name_val = properties.get('name')
                zone_id_val = properties.get('id')

                extracted_zones.append({
                    'state': state_val if state_val is not None else 'N/A',
                    'name': name_val if name_val is not None else 'N/A',
                    'zone_id': zone_id_val if zone_id_val is not None else 'N/A'
                })

        markdown_table = format_as_markdown_table(extracted_zones)
        print(markdown_table)
    else:
        print("Failed to retrieve or process NWS zone data.")

if __name__ == "__main__":
    main()