# US NWS Alert Card

Display active US National Weather Service alerts with real-time updates, severity-based color coding, and expandable descriptions.

## Disclaimer

**Important:** Do not rely on this card for critical weather information. Always consult the National Weather Service or other competent weather providers for important safety decisions.

## Key Features

- **Real-time NWS Alerts**: Automatically fetches active weather alerts for your specified zone
- **Severity Color Coding**: Visual indicators for Extreme (Red), Severe (Orange), Moderate (Yellow), Minor (Green), and Unknown (Gray) alerts
- **Expandable Descriptions**: Toggle between collapsed and expanded alert details
- **Automatic Updates**: Configurable polling interval (default: 5 minutes)
- **Reliable Fetching**: Exponential backoff retry logic with 10-second timeout
- **Security Hardened**: XSS protection and input sanitization
- **Accessible**: ARIA labels and keyboard navigation support

## Quick Configuration

```yaml
type: custom:nws-alert-card
nws_zone: WAZ558  # Your NWS zone (REQUIRED)
email: your-email@example.com  # REQUIRED for NWS API compliance
title: NWS Weather Alert  # Optional
update_interval: 300  # Optional, seconds between updates
show_severity_markers: true  # Optional
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
