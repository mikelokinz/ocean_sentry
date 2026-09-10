# Telegram Fisherman Guide

## Supported Interactions

### Commands (Text)
| Command | Action |
|---------|--------|
| `/start` | Welcome menu |
| `/help` | Help and commands |
| `/fish` | Fishing suitability at stored location |
| `/sea` | Sea conditions at stored location |
| `/zone` | Recommended fishing zone |
| `/alerts` | Coastal alert check |
| `/subscribe` | Subscribe to periodic alerts |
| `/unsubscribe` | Stop alerts |

### Natural Language (Text or Voice)
| Query | Intent |
|-------|--------|
| "Is it good to fish here?" | Fishing intelligence |
| "Where should I fish?" | Zone recommendation |
| "How is the sea?" | Sea conditions |
| "Is it safe to go out?" | Coastal alerts |
| "Alert me about danger" | Subscribe |
| "Stop alerts" | Unsubscribe |

### Location Sharing
Share your GPS location → immediate full intelligence report.

Your location is stored. Subsequent text queries use it automatically.

### Voice Messages
Record a voice message in any supported language (English, Tamil, Telugu, Hindi, Bengali).

The system transcribes it and routes to the appropriate intent.

## Example Conversations

### Location Share
```
User: [shares GPS location]
Bot:
📍 OCEAN SENTRY — LOCATION RECEIVED
12.7900° N, 80.8520° E

🎣 Fishing Suitability: 🟡 MODERATE
Score: 63%

🌡 SST: 29.69°C
🌊 Current: 0.485 m/s
🧂 Salinity: 33.45 PSU
🟢 Chlorophyll: unavailable
🌊 Wave Height: unavailable

🌊 Sea Condition: CALM
⚠️ 20 ocean anomalies detected nearby

📌 Recommended Zone:
11.58° N, 81.09° E
~137 km away | HIGH
Reason: optimal SST (29.7°C), calm currents (0.14 m/s), no anomalies detected

📊 Analysis:
• SST 29.69°C within optimal range (26.0-30.0°C)
• Current speed 0.485 m/s — favorable for fishing
• 1 location(s) with WARNING anomaly activity — moderate anomaly activity noted

🕐 Data: Copernicus Marine + Argo (180h ago)
```

### Sea Conditions
```
User: How is the sea?
Bot:
🌊 OCEAN SENTRY — SEA CONDITIONS

📍 12.7900° N, 80.8520° E

🌡 SST: 29.69°C
🧂 Salinity: 33.45 PSU
💨 Current Speed: 0.485 m/s
🧭 Direction: 351.3°
🌊 Wave Height: unavailable

🌊 Overall: CALM
⚠️ Anomalies: 20 detected

📡 Copernicus Marine + Argo (180h ago)
```

### Zone Recommendation
```
User: Where should I fish?
Bot:
📌 OCEAN SENTRY — RECOMMENDED ZONE

📍 Recommended: 11.5838° N, 81.0865° E
📏 Distance: ~137 km from your location
🎯 Suitability: 🟢 HIGH (92%)
💡 Reason: optimal SST (29.7°C), calm currents (0.14 m/s), no anomalies detected

📍 Your location: MODERATE
```

## Data Coverage

Current data covers the **Bay of Bengal** region:
- Latitude: 5.4°N to 18.1°N
- Longitude: 80.8°E to 92.2°E

Locations outside this region will return "insufficient_data".

## Important Notes

- This is an **environmental suitability assessment**, NOT a fish prediction
- Data may be hours old — check the freshness indicator
- Chlorophyll and wave height are not yet available
- Coastal alerts use ML anomaly detection, not official advisories
- Always follow local maritime safety guidelines
