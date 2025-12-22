# NWS Alert Card for Home Assistant

[![AI Assisted](https://img.shields.io/badge/AI-Claude%20Code-AAAAAA.svg)](https://claude.ai/code)

A custom Lovelace card that displays active US National Weather Service alerts with real-time updates, severity-based color coding, and expandable descriptions.

<img width="506" height="218" alt="Screenshot 2025-11-24 at 13 37 37" src="https://github.com/user-attachments/assets/2c96e6ab-767f-4649-9faf-8efdea62e1be" />

<img width="514" height="476" alt="Screenshot 2025-11-24 at 13 37 49" src="https://github.com/user-attachments/assets/3f3b8f4a-8fbe-46b2-a12c-5f4273e1d031" />

## Disclaimer‼️

**Important: Do not rely on this card for critical weather information. Always consult the National Weather Service or other competent weather providers for important safety decisions.**

## Features

- Real-time NWS weather alerts for your specified zone
- Severity-based color coding (Extreme, Severe, Moderate, Minor, Unknown)
- Expandable alert descriptions with "Show more/less" toggle

## Installation

### HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=sxdjt&repository=ha-nws-alert-card)


## Finding Your NWS Zone

To configure the card, you need your NWS zone ID. There are two ways to find it:

### Method 1: NWS Public Zone Page
1. Visit [NWS Public Zones](https://www.weather.gov/pimar/PubZone)
2. Select your state
3. Find your county/area
4. Note the zone code (format: `SSZNNN` or `SSCNNN`)

### Method 2: Using Coordinates
1. Get your lat/long coordinates
2. Visit: `https://api.weather.gov/points/LAT,LONG` (replace LAT,LONG with your coordinates)
3. Find the `forecastZone` field in the JSON response
4. The zone ID is the last part of the URL (e.g., `COZ097`)

**Zone Format:**
- `SS` = 2-letter state abbreviation (e.g., `AK`, `NY`)
- `Z` or `C` = Zone or County
- `NNN` = 3-digit number (e.g., `001`, `329`)

**Examples:**
- Fairbanks, Alaska: `AKZ844`
- Las Vegas, Nevada: `NVZ020`
- Denver, Colorado: `COZ097`

## Configuration

Add the card to your Lovelace dashboard:

```yaml
type: custom:nws-alert-card
nws_zone: WAZ558  # Your NWS zone (REQUIRED)
email: your-email@example.com  # REQUIRED for NWS API compliance
title: NWS Weather Alert  # Optional, default: "NWS Weather Alert"
update_interval: 300  # Optional, seconds between updates, default: 300 (5 minutes)
show_severity_markers: true  # Optional, show ⚠ markers for severe alerts, default: true
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `nws_zone` | string | Yes | - | Your NWS zone ID (e.g., `WAZ558`) |
| `email` | string | Yes | - | Your email for NWS API User-Agent header |
| `title` | string | No | `NWS Weather Alert` | Card title |
| `update_interval` | number | No | `300` | Seconds between alert checks |
| `show_severity_markers` | boolean | No | `true` | Show ⚠ markers for severe alerts |

## Severity Color Coding

Alerts are color-coded by severity on the left border:

- **Extreme** (Red): Life-threatening situations
- **Severe** (Orange): Significant threat to life/property
- **Moderate** (Yellow): Possible threat to life/property
- **Minor** (Green): Minimal threat to life/property
- **Unknown** (Gray): Severity not specified



## API Information

This card uses the National Weather Service API:
- Endpoint: `https://api.weather.gov/alerts/active/zone/{zone}`
- Format: GeoJSON
- Rate limiting: Implemented with exponential backoff
- Timeout: 10 seconds per request

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Credits

Created by [sxdjt](https://github.com/sxdjt)

Uses data from the [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
