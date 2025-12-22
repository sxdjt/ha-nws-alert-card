/* Last modified: 22-Dec-2025 01:19 */
class NWSAlertCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._interval = null;
    this._lastAlertIds = new Set();
    this._expandedAlerts = new Set();
    this._alertsCache = new Map();
    this._retryCount = 0;
    this._zoneName = null;
    
    // Constants
    this.MAX_RETRIES = 3;
    this.BASE_RETRY_DELAY = 5000;
    this.DESCRIPTION_THRESHOLD = 200;
    
    this._initializeStyles();
    this._content = document.createElement('ha-card');
    this.shadowRoot.appendChild(this._content);
    
    // Event delegation for toggles
    this._content.addEventListener('click', this._handleClick.bind(this));
  }

  _initializeStyles() {
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
        font-size: 16px;
        line-height: 1.4;
      }
      .alert-meta {
        display: flex;
        gap: 12px;
        margin: 4px 0;
        font-size: 0.9em;
        color: var(--secondary-text-color);
      }
      .times {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }
      .description {
        margin-top: 8px;
        color: var(--primary-text-color);
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
        font-size: 20px;
      }
      .zone-subtitle {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        margin: -8px 0 12px 0;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  setConfig(config) {
    if (!config.nws_zone) {
      throw new Error("'nws_zone' is required in card configuration");
    }
    
    // Validate zone format (basic check)
    if (!/^[A-Z]{2}[CZ]\d{3}$/.test(config.nws_zone)) {
      console.warn(`NWS Alert Card: '${config.nws_zone}' may not be a valid zone format (expected: SSZNNN or SSCNNN)`);
    }
    
    const sanitizedEmail = this._sanitizeEmail(config.email || 'homeassistant@example.com');

    this._config = {
      title: 'NWS Weather Alert',
      update_interval: 300,
      email: sanitizedEmail,
      show_severity_markers: true,
      ...config
    };
    
    this._clearAndSetInterval();
  }

  _sanitizeEmail(email) {
    // Basic email validation and sanitization
    const cleaned = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(cleaned)) {
      console.warn('NWS Alert Card: Invalid email format, using default');
      return 'homeassistant@example.com';
    }
    
    return cleaned;
  }

  connectedCallback() {
    // Force initial render
    this._renderContent(`<h2 class="card-title">${this._config.title || 'NWS Weather Alert'}</h2><div class="no-alerts">Loading...</div>`);
    this._fetchZoneName();
    this._clearAndSetInterval();
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this._lastAlertIds.clear();
    this._expandedAlerts.clear();
    this._alertsCache.clear();
    this._zoneName = null;
  }

  _clearAndSetInterval() {
    if (this._interval) clearInterval(this._interval);
    this._fetchAlerts();
    
    const intervalMs = this._config.update_interval * 1000;
    this._interval = setInterval(() => this._fetchAlerts(), intervalMs);
  }

  async _fetchAlerts() {
    const zone = this._config.nws_zone;
    const url = `https://api.weather.gov/alerts/active/zone/${zone}`;
    
    try {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': `Home Assistant Custom Card / ${this._config.email}`,
          'Accept': 'application/geo+json'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
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
      
      if (isFirstFetch || !this._setsEqual(currentIds, this._lastAlertIds)) {
        this._lastAlertIds = currentIds;
        this._renderAlerts(features);
      }
      
      // Reset retry count on success
      this._retryCount = 0;
      
    } catch (err) {
      console.error('NWS fetch error:', err);
      
      if (this._retryCount < this.MAX_RETRIES) {
        this._retryCount++;
        const delay = this.BASE_RETRY_DELAY * Math.pow(2, this._retryCount - 1);
        console.log(`Retrying in ${delay/1000}s (attempt ${this._retryCount}/${this.MAX_RETRIES})`);
        
        setTimeout(() => this._fetchAlerts(), delay);
      } else {
        this._renderContent(
          `<h2 class="card-title">${this._config.title}</h2>` +
          '<div class="error-message">⚠ Unable to fetch weather alerts. Check zone configuration.</div>'
        );
      }
    }
  }

  async _fetchZoneName() {
    if (this._zoneName) return; // Already fetched

    const zone = this._config.nws_zone;
    if (!zone) return;

    const url = `https://api.weather.gov/zones/forecast/${zone}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': `Home Assistant Custom Card / ${this._config.email}`,
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
        // Re-render to show zone name
        const currentAlerts = Array.from(this._lastAlertIds).map(id => this._alertsCache.get(id)).filter(Boolean);
        if (currentAlerts.length > 0 || this._lastAlertIds.size === 0) {
          this._renderAlerts(currentAlerts);
        }
      }
    } catch (err) {
      console.warn('Zone name fetch error:', err);
      // Not critical, just skip showing zone name
    }
  }

  _setsEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  _formatTime(isoString) {
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

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _normalizeDescription(text) {
    // Convert NWS hard line breaks to natural flowing text
    // Split on double line breaks (paragraph separators), then within each
    // paragraph replace single line breaks with spaces for natural wrapping
    return text
      .trim()
      // Normalize line endings to \n
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Split on double (or more) line breaks to identify paragraphs
      .split(/\n\s*\n/)
      // Process each paragraph
      .map(paragraph => {
        // Replace single line breaks with spaces
        return paragraph
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join(' ')
          .trim();
      })
      // Filter out any empty paragraphs
      .filter(paragraph => paragraph.length > 0)
      // Rejoin with double line breaks for paragraph separation
      .join('\n\n');
  }

  _renderAlerts(alerts) {
    let html = `<h2 class="card-title">${this._escapeHtml(this._config.title)}</h2>`;

    if (this._zoneName) {
      html += `<div class="zone-subtitle">${this._escapeHtml(this._zoneName)}</div>`;
    }

    if (!alerts || alerts.length === 0) {
      html += '<div class="no-alerts">✓ No active alerts at this time</div>';
    } else {
      alerts.forEach(alert => {
        const p = alert.properties;
        const alertId = alert.id;
        const severityClass = `severity-${p.severity || 'Unknown'}`;
        const isExpanded = this._expandedAlerts.has(alertId);
        
        // Danger marker for severe alerts
        let dangerMarker = '';
        if (this._config.show_severity_markers !== false) {
          if (p.severity === 'Extreme') {
            dangerMarker = '<span class="danger-marker" aria-label="Extreme severity">🔴🔴🔴</span>';
          } else if (p.severity === 'Severe') {
            dangerMarker = '<span class="danger-marker" aria-label="Severe severity">🟠🟠</span>';
          }
        }
        
        const desc = p.description || 'No description available';
        const normalizedDesc = this._normalizeDescription(desc);

        html += `
          <div class="alert-item ${severityClass}" role="article" aria-labelledby="alert-${alertId}">
            <div class="alert-header">
              <h3 id="alert-${alertId}">
                ${dangerMarker}${this._escapeHtml(p.event || 'Unknown Event')}
              </h3>
              <span class="times" aria-label="Alert timeframe">
                ${this._formatTime(p.onset)} → ${this._formatTime(p.expires)}
              </span>
            </div>
            <div class="alert-meta">
              <span><strong>Severity:</strong> ${this._escapeHtml(p.severity || 'N/A')}</span>
              <span><strong>Urgency:</strong> ${this._escapeHtml(p.urgency || 'N/A')}</span>
              ${p.certainty ? `<span><strong>Certainty:</strong> ${this._escapeHtml(p.certainty)}</span>` : ''}
            </div>
            ${isExpanded ? `
              <div class="description">
                ${this._escapeHtml(normalizedDesc)}
              </div>
              ${p.uri ? `<a href="${this._escapeHtml(p.uri)}" class="alert-link" target="_blank" rel="noopener noreferrer">Read full alert ↗</a>` : ''}
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
    
    if (this._expandedAlerts.has(alertId)) {
      this._expandedAlerts.delete(alertId);
    } else {
      this._expandedAlerts.add(alertId);
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
    // Could implement visual config editor here
    return document.createElement('div');
  }

  static getStubConfig() {
    return {
      nws_zone: 'WAZ558',
      email: 'homeassistant@example.com',
      title: 'NWS Weather Alert',
      update_interval: 300,
      show_severity_markers: true
    };
  }
}

customElements.define('nws-alert-card', NWSAlertCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nws-alert-card',
  name: 'NWS Alert Card',
  description: 'Displays active NWS weather alerts with severity colors and expandable descriptions',
  preview: true,
  documentationURL: 'https://github.com/sxdjt/ha-nws-alert-card'
});
