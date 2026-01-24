# Handling and Displaying NWS Alerts

The card has the ability to collect NWS alert types so you can create automations and other Home Assistant-related actions based on them.  Alerts are things like "Winter Storm Warning" or "High Surf Advisory".  A full list can be found [on the NWS site](https://www.weather.gov/help-map/).

This is done by creating a custom entity, e.g. `nws_alert_types`, configuring the card to read that entity, and then using a custom template sensor (`nws_alerts_sensor`) to parse and return the data.

Note that this is different from the `*_action` configuration options.  Those actions can be used directly from the card whereas `nws_alerts_sensor` can be used anywhere in Home Assistant.

## Setup - _You must do this before the feature will work_

**Step 1: Create an input_text helper**

Via UI: Settings -> Devices & Services -> Helpers -> Create Helper -> Text
- Name: `NWS Alert Types`
- Entity ID: `input_text.nws_alert_types`
- Max length: 255

Or via YAML:
```yaml
input_text:
  nws_alert_types:
    name: NWS Alert Types
    max: 255
```

**Step 2: Configure the card**

```yaml
type: custom:nws-alert-card
nws_zone: AKZ844
email: your-email@example.com
alert_entity: input_text.nws_alert_types
```

**Step 3: Create a template sensor**

```yaml
template:
  - sensor:
      name: NWS Alerts
      unique_id: nws_alerts_sensor
      state: >
        {% set raw = states('input_text.nws_alert_types') %}
        {{ 'clear' if raw == '' else raw.split(',')[0].split(':')[0] }}
      attributes:
        count: >
          {% set raw = states('input_text.nws_alert_types') %}
          {{ 0 if raw == '' else raw.split(',') | length }}
        highest_severity: >
          {% set raw = states('input_text.nws_alert_types') %}
          {{ none if raw == '' else raw.split(',')[0].split(':')[1] }}
        all_types: >
          {% set raw = states('input_text.nws_alert_types') %}
          {% if raw == '' %}
            {{ [] }}
          {% else %}
            {{ raw.split(',') | map('regex_replace', ':.*', '') | list }}
          {% endif %}
```

## Data Format

The input_text stores alerts as comma-separated `EventType:Severity` pairs, ordered by NWS priority:

```
Winter Storm Warning:Moderate,Wind Advisory:Minor,Frost Advisory:Minor
```

When no alerts are active, the value is empty; `""`.

## Example: Automation (Specific Alert Type)

Trigger an action when a Winter Storm Warning is active:

```yaml
automation:
  - alias: "Winter Storm Warning In Effect"
    triggers:
      - trigger: state
        entity_id: input_text.nws_alert_types
    conditions:
      - condition: template
        value_template: >
          {{ 'Winter Storm Warning' in states('input_text.nws_alert_types') }}
    actions:
      - action: light.turn_on
        target:
          entity_id: light.warning_light
```

## Example: Persistent Notification (Any Alert)

Show a persistent notification when any NWS alert is active:

```yaml
alias: NWS Alert In Effect
triggers:
  - trigger: state
    entity_id: input_text.nws_alert_types
conditions:
  - condition: template
    value_template: "{{ states('input_text.nws_alert_types') != '' }}"
actions:
  - action: persistent_notification.create
    data:
      title: "NWS Weather Alert"
      message: >
        {% set raw = states('input_text.nws_alert_types') %}
        {% set alerts = raw.split(',') %}
        {% if alerts | length == 1 %}
          {{ alerts[0].split(':')[0] }} ({{ alerts[0].split(':')[1] }})
        {% else %}
          {{ alerts | length }} alerts in effect:
          {% for alert in alerts %}
          - {{ alert.split(':')[0] }} ({{ alert.split(':')[1] }})
          {% endfor %}
        {% endif %}
      notification_id: nws_alert_active
```

## Example: Clear Notification When Alerts Expire (Recommended)

Dismiss the notification when all alerts have cleared:

```yaml
alias: NWS Alert Cleared
triggers:
  - trigger: state
    entity_id: input_text.nws_alert_types
    to: ""
actions:
  - action: persistent_notification.dismiss
    data:
      notification_id: nws_alert_active
```

## Example: Conditional Card

Show a card only when alerts are active:

```yaml
type: conditional
conditions:
  - entity: input_text.nws_alert_types
    state_not: ""
card:
  type: markdown
  content: |
    ## Active Weather Alert
    {% set raw = states('input_text.nws_alert_types') %}
    {% for alert in raw.split(',') %}
    **{{ alert.split(':')[0] }}** ({{ alert.split(':')[1] }})
    {% endfor %}

```

#### Limitations

- **Data only updates when the dashboard with the card is open**
- input_text has a 255 character limit (~8 concurrent alerts)
- ⛔️ Do not rely on this card or function for critical alerts.  Always consult the National Weather service or other competent weather authority
