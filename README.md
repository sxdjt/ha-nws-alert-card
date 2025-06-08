# ha-nws-alert-card
A simple card to show US National Weather Service alerts for a given zone

# NWS Zones

To find your NWS zone, go to https://www.weather.gov/pimar/PubZone and view state you wish to search.  Zones are 3 digit numbers and can be used to configure the card.

The zone name format is ```ssZnnn``` where:

```ss``` = the 2-letter state abbreviation, e.g. ```AK``` or ```NY```

```nnn``` = the 3-digit zone number, e.g. ```001``` or ```329```

The zone ID for Fairbanks, Alaska is ```AKZ844```. The zone ID for Las Vegas, Nevada is ```NVZ020```

You can also use lat/long coordinates to determine the zone ID.  

Example:  https://api.weather.gov/points/37.731,-102.9303

The ```forecastZone:``` lists a URL, of which the zone ID is the last component, i.e. ```COZ097```

---
<img width="526" alt="Screenshot 2025-06-08 at 01 07 09" src="https://github.com/user-attachments/assets/a6f389c9-5619-43d3-adfd-b96e71625a40" />
