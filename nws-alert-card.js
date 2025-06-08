class NWSAlertCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {}; // Initialize config
    this._interval = null; // To store our polling interval ID

    // Basic styling for the card
    const style = document.createElement("style");
    style.textContent = `
      .card {
        padding: 16px;
        display: block;
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius, 8px);
        box-shadow: var(--ha-card-box-shadow, 0px 2px 4px 0px rgba(0,0,0,0.16));
        color: var(--primary-text-color);
      }
      .alert-item {
        margin-bottom: 10px;
        border-bottom: 1px solid var(--divider-color);
        padding-bottom: 10px;
      }
      .alert-item:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }
      h2 {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 20px;
        font-weight: normal;
        color: var(--primary-text-color);
      }
      p {
        margin: 0 0 8px 0;
        color: var(--primary-text-color);
      }
      b {
        font-weight: bold;
      }
      .message {
        text-align: center;
        padding: 10px 0;
        color: var(--secondary-text-color);
      }
      .error-message {
        color: var(--error-color, red);
        font-weight: bold;
      }
    `;
    this.shadowRoot.appendChild(style);

    // Create a div to hold the card's content
    this._content = document.createElement("div");
    this._content.classList.add("card");
    this.shadowRoot.appendChild(this._content);
  }

  // Called when the card's configuration changes in Lovelace
  setConfig(config) {
    if (!config.nws_zone) {
      throw new Error("You need to define 'nws_zone' in the card configuration.");
    }
    // Set a default email if not provided, as NWS API requests a User-Agent.
    // Advise users to use their own email for best practice.
    if (!config.email) {
      console.warn("NWS Alert Card: 'email' not provided in card configuration. Using a generic default. Please add your email for NWS API requests.");
    }

    this._config = {
      title: 'NWS Weather Alert',
      update_interval: 300, // Default to 5 minutes (300 seconds)
      email: 'homeassistant_user@example.com', // Generic default email
      ...config // Merge user config, overriding defaults
    };

    // Re-fetch data and set up interval if config changes
    this._clearAndSetInterval();
  }

  // Called when the card is added to the DOM (when visible in dashboard)
  connectedCallback() {
    this._clearAndSetInterval();
  }

  // Called when the card is removed from the DOM (e.g., changing dashboards)
  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // Utility to clear existing interval and set a new one
  _clearAndSetInterval() {
    if (this._interval) {
      clearInterval(this._interval);
    }
    // Fetch data immediately when connected or config changes
    this._fetchAlerts();
    // Set up polling interval
    this._interval = setInterval(() => this._fetchAlerts(), this._config.update_interval * 1000);
  }

  async _fetchAlerts() {
    const zone = this._config.nws_zone;
    const url = `https://api.weather.gov/alerts/active/zone/${zone}`;
    const email = this._config.email; // Get email from config

    // Display a loading message while fetching
    this._renderContent('<div class="message">Loading NWS alerts...</div>');

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': `Home Assistant Custom Card / ${email}` // Use the configurable email
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this._renderAlerts(data);

    } catch (error) {
      console.error("Error fetching NWS alerts:", error);
      this._renderContent('<div class="message error-message">** NO DATA ** (API Error)</div>');
    }
  }

  // Helper function to format ISO 8601 strings to local time
  _formatTime(isoString) {
    if (!isoString) {
      return 'N/A';
    }
    try {
      const date = new Date(isoString);
      // Format to local time with date, time, and timezone abbreviation
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        hour12: true // Use 12-hour format with AM/PM
      });
    } catch (e) {
      console.warn("Could not parse date string:", isoString, e);
      return 'Invalid Date';
    }
  }

  _renderAlerts(data) {
    const alerts = data.features;
    let html = `<h2>${this._config.title}</h2>`;

    if (alerts && alerts.length > 0) {
      alerts.forEach(alert => {
        const properties = alert.properties;
        html += `<div class="alert-item">`;
        html += `<p><b>Event:</b> ${properties.event || 'N/A'}</p>`;
        html += `<p><b>Severity:</b> ${properties.severity || 'N/A'}</p>`;
        html += `<p><b>Certainty:</b> ${properties.certainty || 'N/A'}</p>`;
        html += `<p><b>Urgency:</b> ${properties.urgency || 'N/A'}</p>`;
        html += `<p><b>Onset:</b> ${this._formatTime(properties.onset)}</p>`;
        html += `<p><b>Expires:</b> ${this._formatTime(properties.expires)}</p>`;
        if (properties.ends) { // 'ends' is optional and might not always be present
          html += `<p><b>Ends:</b> ${this._formatTime(properties.ends)}</p>`;
        }
        html += `<p><b>Description:</b> ${properties.description || 'N/A'}</p>`;
        if (properties.NWSheadline) {
          html += `<p><b>NWS Headline:</b> ${properties.NWSheadline}</p>`;
        }
        html += `</div>`;
      });
    } else {
      html += '<div class="message">No alerts at this time.</div>';
    }
    this._renderContent(html);
  }

  // Helper to update the inner HTML of the content div
  _renderContent(html) {
    this._content.innerHTML = html;
  }

  // Define the card's dimensions (optional, but good practice)
  getCardSize() {
    // This is an estimate; actual size depends on content.
    // 1 unit typically is about 50px.
    return 3;
  }
}

// Register your custom element with a unique tag name
customElements.define('nws-alert-card', NWSAlertCard);

// Make it discoverable by the Lovelace UI editor
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nws-alert-card',
  name: 'NWS Alert Card (Standalone)',
  description: 'Displays active NWS weather alerts for a specified zone, fetching data directly.',
  defaultConfig: {
    nws_zone: 'WAZ308', // Default zone for easier setup
    title: 'Current Weather Alerts',
    update_interval: 300, // Default to 5 minutes
    email: 'homeassistant_user@example.com', // Default email for User-Agent
  },
});