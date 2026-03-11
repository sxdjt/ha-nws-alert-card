/**
 * NWS Alert Card - v2.7.2
 * A Home Assistant custom Lovelace card for US National Weather Service alerts.
 * https://github.com/sxdjt/ha-nws-alert-card
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// NWS Alert Priority Order (highest priority first)
// Source: https://www.weather.gov/help-map/
const NWS_ALERT_PRIORITY = [
  'Tsunami Warning',
  'Tornado Warning',
  'Extreme Wind Warning',
  'Severe Thunderstorm Warning',
  'Flash Flood Warning',
  'Flash Flood Statement',
  'Severe Weather Statement',
  'Shelter In Place Warning',
  'Evacuation Immediate',
  'Civil Danger Warning',
  'Nuclear Power Plant Warning',
  'Radiological Hazard Warning',
  'Hazardous Materials Warning',
  'Fire Warning',
  'Civil Emergency Message',
  'Law Enforcement Warning',
  'Storm Surge Warning',
  'Hurricane Force Wind Warning',
  'Hurricane Warning',
  'Typhoon Warning',
  'Special Marine Warning',
  'Blizzard Warning',
  'Snow Squall Warning',
  'Ice Storm Warning',
  'Heavy Freezing Spray Warning',
  'Winter Storm Warning',
  'Lake Effect Snow Warning',
  'Dust Storm Warning',
  'Blowing Dust Warning',
  'High Wind Warning',
  'Tropical Storm Warning',
  'Storm Warning',
  'Tsunami Advisory',
  'Tsunami Watch',
  'Avalanche Warning',
  'Earthquake Warning',
  'Volcano Warning',
  'Ashfall Warning',
  'Flood Warning',
  'Coastal Flood Warning',
  'Lakeshore Flood Warning',
  'Ashfall Advisory',
  'High Surf Warning',
  'Extreme Heat Warning',
  'Tornado Watch',
  'Severe Thunderstorm Watch',
  'Flash Flood Watch',
  'Gale Warning',
  'Flood Statement',
  'Extreme Cold Warning',
  'Freeze Warning',
  'Red Flag Warning',
  'Storm Surge Watch',
  'Hurricane Watch',
  'Hurricane Force Wind Watch',
  'Typhoon Watch',
  'Tropical Storm Watch',
  'Storm Watch',
  'Tropical Cyclone Local Statement',
  'Winter Weather Advisory',
  'Avalanche Advisory',
  'Cold Weather Advisory',
  'Heat Advisory',
  'Flood Advisory',
  'Coastal Flood Advisory',
  'Lakeshore Flood Advisory',
  'High Surf Advisory',
  'Dense Fog Advisory',
  'Dense Smoke Advisory',
  'Small Craft Advisory',
  'Brisk Wind Advisory',
  'Hazardous Seas Warning',
  'Dust Advisory',
  'Blowing Dust Advisory',
  'Lake Wind Advisory',
  'Wind Advisory',
  'Frost Advisory',
  'Freezing Fog Advisory',
  'Freezing Spray Advisory',
  'Low Water Advisory',
  'Local Area Emergency',
  'Winter Storm Watch',
  'Rip Current Statement',
  'Beach Hazards Statement',
  'Gale Watch',
  'Avalanche Watch',
  'Hazardous Seas Watch',
  'Heavy Freezing Spray Watch',
  'Flood Watch',
  'Coastal Flood Watch',
  'Lakeshore Flood Watch',
  'High Wind Watch',
  'Extreme Heat Watch',
  'Extreme Cold Watch',
  'Freeze Watch',
  'Fire Weather Watch',
  'Extreme Fire Danger',
  '911 Telephone Outage',
  'Coastal Flood Statement',
  'Lakeshore Flood Statement',
  'Special Weather Statement',
  'Marine Weather Statement',
  'Air Quality Alert',
  'Air Stagnation Advisory',
  'Hazardous Weather Outlook',
  'Hydrologic Outlook',
  'Short Term Forecast',
  'Administrative Message',
  'Test',
  'Child Abduction Emergency',
  'Blue Alert'
];

// Fetch and retry constants
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;
const DESCRIPTION_THRESHOLD = 200;

// Zone resolver constants
const ZONE_CACHE_TTL = 86400000;   // 24 hours in ms
const ZONE_CACHE_MAX = 10;          // Max cached zone entries (LRU)
const ZONE_RESOLVE_DEBOUNCE = 5000; // 5 second debounce for entity updates

// ---------------------------------------------------------------------------
// Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Validate and sanitize an email address for use in API headers.
 * Returns default email if input is invalid.
 */
function sanitizeEmail(email) {
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleaned)) {
    console.warn('NWS Alert Card: Invalid email format, using default');
    return 'homeassistant@example.com';
  }

  return cleaned;
}

/**
 * Format an ISO date string to a localized display string.
 */
function formatTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      hour12: true
    });
  } catch (err) {
    console.error('Date formatting error:', err);
    return 'N/A';
  }
}

/**
 * Escape HTML to prevent XSS via textContent/innerHTML conversion.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert NWS hard line breaks to natural flowing text.
 * NWS API returns descriptions with hard breaks every 67-69 chars.
 * This preserves paragraph breaks (double newlines) but joins single
 * line breaks into flowing text.
 */
function normalizeDescription(text) {
  return text
    .trim()
    // Normalize line endings to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Split on double (or more) line breaks to identify paragraphs
    .split(/\n\s*\n/)
    // Process each paragraph
    .map(paragraph => {
      return paragraph
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ')
        .trim();
    })
    // Filter out empty paragraphs
    .filter(paragraph => paragraph.length > 0)
    // Rejoin with double line breaks for paragraph separation
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * Create and return a <style> element with all card CSS rules.
 */
function createStyleElement() {
  const style = document.createElement('style');
  style.textContent = `
    ha-card {
      padding: 16px;
      display: block;
    }
    .alert-item {
      margin-bottom: 12px;
      border-left: 4px solid var(--divider-color);
      padding-left: 10px;
      transition: border-color 0.2s ease;
    }
    .alert-item:last-child {
      margin-bottom: 0;
    }
    .alert-item:focus-within {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    .severity-Extreme { border-color: #dc3545; }
    .severity-Severe { border-color: #fd7e14; }
    .severity-Moderate { border-color: #ffc107; }
    .severity-Minor { border-color: #28a745; }
    .severity-Unknown { border-color: var(--divider-color); }
    .alert-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .alert-header h3 {
      margin: 0;
      font-size: var(--nws-alert-title-font-size, 16px);
      line-height: 1.4;
    }
    .alert-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin: 4px 0;
      font-size: var(--nws-meta-font-size, 14px);
      color: var(--nws-meta-color, var(--secondary-text-color));
    }
    .times {
      font-size: var(--nws-meta-font-size, 14px);
      color: var(--nws-times-color, var(--secondary-text-color));
    }
    .description {
      margin-top: 8px;
      color: var(--nws-description-color, var(--primary-text-color));
      font-size: var(--nws-description-font-size, 14px);
      line-height: 1.5;
      white-space: pre-line;
    }
    .toggle {
      color: var(--primary-color);
      cursor: pointer;
      font-size: 0.85em;
      user-select: none;
      display: inline-block;
      margin-top: 4px;
      padding: 4px 0;
      text-decoration: underline;
    }
    .toggle:hover {
      opacity: 0.8;
    }
    .toggle:focus {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    .error-message, .warning-message {
      padding: 12px;
      border-radius: 4px;
      text-align: center;
      margin: 8px 0;
    }
    .error-message {
      color: var(--error-color, #dc3545);
      background: var(--error-color, #dc3545)22;
      font-weight: 500;
    }
    .warning-message {
      color: var(--warning-color, #ffc107);
      background: var(--warning-color, #ffc107)22;
    }
    .no-alerts {
      text-align: center;
      color: var(--secondary-text-color);
      padding: 12px 0;
    }
    .alert-link {
      font-size: 0.85em;
      text-decoration: underline;
      color: var(--primary-color);
      display: inline-block;
      margin-top: 4px;
    }
    .alert-link:hover {
      opacity: 0.8;
    }
    .danger-marker {
      font-size: 0.85em;
      margin-right: 4px;
    }
    .card-title {
      margin: 0 0 12px 0;
      font-size: var(--nws-title-font-size, 20px);
      color: var(--nws-title-color, inherit);
    }
    .zone-subtitle {
      font-size: 0.85em;
      color: var(--nws-zone-color, var(--secondary-text-color));
      margin: -8px 0 12px 0;
    }
  `;
  return style;
}

/**
 * Apply font size CSS custom properties to the card element.
 * Reads font size config values and sets/removes corresponding CSS variables.
 */
function applyFontSizeStyles(element, config) {
  const fontMap = {
    title_font_size: '--nws-title-font-size',
    alert_title_font_size: '--nws-alert-title-font-size',
    meta_font_size: '--nws-meta-font-size',
    description_font_size: '--nws-description-font-size'
  };

  Object.entries(fontMap).forEach(([configKey, cssVar]) => {
    if (config[configKey]) {
      element.style.setProperty(cssVar, `${config[configKey]}px`);
    } else {
      element.style.removeProperty(cssVar);
    }
  });
}

/**
 * Apply text color CSS custom properties to the card element.
 * Reads color config values and sets/removes corresponding CSS variables.
 */
function applyColorStyles(element, config) {
  const colorMap = {
    title_color: '--nws-title-color',
    zone_color: '--nws-zone-color',
    times_color: '--nws-times-color',
    meta_color: '--nws-meta-color',
    description_color: '--nws-description-color'
  };

  Object.entries(colorMap).forEach(([configKey, cssVar]) => {
    if (config[configKey]) {
      element.style.setProperty(cssVar, config[configKey]);
    } else {
      element.style.removeProperty(cssVar);
    }
  });
}

// ---------------------------------------------------------------------------
// Alert Entity Integration
// ---------------------------------------------------------------------------

/**
 * Get NWS priority index for an alert event type.
 * Lower index = higher priority. Unknown types return max value (sorted to end).
 */
function getAlertPriority(eventType) {
  const index = NWS_ALERT_PRIORITY.indexOf(eventType);
  return index === -1 ? NWS_ALERT_PRIORITY.length : index;
}

/**
 * Sort alerts by official NWS priority order.
 * Returns a new sorted array (does not mutate input).
 */
function sortAlertsByPriority(alerts) {
  return [...alerts].sort((a, b) => {
    const eventA = a.properties?.event || '';
    const eventB = b.properties?.event || '';
    return getAlertPriority(eventA) - getAlertPriority(eventB);
  });
}

/**
 * Update the configured input_text entity with current alert data.
 * Formats alerts as comma-separated "EventType:Severity" pairs sorted by NWS priority.
 * Handles the 255-character input_text limit with truncation.
 */
function updateAlertEntity(alerts, config, hass) {
  const entityId = config.alert_entity;
  if (!entityId || !hass) return;

  // Verify entity exists
  if (!hass.states[entityId]) {
    console.warn(`NWS Alert Card: Alert entity '${entityId}' not found. Create an input_text helper with this entity ID.`);
    return;
  }

  // Sort alerts by NWS priority
  const sortedAlerts = sortAlertsByPriority(alerts);

  // Format as "Event Type:Severity" pairs, comma-separated
  let value = '';
  if (sortedAlerts.length > 0) {
    value = sortedAlerts
      .map(alert => {
        const event = alert.properties?.event || 'Unknown';
        const severity = alert.properties?.severity || 'Unknown';
        return `${event}:${severity}`;
      })
      .join(',');

    // Warn if value exceeds input_text limit (255 chars)
    if (value.length > 255) {
      console.warn(`NWS Alert Card: Alert data exceeds 255 character limit (${value.length} chars). Some alerts may be truncated.`);
      // Truncate at last complete entry before 255 chars
      const truncated = value.substring(0, 255);
      const lastComma = truncated.lastIndexOf(',');
      value = lastComma > 0 ? truncated.substring(0, lastComma) : truncated;
    }
  }

  // Call input_text.set_value service
  hass.callService('input_text', 'set_value', {
    entity_id: entityId,
    value: value
  }).catch(err => {
    console.error(`NWS Alert Card: Failed to update alert entity '${entityId}':`, err);
  });
}

// ---------------------------------------------------------------------------
// Action Manager
// ---------------------------------------------------------------------------

/**
 * Compare two Sets for equality.
 */
function setsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

/**
 * Manages severity-based action triggers with cooldown tracking
 * and queue management to prevent concurrent execution.
 */
class ActionManager {
  constructor() {
    this._lastMaxSeverity = null;
    this._actionQueue = [];
    this._actionInProgress = false;
  }

  /**
   * Returns numeric rank for severity comparison (higher = more severe).
   */
  getSeverityRank(severity) {
    const severityMap = {
      'Extreme': 4,
      'Severe': 3,
      'Moderate': 2,
      'Minor': 1,
      'Unknown': 0
    };
    return severityMap[severity] || 0;
  }

  /**
   * Returns the highest severity level from active alerts.
   */
  getMaxSeverity(alerts) {
    if (!alerts || alerts.length === 0) return null;

    let maxSeverity = 'Unknown';
    let maxRank = 0;

    alerts.forEach(alert => {
      const severity = alert.properties?.severity || 'Unknown';
      const rank = this.getSeverityRank(severity);
      if (rank > maxRank) {
        maxRank = rank;
        maxSeverity = severity;
      }
    });

    return maxSeverity;
  }

  /**
   * Determines if an action should be triggered based on alert changes.
   * Returns { shouldTrigger, severity }.
   */
  shouldTriggerAction(currentAlerts, lastAlertIds) {
    const currentMaxSeverity = this.getMaxSeverity(currentAlerts);

    // No alerts = no action
    if (!currentMaxSeverity) {
      return { shouldTrigger: false, severity: null };
    }

    // First time seeing alerts (initialization)
    if (this._lastMaxSeverity === null) {
      console.log(`NWS Alert Card: Initial alerts detected, max severity: ${currentMaxSeverity}`);
      return { shouldTrigger: true, severity: currentMaxSeverity };
    }

    // Check if severity increased
    const currentRank = this.getSeverityRank(currentMaxSeverity);
    const previousRank = this.getSeverityRank(this._lastMaxSeverity);

    if (currentRank > previousRank) {
      console.log(`NWS Alert Card: Severity increased from ${this._lastMaxSeverity} to ${currentMaxSeverity}`);
      return { shouldTrigger: true, severity: currentMaxSeverity };
    }

    // Check if new alerts appeared (set comparison)
    const currentIds = new Set(currentAlerts.map(a => a.id));
    const hasNewAlerts = !setsEqual(currentIds, lastAlertIds);

    if (hasNewAlerts) {
      console.log(`NWS Alert Card: New alerts detected with severity: ${currentMaxSeverity}`);
      return { shouldTrigger: true, severity: currentMaxSeverity };
    }

    // No changes warrant triggering
    return { shouldTrigger: false, severity: null };
  }

  /**
   * Trigger the configured action for the given severity level.
   * Checks cooldown, manages queue for concurrent prevention.
   */
  async triggerSeverityAction(severity, config, hass, currentZone) {
    const actionMap = {
      'Minor': config.minor_action,
      'Moderate': config.moderate_action,
      'Severe': config.severe_action,
      'Extreme': config.extreme_action
    };

    const entityId = actionMap[severity];

    if (!entityId) {
      // No action configured for this severity level
      return;
    }

    // Check cooldown period
    if (this._isInCooldown(severity, config, currentZone)) {
      console.log(`NWS Alert Card: Skipping ${severity} action trigger - still in cooldown period`);
      return;
    }

    // Prevent concurrent triggers
    if (this._actionInProgress) {
      console.log(`NWS Alert Card: Action in progress, queueing ${entityId}`);
      this._actionQueue.push({ severity, entityId });
      return;
    }

    this._actionInProgress = true;

    try {
      // Determine service based on entity domain
      const domain = entityId.split('.')[0];
      const service = (domain === 'script') ? 'turn_on' : 'trigger';

      console.log(`NWS Alert Card: Triggering ${severity} severity action: ${entityId}`);

      await hass.callService(domain, service, { entity_id: entityId });

      console.log(`NWS Alert Card: Successfully triggered ${entityId}`);

      // Set cooldown timestamp after successful trigger
      this._setCooldownTimestamp(severity, currentZone);

    } catch (err) {
      console.error(`NWS Alert Card: Failed to trigger action ${entityId}:`, err);

    } finally {
      this._actionInProgress = false;

      // Process queued actions if any
      if (this._actionQueue.length > 0) {
        const next = this._actionQueue.shift();
        setTimeout(() => this.triggerSeverityAction(next.severity, config, hass, currentZone), 100);
      }
    }
  }

  /**
   * Update the tracked maximum severity after processing alerts.
   */
  updateMaxSeverity(alerts) {
    this._lastMaxSeverity = this.getMaxSeverity(alerts);
  }

  /**
   * Reset action state (called on disconnect).
   */
  cleanup() {
    this._lastMaxSeverity = null;
    this._actionQueue = [];
    this._actionInProgress = false;
  }

  // -- Private cooldown methods --

  _getCooldownKey(severity, currentZone) {
    const zone = currentZone || 'unknown';
    return `nws-alert-card-cooldown-${severity}-${zone}`;
  }

  _isInCooldown(severity, config, currentZone) {
    const cooldownMinutes = config.alert_trigger_cooldown;

    // Cooldown of 0 means no cooldown
    if (cooldownMinutes === 0) {
      return false;
    }

    const cooldownKey = this._getCooldownKey(severity, currentZone);

    try {
      const lastTriggerTime = localStorage.getItem(cooldownKey);

      if (!lastTriggerTime) {
        return false;
      }

      const lastTrigger = parseInt(lastTriggerTime, 10);
      const now = Date.now();
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = now - lastTrigger;

      if (timeSinceLastTrigger < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastTrigger) / 60000);
        console.log(`NWS Alert Card: ${severity} action in cooldown. ${remainingMinutes} minutes remaining.`);
        return true;
      }

      return false;

    } catch (err) {
      console.warn('NWS Alert Card: Unable to access localStorage for cooldown tracking:', err);
      return false;
    }
  }

  _setCooldownTimestamp(severity, currentZone) {
    const cooldownKey = this._getCooldownKey(severity, currentZone);

    try {
      localStorage.setItem(cooldownKey, Date.now().toString());
    } catch (err) {
      console.warn('NWS Alert Card: Unable to save cooldown timestamp:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Zone Resolver
// ---------------------------------------------------------------------------

/**
 * Manages NWS zone resolution from coordinates and entities.
 * Handles mobile device detection, coordinate-to-zone conversion via the
 * NWS Points API, zone name lookups, and caching.
 */
class ZoneResolver {
  constructor() {
    this._zoneCache = new Map();
    this._currentZone = null;
    this._zoneName = null;
    this._isMobile = null;
    this._zoneResolveTimeout = null;
  }

  get currentZone() { return this._currentZone; }
  set currentZone(value) { this._currentZone = value; }

  get zoneName() { return this._zoneName; }
  set zoneName(value) { this._zoneName = value; }

  /**
   * Detect if the current device is a mobile device.
   * Result is cached since user agent doesn't change during session.
   */
  isMobileDevice() {
    if (this._isMobile !== null) {
      return this._isMobile;
    }

    const userAgent = navigator.userAgent.toLowerCase();

    // Check 1: Home Assistant Companion app
    const isHAApp = userAgent.includes('home assistant');

    // Check 2: Common mobile user agents
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    // Check 3: Screen width (mobile-sized)
    const isMobileScreen = window.innerWidth <= 768;

    // Device is mobile if HA app OR (mobile UA AND mobile screen)
    this._isMobile = isHAApp || (isMobileUA && isMobileScreen);
    return this._isMobile;
  }

  /**
   * Resolve a coordinate config value to a numeric coordinate.
   * Accepts numbers directly, or entity ID strings to look up attributes.
   */
  resolveCoordinate(coordConfig, coordType, hass) {
    if (coordConfig === undefined || coordConfig === null) return null;

    // If it's a number, return it directly
    if (typeof coordConfig === 'number') {
      return coordConfig;
    }

    // If it's a string, treat as entity ID
    if (typeof coordConfig === 'string') {
      if (!coordConfig.includes('.')) {
        console.warn(`NWS Alert Card: '${coordConfig}' does not appear to be a valid entity ID`);
        return null;
      }

      if (!hass || !hass.states) {
        console.warn('NWS Alert Card: Home Assistant state not available');
        return null;
      }

      const entityState = hass.states[coordConfig];
      if (!entityState) {
        console.warn(`NWS Alert Card: Entity '${coordConfig}' not found`);
        return null;
      }

      const attrName = coordType === 'latitude' ? 'latitude' : 'longitude';
      const value = entityState.attributes[attrName];

      if (value === undefined || value === null) {
        console.warn(`NWS Alert Card: Entity '${coordConfig}' missing '${attrName}' attribute`);
        return null;
      }

      const numValue = typeof value === 'number' ? value : parseFloat(value);

      if (isNaN(numValue)) {
        console.warn(`NWS Alert Card: Invalid ${coordType} value in entity '${coordConfig}'`);
        return null;
      }

      // Validate ranges
      if (coordType === 'latitude' && (numValue < -90 || numValue > 90)) {
        console.warn(`NWS Alert Card: Invalid latitude ${numValue} (must be -90 to 90)`);
        return null;
      }

      if (coordType === 'longitude' && (numValue < -180 || numValue > 180)) {
        console.warn(`NWS Alert Card: Invalid longitude ${numValue} (must be -180 to 180)`);
        return null;
      }

      return numValue;
    }

    console.warn(`NWS Alert Card: Invalid ${coordType} config type:`, coordConfig);
    return null;
  }

  /**
   * Convert lat/lon coordinates to an NWS zone code via the Points API.
   * Results are cached for 24 hours with LRU eviction at 10 entries.
   */
  async fetchZoneFromCoordinates(lat, lon, email) {
    // Round to 4 decimal places (~11m precision) for cache key
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    // Check cache first (24 hour TTL)
    const cached = this._zoneCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ZONE_CACHE_TTL) {
      console.log(`NWS Alert Card: Using cached zone ${cached.zone} for ${cacheKey}`);
      return cached.zone;
    }

    // Call NWS Points API
    const url = `https://api.weather.gov/points/${lat},${lon}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': `Home Assistant Custom Card / ${email}`,
          'Accept': 'application/geo+json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract zone from forecastZone URL
      const forecastZone = data.properties?.forecastZone;
      if (!forecastZone) {
        throw new Error('No forecastZone in API response');
      }

      const zone = forecastZone.split('/').pop();

      // Validate zone format
      if (!/^[A-Z]{2}[CZ]\d{3}$/.test(zone)) {
        throw new Error(`Invalid zone format: ${zone}`);
      }

      // Cache the result
      this._zoneCache.set(cacheKey, {
        zone: zone,
        timestamp: Date.now()
      });

      // Limit cache size (LRU eviction)
      if (this._zoneCache.size > ZONE_CACHE_MAX) {
        const firstKey = this._zoneCache.keys().next().value;
        this._zoneCache.delete(firstKey);
      }

      console.log(`NWS Alert Card: Resolved coordinates ${cacheKey} to zone ${zone}`);
      return zone;

    } catch (err) {
      console.error(`NWS Alert Card: Failed to fetch zone for ${lat},${lon}:`, err);
      return null;
    }
  }

  /**
   * Determine the active NWS zone based on config and device type.
   * Priority: mobile lat/lon > base lat/lon > nws_zone fallback.
   */
  async getActiveZone(config, hass) {
    const isMobile = this.isMobileDevice();

    // Determine which lat/lon to use based on device type
    let latConfig, lonConfig;
    if (isMobile && config.mobile_latitude !== undefined && config.mobile_longitude !== undefined) {
      latConfig = config.mobile_latitude;
      lonConfig = config.mobile_longitude;
      console.log('NWS Alert Card: Using mobile location configuration');
    } else if (config.latitude !== undefined && config.longitude !== undefined) {
      latConfig = config.latitude;
      lonConfig = config.longitude;
      console.log('NWS Alert Card: Using base location configuration');
    } else {
      // No lat/lon config found, fall back to nws_zone if present
      if (config.nws_zone) {
        console.log('NWS Alert Card: Using legacy nws_zone configuration');
        return config.nws_zone;
      }
      console.error('NWS Alert Card: No location configuration found');
      return null;
    }

    // Resolve coordinates
    const lat = this.resolveCoordinate(latConfig, 'latitude', hass);
    const lon = this.resolveCoordinate(lonConfig, 'longitude', hass);

    if (lat === null || lon === null) {
      // Coordinates failed to resolve, fall back to nws_zone if present
      if (config.nws_zone) {
        console.warn('NWS Alert Card: Coordinate resolution failed, falling back to nws_zone');
        return config.nws_zone;
      }
      console.error('NWS Alert Card: Unable to resolve coordinates and no nws_zone fallback');
      return null;
    }

    // Convert coordinates to zone
    return await this.fetchZoneFromCoordinates(lat, lon, config.email);
  }

  /**
   * Fetch the human-readable name for the current zone.
   * Calls NWS zones/forecast API and caches the result.
   */
  async fetchZoneName(email) {
    if (this._zoneName) return; // Already fetched

    const zone = this._currentZone;
    if (!zone) return;

    const url = `https://api.weather.gov/zones/forecast/${zone}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': `Home Assistant Custom Card / ${email}`,
          'Accept': 'application/geo+json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        console.warn(`Unable to fetch zone name: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.properties && data.properties.name) {
        this._zoneName = data.properties.name;
      }
    } catch (err) {
      console.warn('Zone name fetch error:', err);
      // Not critical, just skip showing zone name
    }
  }

  /**
   * Handle hass state updates: detect entity-based coordinate changes and
   * debounce zone re-resolution. Calls onZoneChange callback when zone changes.
   */
  handleHassUpdate(config, hass, onZoneChange) {
    // Only re-resolve if the currently active coordinate path uses an entity.
    // On desktop, mobile_latitude/longitude entities are not active, so skip.
    const isMobile = this.isMobileDevice();
    const hasActiveEntityCoords = isMobile
      ? (typeof config.mobile_latitude === 'string') || (typeof config.mobile_longitude === 'string')
      : (typeof config.latitude === 'string') || (typeof config.longitude === 'string');

    if (!hasActiveEntityCoords) return;

    // Debounce zone re-resolution
    if (!this._zoneResolveTimeout) {
      this._zoneResolveTimeout = setTimeout(async () => {
        const newZone = await this.getActiveZone(config, hass);
        if (newZone && newZone !== this._currentZone) {
          console.log(`NWS Alert Card: Zone changed from ${this._currentZone} to ${newZone}`);
          this._currentZone = newZone;
          this._zoneName = null;
          onZoneChange();
        }
        this._zoneResolveTimeout = null;
      }, ZONE_RESOLVE_DEBOUNCE);
    }
  }

  /**
   * Clear timers and reset state (called on disconnect).
   * Zone cache is intentionally preserved for session reuse.
   */
  cleanup() {
    if (this._zoneResolveTimeout) clearTimeout(this._zoneResolveTimeout);
    this._zoneResolveTimeout = null;
    this._zoneName = null;
    this._currentZone = null;
    this._isMobile = null;
    // Keep _zoneCache for session
  }
}

// ---------------------------------------------------------------------------
// Visual Editor
// ---------------------------------------------------------------------------

// Uses ha-textfield for text inputs, ha-switch for toggles, ha-selector for entity pickers

class NWSAlertCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    // Only render once initially, not on every config update from HA
    // This prevents destroying DOM elements and losing focus
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
    // Update all entity pickers with hass reference
    const selectors = this.shadowRoot?.querySelectorAll('ha-selector');
    if (selectors) {
      selectors.forEach(selector => {
        selector.hass = hass;
      });
    }
  }

  _fireConfigChanged() {
    const event = new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: this._config }
    });
    this.dispatchEvent(event);
  }

  _valueChanged(field, value) {
    if (value === '' || value === undefined || value === null) {
      const newConfig = { ...this._config };
      delete newConfig[field];
      this._config = newConfig;
    } else {
      this._config = { ...this._config, [field]: value };
    }
    this._fireConfigChanged();
  }

  _createTextfield(field, label, value, helperText, type = 'text') {
    const container = document.createElement('div');
    container.className = 'field';

    const textfield = document.createElement('ha-textfield');
    textfield.label = label;
    textfield.value = value ?? '';
    if (type === 'number') {
      textfield.type = 'number';
    }
    if (helperText) {
      textfield.helperPersistent = true;
      textfield.helper = helperText;
    }
    textfield.addEventListener('input', (e) => {
      const newValue = type === 'number' ?
        (e.target.value === '' ? undefined : Number(e.target.value)) :
        e.target.value;
      this._valueChanged(field, newValue);
    });

    container.appendChild(textfield);
    return container;
  }

  _createSwitch(field, label, checked, helperText) {
    const container = document.createElement('div');
    container.className = 'toggle-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const toggle = document.createElement('ha-switch');
    toggle.checked = checked || false;
    toggle.addEventListener('change', (e) => {
      this._valueChanged(field, e.target.checked);
    });

    container.appendChild(labelEl);
    container.appendChild(toggle);

    if (helperText) {
      const helper = document.createElement('div');
      helper.className = 'toggle-helper';
      helper.textContent = helperText;
      container.appendChild(helper);
    }

    return container;
  }

  _createEntityPicker(field, label, value, domainFilter) {
    const container = document.createElement('div');
    container.className = 'field';

    const selector = document.createElement('ha-selector');
    selector.hass = this._hass;

    // Configure selector based on domain filter
    if (domainFilter) {
      if (Array.isArray(domainFilter)) {
        selector.selector = { entity: { domain: domainFilter } };
      } else {
        selector.selector = { entity: { domain: domainFilter } };
      }
    } else {
      selector.selector = { entity: {} };
    }

    selector.value = value || '';
    selector.label = label;
    selector.addEventListener('value-changed', (e) => {
      this._valueChanged(field, e.detail.value);
    });

    container.appendChild(selector);
    return container;
  }

  _createExpansionPanel(header, content) {
    const panel = document.createElement('ha-expansion-panel');
    panel.header = header;
    panel.outlined = true;
    panel.appendChild(content);
    return panel;
  }

  render() {
    if (!this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        padding: 16px;
      }
      .field {
        display: block;
        margin-bottom: 16px;
      }
      .field ha-textfield,
      .field ha-selector {
        display: block;
        width: 100%;
      }
      ha-expansion-panel {
        display: block;
        margin-bottom: 8px;
      }
      .panel-content {
        padding: 12px;
      }
      .section-note {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-bottom: 12px;
        font-style: italic;
      }
      .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        flex-wrap: wrap;
      }
      .toggle-row label {
        font-size: 14px;
        color: var(--primary-text-color);
      }
      .toggle-helper {
        width: 100%;
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }
      h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 500;
      }
    `;

    const root = document.createElement('div');

    // Section 1: Basic Settings (always visible)
    const basicSection = document.createElement('div');
    basicSection.innerHTML = '<h3>Basic Settings</h3>';

    basicSection.appendChild(this._createTextfield('title', 'Card Title', this._config.title, 'Display title for the card'));
    basicSection.appendChild(this._createTextfield('email', 'Email Address', this._config.email, 'Required for NWS API (User-Agent header)'));

    root.appendChild(basicSection);

    // Section 2: Display Options
    const displayContent = document.createElement('div');
    displayContent.className = 'panel-content';

    displayContent.appendChild(this._createTextfield('update_interval', 'Update Interval', this._config.update_interval, 'Refresh interval in seconds (default: 300)', 'number'));
    displayContent.appendChild(this._createSwitch('show_severity_markers', 'Show Severity Markers', this._config.show_severity_markers !== false, 'Display danger markers for Extreme/Severe alerts'));
    displayContent.appendChild(this._createSwitch('show_expanded', 'Expand Alerts by Default', this._config.show_expanded, 'Show full alert descriptions by default'));

    root.appendChild(this._createExpansionPanel('Display Options', displayContent));

    // Section 2b: Font Sizes
    const fontContent = document.createElement('div');
    fontContent.className = 'panel-content';

    const fontNote = document.createElement('div');
    fontNote.className = 'section-note';
    fontNote.textContent = 'Customize font sizes in pixels (8-48). Leave empty for defaults.';
    fontContent.appendChild(fontNote);

    fontContent.appendChild(this._createTextfield('title_font_size', 'Card Title Font Size', this._config.title_font_size, 'Default: 20px', 'number'));
    fontContent.appendChild(this._createTextfield('alert_title_font_size', 'Alert Title Font Size', this._config.alert_title_font_size, 'Default: 16px', 'number'));
    fontContent.appendChild(this._createTextfield('meta_font_size', 'Metadata Font Size', this._config.meta_font_size, 'Time range and severity/urgency info. Default: 14px', 'number'));
    fontContent.appendChild(this._createTextfield('description_font_size', 'Description Font Size', this._config.description_font_size, 'Default: 14px', 'number'));

    root.appendChild(this._createExpansionPanel('Font Sizes', fontContent));

    // Section 2c: Text Colors
    const colorContent = document.createElement('div');
    colorContent.className = 'panel-content';

    const colorNote = document.createElement('div');
    colorNote.className = 'section-note';
    colorNote.textContent = 'Enter CSS colors (e.g., #ff0000, red, rgb(255,0,0)). Leave empty for defaults.';
    colorContent.appendChild(colorNote);

    colorContent.appendChild(this._createTextfield('title_color', 'Card Title Color', this._config.title_color, 'Default: inherit (theme primary text)'));
    colorContent.appendChild(this._createTextfield('zone_color', 'Zone Subtitle Color', this._config.zone_color, 'Default: secondary text color'));
    colorContent.appendChild(this._createTextfield('times_color', 'Time Range Color', this._config.times_color, 'Default: secondary text color'));
    colorContent.appendChild(this._createTextfield('meta_color', 'Metadata Color', this._config.meta_color, 'Severity/urgency/certainty. Default: secondary text color'));
    colorContent.appendChild(this._createTextfield('description_color', 'Description Color', this._config.description_color, 'Default: primary text color'));

    root.appendChild(this._createExpansionPanel('Text Colors', colorContent));

    // Section 3: Location Configuration
    const locationContent = document.createElement('div');
    locationContent.className = 'panel-content';

    const locationNote = document.createElement('div');
    locationNote.className = 'section-note';
    locationNote.textContent = 'Enter numeric coordinates OR a device_tracker entity ID with latitude/longitude attributes';
    locationContent.appendChild(locationNote);

    locationContent.appendChild(this._createTextfield('latitude', 'Latitude', this._config.latitude, 'Number (e.g., 47.6062) or entity ID (e.g., device_tracker.phone)'));
    locationContent.appendChild(this._createTextfield('longitude', 'Longitude', this._config.longitude, 'Number (e.g., -122.3321) or entity ID'));

    const mobileNote = document.createElement('div');
    mobileNote.className = 'section-note';
    mobileNote.style.marginTop = '16px';
    mobileNote.textContent = 'Mobile device override (optional) - uses these coordinates when viewed on mobile';
    locationContent.appendChild(mobileNote);

    locationContent.appendChild(this._createTextfield('mobile_latitude', 'Mobile Latitude', this._config.mobile_latitude, 'Typically a device_tracker entity for mobile location'));
    locationContent.appendChild(this._createTextfield('mobile_longitude', 'Mobile Longitude', this._config.mobile_longitude, 'Must be paired with mobile_latitude'));

    const zoneNote = document.createElement('div');
    zoneNote.className = 'section-note';
    zoneNote.style.marginTop = '16px';
    zoneNote.textContent = 'Fallback zone code (optional) - used if coordinate lookup fails';
    locationContent.appendChild(zoneNote);

    locationContent.appendChild(this._createTextfield('nws_zone', 'NWS Zone Code', this._config.nws_zone, 'Format: SSZNNN (e.g., WAZ558, COZ097)'));

    root.appendChild(this._createExpansionPanel('Location', locationContent));

    // Section 4: Alert Entity Integration
    const entityContent = document.createElement('div');
    entityContent.className = 'panel-content';

    const entityNote = document.createElement('div');
    entityNote.className = 'section-note';
    entityNote.textContent = 'Store current alerts in an input_text entity for use in automations and conditional cards';
    entityContent.appendChild(entityNote);

    entityContent.appendChild(this._createEntityPicker('alert_entity', 'Alert Entity', this._config.alert_entity, 'input_text'));

    root.appendChild(this._createExpansionPanel('Alert Entity Integration', entityContent));

    // Section 5: Action Triggers
    const actionContent = document.createElement('div');
    actionContent.className = 'panel-content';

    const actionNote = document.createElement('div');
    actionNote.className = 'section-note';
    actionNote.textContent = 'Trigger scripts or automations when alerts of specific severity levels appear';
    actionContent.appendChild(actionNote);

    actionContent.appendChild(this._createEntityPicker('minor_action', 'Minor Severity Action', this._config.minor_action, ['script', 'automation']));
    actionContent.appendChild(this._createEntityPicker('moderate_action', 'Moderate Severity Action', this._config.moderate_action, ['script', 'automation']));
    actionContent.appendChild(this._createEntityPicker('severe_action', 'Severe Severity Action', this._config.severe_action, ['script', 'automation']));
    actionContent.appendChild(this._createEntityPicker('extreme_action', 'Extreme Severity Action', this._config.extreme_action, ['script', 'automation']));

    actionContent.appendChild(this._createTextfield('alert_trigger_cooldown', 'Cooldown Period', this._config.alert_trigger_cooldown, 'Minutes between action triggers (0 = no cooldown, default: 60)', 'number'));

    root.appendChild(this._createExpansionPanel('Action Triggers', actionContent));

    // Clear and render
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(root);
  }
}

customElements.define('nws-alert-card-editor', NWSAlertCardEditor);

// ---------------------------------------------------------------------------
// Main Card Component
// ---------------------------------------------------------------------------

class NWSAlertCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._interval = null;
    this._lastAlertIds = new Set();
    this._expandedAlerts = new Set();
    this._collapsedAlerts = new Set();
    this._alertsCache = new Map();
    this._retryCount = 0;

    // Subsystem instances
    this._zoneResolver = new ZoneResolver();
    this._actionManager = new ActionManager();

    // Initialize styles and content element
    this.shadowRoot.appendChild(createStyleElement());
    this._content = document.createElement('ha-card');
    this.shadowRoot.appendChild(this._content);

    // Event delegation for toggles
    this._content.addEventListener('click', this._handleClick.bind(this));
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (oldHass !== hass) {
      this._zoneResolver.handleHassUpdate(this._config, hass, () => {
        this._fetchZoneNameAndRerender();
        this._fetchAlerts();
      });
    }
  }

  setConfig(config) {
    // Validate configuration - either nws_zone OR latitude/longitude must be provided
    const hasZone = config.nws_zone;
    const hasLatLon = config.latitude !== undefined && config.longitude !== undefined;

    if (!hasZone && !hasLatLon) {
      throw new Error("Either 'nws_zone' or both 'latitude' and 'longitude' are required in card configuration");
    }

    // Validate mobile config if provided (both must be present)
    if ((config.mobile_latitude !== undefined || config.mobile_longitude !== undefined) &&
        (config.mobile_latitude === undefined || config.mobile_longitude === undefined)) {
      console.warn("Both 'mobile_latitude' and 'mobile_longitude' must be provided together. Mobile override will be ignored.");
    }

    const sanitizedEmail = sanitizeEmail(config.email || 'homeassistant@example.com');

    this._config = {
      title: 'NWS Weather Alert',
      update_interval: 300,
      email: sanitizedEmail,
      show_severity_markers: true,
      show_expanded: false,
      alert_trigger_cooldown: 60,
      ...config
    };

    // Validate action entity IDs if provided
    const actionFields = ['minor_action', 'moderate_action', 'severe_action', 'extreme_action'];
    actionFields.forEach(field => {
      if (this._config[field]) {
        const entityId = this._config[field].trim();
        // Validate format: must be script.* or automation.*
        if (!entityId.match(/^(script|automation)\./)) {
          console.warn(`NWS Alert Card: '${field}' must be a script or automation entity ID (e.g., script.my_script). Got: ${entityId}`);
          delete this._config[field];
        }
      }
    });

    // Validate cooldown value
    if (typeof this._config.alert_trigger_cooldown !== 'number' || this._config.alert_trigger_cooldown < 0) {
      console.warn(`NWS Alert Card: 'alert_trigger_cooldown' must be a positive number. Got: ${this._config.alert_trigger_cooldown}. Using default: 60`);
      this._config.alert_trigger_cooldown = 60;
    }

    // Validate alert_entity if provided (must be input_text entity)
    if (this._config.alert_entity) {
      const entityId = this._config.alert_entity.trim();
      if (!entityId.match(/^input_text\./)) {
        console.warn(`NWS Alert Card: 'alert_entity' must be an input_text entity ID (e.g., input_text.nws_alert_types). Got: ${entityId}`);
        delete this._config.alert_entity;
      }
    }

    // Validate font size options (must be numbers between 8 and 48)
    const fontSizeFields = ['title_font_size', 'alert_title_font_size', 'meta_font_size', 'description_font_size'];
    fontSizeFields.forEach(field => {
      if (this._config[field] !== undefined) {
        const value = this._config[field];
        if (typeof value !== 'number' || value < 8 || value > 48) {
          console.warn(`NWS Alert Card: '${field}' must be a number between 8 and 48. Got: ${value}. Using default.`);
          delete this._config[field];
        }
      }
    });

    // Validate color options (must be non-empty strings)
    const colorFields = ['title_color', 'zone_color', 'times_color', 'meta_color', 'description_color'];
    colorFields.forEach(field => {
      if (this._config[field] !== undefined) {
        const value = this._config[field];
        if (typeof value !== 'string' || value.trim() === '') {
          console.warn(`NWS Alert Card: '${field}' must be a valid CSS color string. Got: ${value}. Using default.`);
          delete this._config[field];
        }
      }
    });

    // Apply font size and color styles if content element exists
    if (this._content) {
      applyFontSizeStyles(this._content, this._config);
      applyColorStyles(this._content, this._config);
    }

    this._clearAndSetInterval();
  }

  async connectedCallback() {
    // Force initial render
    this._renderContent(`<h2 class="card-title">${this._config.title || 'NWS Weather Alert'}</h2><div class="no-alerts">Loading...</div>`);

    // Resolve active zone
    this._zoneResolver.currentZone = await this._zoneResolver.getActiveZone(this._config, this._hass);

    if (!this._zoneResolver.currentZone) {
      this._renderContent(
        `<h2 class="card-title">${this._config.title}</h2>` +
        '<div class="error-message">Unable to determine NWS zone. Check configuration.</div>'
      );
      return;
    }

    this._fetchZoneNameAndRerender();
    this._clearAndSetInterval();
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;

    this._lastAlertIds.clear();
    this._expandedAlerts.clear();
    this._collapsedAlerts.clear();
    this._alertsCache.clear();

    this._zoneResolver.cleanup();
    this._actionManager.cleanup();
  }

  _clearAndSetInterval() {
    if (this._interval) clearInterval(this._interval);
    this._fetchAlerts();

    const intervalMs = this._config.update_interval * 1000;
    this._interval = setInterval(() => this._fetchAlerts(), intervalMs);
  }

  async _fetchZoneNameAndRerender() {
    await this._zoneResolver.fetchZoneName(this._config.email);
    // Re-render to show zone name if alerts are already displayed
    if (this._zoneResolver.zoneName) {
      const currentAlerts = Array.from(this._lastAlertIds)
        .map(id => this._alertsCache.get(id))
        .filter(Boolean);
      if (currentAlerts.length > 0 || this._lastAlertIds.size === 0) {
        this._renderAlerts(currentAlerts);
      }
    }
  }

  async _fetchAlerts() {
    const zone = this._zoneResolver.currentZone;

    if (!zone) {
      this._renderContent(
        `<h2 class="card-title">${this._config.title}</h2>` +
        '<div class="error-message">No active zone configured.</div>'
      );
      return;
    }

    const url = `https://api.weather.gov/alerts/active/zone/${zone}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': `Home Assistant Custom Card / ${this._config.email}`,
          'Accept': 'application/geo+json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Ensure features array exists
      const features = data.features || [];

      // Cache the alerts
      features.forEach(alert => {
        this._alertsCache.set(alert.id, alert);
      });

      // Always render on first fetch or when data changes
      const currentIds = new Set(features.map(f => f.id));
      const isFirstFetch = this._lastAlertIds.size === 0 && this._content.innerHTML.includes('Loading');

      if (isFirstFetch || !setsEqual(currentIds, this._lastAlertIds)) {
        // Check if action should trigger BEFORE updating state
        const triggerDecision = this._actionManager.shouldTriggerAction(features, this._lastAlertIds);

        // Update state
        this._lastAlertIds = currentIds;

        // Trigger action (non-blocking)
        if (triggerDecision.shouldTrigger && triggerDecision.severity) {
          this._actionManager.triggerSeverityAction(
            triggerDecision.severity, this._config, this._hass, this._zoneResolver.currentZone
          ).catch(() => {
            // Error already logged in triggerSeverityAction
          });
        }

        // Update severity tracking
        this._actionManager.updateMaxSeverity(features);

        // Update alert entity (if configured)
        updateAlertEntity(features, this._config, this._hass);

        // Render alerts
        this._renderAlerts(features);
      }

      // Reset retry count on success
      this._retryCount = 0;

    } catch (err) {
      console.error('NWS fetch error:', err);

      if (this._retryCount < MAX_RETRIES) {
        this._retryCount++;
        const delay = BASE_RETRY_DELAY * Math.pow(2, this._retryCount - 1);
        console.log(`Retrying in ${delay/1000}s (attempt ${this._retryCount}/${MAX_RETRIES})`);

        setTimeout(() => this._fetchAlerts(), delay);
      } else {
        this._renderContent(
          `<h2 class="card-title">${this._config.title}</h2>` +
          '<div class="error-message">Unable to fetch weather alerts. Check zone configuration.</div>'
        );
      }
    }
  }

  _renderAlerts(alerts) {
    let html = `<h2 class="card-title">${escapeHtml(this._config.title)}</h2>`;

    if (this._zoneResolver.zoneName) {
      html += `<div class="zone-subtitle">${escapeHtml(this._zoneResolver.zoneName)}</div>`;
    }

    if (!alerts || alerts.length === 0) {
      html += '<div class="no-alerts">No active alerts at this time</div>';
    } else {
      // Sort alerts by official NWS priority order
      const sortedAlerts = sortAlertsByPriority(alerts);
      sortedAlerts.forEach(alert => {
        const p = alert.properties;
        const alertId = alert.id;
        const severityClass = `severity-${p.severity || 'Unknown'}`;
        const defaultExpanded = this._config.show_expanded === true;
        const isExpanded = defaultExpanded
          ? !this._collapsedAlerts.has(alertId)
          : this._expandedAlerts.has(alertId);

        // Danger marker for severe alerts
        let dangerMarker = '';
        if (this._config.show_severity_markers !== false) {
          if (p.severity === 'Extreme') {
            dangerMarker = '<span class="danger-marker" aria-label="Extreme severity">🔴🔴🔴 </span>';
          } else if (p.severity === 'Severe') {
            dangerMarker = '<span class="danger-marker" aria-label="Severe severity">🟠🟠 </span>';
          }
        }

        const desc = p.description || 'No description available';
        const normalizedDesc = normalizeDescription(desc);

        html += `
          <div class="alert-item ${severityClass}" role="article" aria-labelledby="alert-${alertId}">
            <div class="alert-header">
              <h3 id="alert-${alertId}">
                ${dangerMarker}${escapeHtml(p.event || 'Unknown Event')}
              </h3>
              <span class="times" aria-label="Alert timeframe">
                ${formatTime(p.onset)} → ${formatTime(p.ends || p.expires)}
              </span>
            </div>
            <div class="alert-meta">
              <span><strong>Severity:</strong> ${escapeHtml(p.severity || 'N/A')}</span>
              <span><strong>Urgency:</strong> ${escapeHtml(p.urgency || 'N/A')}</span>
              ${p.certainty ? `<span><strong>Certainty:</strong> ${escapeHtml(p.certainty)}</span>` : ''}
            </div>
            ${isExpanded ? `
              <div class="description">
                ${escapeHtml(normalizedDesc)}
              </div>
              ${p.uri ? `<a href="${escapeHtml(p.uri)}" class="alert-link" target="_blank" rel="noopener noreferrer">Read full alert ↗</a>` : ''}
            ` : ''}
            <div class="toggle"
                 data-alert-id="${alertId}"
                 role="button"
                 tabindex="0"
                 aria-expanded="${isExpanded}"
                 aria-label="${isExpanded ? 'Show less' : 'Show more'}">
              ${isExpanded ? 'Show less ▲' : 'Show more ▼'}
            </div>
          </div>
        `;
      });
    }

    this._renderContent(html);
  }

  _handleClick(event) {
    const toggle = event.target.closest('.toggle');
    if (!toggle) return;

    const alertId = toggle.dataset.alertId;
    const defaultExpanded = this._config.show_expanded === true;

    if (defaultExpanded) {
      // When default is expanded, toggle collapsed state
      if (this._collapsedAlerts.has(alertId)) {
        this._collapsedAlerts.delete(alertId);
      } else {
        this._collapsedAlerts.add(alertId);
      }
    } else {
      // When default is collapsed, toggle expanded state
      if (this._expandedAlerts.has(alertId)) {
        this._expandedAlerts.delete(alertId);
      } else {
        this._expandedAlerts.add(alertId);
      }
    }

    // Re-render immediately with current data
    this._renderAlerts(Array.from(this._lastAlertIds).map(id => this._alertsCache.get(id)).filter(Boolean));
  }

  _renderContent(html) {
    this._content.innerHTML = html;
  }

  getCardSize() {
    // Dynamic sizing based on alert count
    const alertCount = this._lastAlertIds.size;
    return alertCount === 0 ? 2 : Math.min(2 + alertCount, 8);
  }

  static getConfigElement() {
    return document.createElement('nws-alert-card-editor');
  }

  static getStubConfig() {
    // Minimal config shown when adding a new card via the UI.
    // Only include required fields - avoid placeholder coordinates that
    // would trigger real API calls and potentially fire action scripts.
    return {
      nws_zone: 'KSZ007',
      email: 'homeassistant@example.com',
      title: 'NWS Weather Alert'
    };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

customElements.define('nws-alert-card', NWSAlertCard);

console.info(
  '%c NWS-ALERT-CARD %c v2.7.2 ',
  'color: black; background: #F2720C; font-weight: 600;',
  'color: black; background: #00a5c9; font-weight: 600;'
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nws-alert-card',
  name: 'NWS Alert Card',
  description: 'Displays active NWS weather alerts with severity colors and expandable descriptions',
  preview: true,
  documentationURL: 'https://github.com/sxdjt/ha-nws-alert-card'
});
