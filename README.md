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
- Persistent toggle state across updates
- Automatic polling with configurable interval
- Exponential backoff retry logic for failed requests
- Security: Email sanitization and XSS protection
- Accessibility: ARIA labels and keyboard navigation
- Memory-efficient event delegation
- Set-based alert comparison for optimal performance
- Proper handling of "no alerts" state

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the 3 dots in the upper right corner
3. Select "Custom repositories"
4. Add this repository URL: `https://github.com/sxdjt/ha-nws-alert-card`
5. Select category: "Lovelace"
6. Click "Install"
7. Restart Home Assistant

### Manual Installation

1. Download `nws-alert-card.js` from this repository
2. Copy it to `/config/www/nws-alert-card.js` on your Home Assistant server
3. Add the resource in your Lovelace configuration:
   - Go to Settings → Dashboards
   - Click the 3-dot menu → Resources
   - Add resource:
     - URL: `/local/nws-alert-card.js`
     - Resource type: JavaScript Module

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

## Recent Improvements (v2.0)

### Security Enhancements
- Email input sanitization prevents header injection
- XSS protection via HTML escaping for all user-facing text
- `rel="noopener noreferrer"` on external links

### Performance Optimizations
- Event delegation eliminates memory leaks from repeated renders
- Set-based alert comparison instead of JSON serialization
- Persistent toggle state across updates
- Efficient re-rendering only when alerts change

### Reliability Features
- Exponential backoff retry logic (max 3 attempts)
- 10-second fetch timeout via AbortSignal
- Proper error boundaries and validation
- Zone format validation
- Better handling of empty alert states

### User Experience
- Accessible ARIA labels and keyboard navigation
- Dynamic card sizing based on alert count
- Improved date formatting with shorter month names
- Visual improvements (consistent spacing, hover states)
- Loading state on initial connection
- Proper "No active alerts" message display

### Code Quality
- Constants for magic numbers
- Proper method organization and separation of concerns
- Comprehensive error messages
- Better documentation

## Troubleshooting

### "No active alerts" not showing
- The card now forces an initial render with "Loading..." state
- After the first successful fetch, it displays "No active alerts" when appropriate
- Check browser console (F12) for any errors

### Alerts not updating
- Verify your `update_interval` setting
- Check that `nws_zone` is correctly formatted (e.g., `WAZ558`)
- Review Home Assistant logs for API errors
- Ensure your Home Assistant has internet access

### Zone validation warning
- If you see a zone format warning, verify your zone follows the pattern: `SSZNNN` or `SSCNNN`
- Example valid zones: `AKZ844`, `NVZ020`, `WAC033`

### Toggle state resets
- This issue has been fixed in v2.0 - toggle states now persist across updates

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
