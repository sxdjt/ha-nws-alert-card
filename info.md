# US NWS Alert Card

Display active US National Weather Service alerts with real-time updates, severity-based color coding, and expandable descriptions.

## Disclaimer

**Important:** Do not rely on this card for critical weather information. Always consult the National Weather Service or other competent weather providers for important safety decisions.

## Key Features

- **Real-time NWS Alerts**: Automatically fetches active weather alerts for your specified zone
- **Dynamic Location Support**: Automatic geolocation for mobile devices with separate desktop and mobile configurations
- **Entity Tracking**: Follow device_tracker entities for location-aware alerts
- **Automatic Zone Resolution**: Converts coordinates to NWS zones using the NWS Points API
- **Severity Color Coding**: Visual indicators for Extreme (Red), Severe (Orange), Moderate (Yellow), Minor (Green), and Unknown (Gray) alerts
- **Expandable Descriptions**: Toggle between collapsed and expanded alert details
- **Automatic Updates**: Configurable polling interval (default: 5 minutes)
- **Smart Caching**: 24-hour coordinate-to-zone caching to minimize API calls
- **Reliable Fetching**: Exponential backoff retry logic with 10-second timeout
- **Security Hardened**: XSS protection and input sanitization
- **Accessible**: ARIA labels and keyboard navigation support

## Quick Configuration

**Basic (static zone):**
```yaml
type: custom:nws-alert-card
nws_zone: WAZ558
email: your-email@example.com
```

**With mobile tracking:**
```yaml
type: custom:nws-alert-card
latitude: 47.6062  # Home location
longitude: -122.3321
mobile_latitude: device_tracker.my_phone  # Track phone on mobile
mobile_longitude: device_tracker.my_phone
email: your-email@example.com
```

**Mixed (zone fallback with mobile tracking):**
```yaml
type: custom:nws-alert-card
nws_zone: WAZ558  # Desktop fallback
mobile_latitude: device_tracker.my_phone
mobile_longitude: device_tracker.my_phone
email: your-email@example.com
```

## Finding Your NWS Zone

**Method 1:** Visit [NWS Public Zones](https://www.weather.gov/pimar/PubZone), select your state and find your zone code.

**Method 2:** Visit `https://api.weather.gov/points/LAT,LONG` (replace with your coordinates) and find the `forecastZone` field.

**Zone Format Examples:**
- Fairbanks, Alaska: `AKZ844`
- Las Vegas, Nevada: `NVZ020`
- Denver, Colorado: `COZ097`

## Support

For issues, feature requests, or questions, please visit the [GitHub repository](https://github.com/sxdjt/ha-nws-alert-card).
