class NWSAlertCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._interval = null;
    this._lastResponseHash = null;

    const style = document.createElement("style");
    style.textContent = `
      ha-card {
        padding: 16px;
        display: block;
      }
      .alert-item {
        margin-bottom: 12px;
        border-left: 4px solid var(--divider-color);
        padding-left: 10px;
      }
      .alert-item:last-child {
        margin-bottom: 0;
      }
      .severity-Extreme { border-color: red; }
      .severity-Severe { border-color: orange; }
      .severity-Moderate { border-color: gold; }
      .severity-Minor { border-color: green; }
      .alert-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .alert-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .times {
        font-size: 0.9em;
        color: var(--secondary-text-color);
      }
      .description {
        margin-top: 8px;
        color: var(--primary-text-color);
      }
      .toggle {
        color: var(--primary-color);
        cursor: pointer;
        font-size: 0.85em;
        user-select: none;
      }
      .error-message {
        color: var(--error-color, red);
        font-weight: bold;
        text-align: center;
      }
      a {
        font-size: 0.85em;
        text-decoration: underline;
        color: var(--primary-color);
      }
    `;
    this.shadowRoot.appendChild(style);

    this._content = document.createElement("ha-card");
    this.shadowRoot.appendChild(this._content);
  }

  setConfig(config) {
    if (!config.nws_zone) {
      throw new Error("You need to define 'nws_zone' in the card configuration.");
    }
    if (!config.email) {
      console.warn("NWS Alert Card: 'email' not provided; using default placeholder.");
    }

    this._config = {
      title: 'NWS Weather Alert',
      update_interval: 300,
      email: 'homeassistant_user@example.com',
      ...config
    };
    this._clearAndSetInterval();
  }

  connectedCallback() {
    this._clearAndSetInterval();
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this._lastResponseHash = null;
  }

  _clearAndSetInterval() {
    if (this._interval) clearInterval(this._interval);
    this._fetchAlerts();
    this._interval = setInterval(() => this._fetchAlerts(), this._config.update_interval * 1000);
  }

  async _fetchAlerts() {
    const zone = this._config.nws_zone;
    const url = `https://api.weather.gov/alerts/active/zone/${zone}`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': `Home Assistant Custom Card / ${this._config.email}` }
      });

      if (!response.ok) {
        this._renderContent(`<div class="error-message">⚠ Weather.gov API error (${response.status})</div>`);
        return;
      }

      const data = await response.json();
      const hash = JSON.stringify(data.features.map(f => f.id));

      if (hash !== this._lastResponseHash) {
        this._lastResponseHash = hash;
        this._renderAlerts(data.features);
      }
    } catch (err) {
      console.error("NWS fetch error:", err);
      this._renderContent('<div class="error-message">⚠ Unable to fetch weather alerts</div>');
    }
  }

  _formatTime(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short', hour12: true
    });
  }

  _renderAlerts(alerts) {
    let html = `<h2>${this._config.title}</h2>`;

    if (!alerts || alerts.length === 0) {
      html += '<div>No alerts at this time.</div>';
    } else {
      alerts.forEach(alert => {
        const p = alert.properties;
        const severityClass = `severity-${p.severity || 'Unknown'}`;
        
        // Add  marker for Severe and Extreme
        const dangerMarker = (p.severity === 'Severe' || p.severity === 'Extreme') ? '🟥🟥🟥 ' : '';
        
        const desc = p.description || 'No description';
        const shortened = desc.length > 200 ? desc.slice(0, 200) + '…' : desc;

        html += `
          <div class="alert-item ${severityClass}">
            <div class="alert-header">
              <h3>${dangerMarker}${p.event || 'Unknown Event'}</h3>
              <span class="times">${this._formatTime(p.onset)} → ${this._formatTime(p.expires)}</span>
            </div>
            <div><b>Severity:</b> ${p.severity || 'N/A'} | <b>Urgency:</b> ${p.urgency || 'N/A'}</div>
            <div class="description" data-full="${encodeURIComponent(desc)}">
              ${shortened}
              ${desc.length > 200 ? `<div class="toggle">Show more</div>` : ''}
            </div>
            ${p.uri ? `<a href="${p.uri}" target="_blank">Read full alert</a>` : ''}
          </div>
        `;
      });
    }

    this._renderContent(html);
    this._attachToggleHandlers();
  }

  _attachToggleHandlers() {
    this._content.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const descDiv = toggle.parentElement;
        const fullText = decodeURIComponent(descDiv.dataset.full);
        if (toggle.textContent === 'Show more') {
          descDiv.firstChild.textContent = fullText;
          toggle.textContent = 'Show less';
        } else {
          descDiv.firstChild.textContent = fullText.slice(0, 200) + '…';
          toggle.textContent = 'Show more';
        }
      });
    });
  }

  _renderContent(html) {
    this._content.innerHTML = html;
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('nws-alert-card', NWSAlertCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nws-alert-card',
  name: 'NWS Alert Card',
  description: 'Displays active NWS weather alerts with severity colors, 🟥 markers for dangerous alerts, and expandable descriptions.',
});

