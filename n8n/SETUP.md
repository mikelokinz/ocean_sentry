# Ocean Sentry — n8n + Telegram Setup

## Architecture

```
Fisherman (Telegram)
       ↓
   Telegram Bot API
       ↓
   n8n (Docker)
       ↓
   Ocean Sentry FastAPI (localhost:8000)
       ↓
   Copernicus + Argo + ML
       ↓
   Response → n8n → Telegram → Fisherman
```

## Prerequisites

- Docker installed
- Ocean Sentry backend running on port 8000
- Telegram Bot token from @BotFather
- (Optional) Google Gemini API key for voice transcription

## Step 1: Create Telegram Bot

1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Choose a name: `Ocean Sentry Fisherman`
4. Choose a username: `ocean_sentry_fish_bot` (must end in `bot`)
5. Copy the HTTP API token

## Step 2: Configure Environment

```bash
cd ocean-sentry/n8n
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=<your-token-from-botfather>
N8N_BASIC_AUTH_PASSWORD=<pick-a-password>
GEMINI_API_KEY=<your-gemini-api-key>   # optional, for voice messages
```

## Step 3: Start n8n

```bash
docker compose up -d
```

n8n UI: http://localhost:5678

Login: `admin` / your chosen password

## Step 4: Import Workflows

1. Open n8n → Workflows → Import from File
2. Import `workflows/telegram_fishing_intelligence.json`
3. Import `workflows/scheduled_alerts.json`

## Step 5: Configure Credentials

In n8n UI:
1. Settings → Credentials → Add Credential
2. Type: **Telegram API**
3. Name: `Ocean Sentry Bot`
4. Access Token: paste your bot token
5. Save

## Step 6: Verify Environment Variables

In n8n UI: Settings → Variables (or check workflow uses `$env.*`):
- `OCEAN_SENTRY_API_URL` = `http://host.docker.internal:8000`
- `TELEGRAM_BOT_TOKEN` = your bot token
- `GEMINI_API_KEY` = your Gemini key (for voice)

These are already passed from Docker env in the compose file.

## Step 7: Activate Workflows

1. Open "Ocean Sentry - Telegram Fisherman Assistant"
2. Toggle **Active** → ON
3. Open "Ocean Sentry - Scheduled Regional Alerts"
4. Toggle **Active** → ON

## Step 8: Test

Send `/start` to your bot in Telegram.

## Network Architecture (Docker ↔ Host)

```
┌─────────────────────────────┐
│  Docker (n8n)               │
│  http://host.docker.internal│ → Host machine port 8000
│  :8000                      │
└─────────────────────────────┘
         ↕
┌─────────────────────────────┐
│  Host (macOS/Linux)         │
│  Backend: localhost:8000    │
│  Frontend: localhost:5173   │
└─────────────────────────────┘
```

The `extra_hosts` in docker-compose maps `host.docker.internal` → host gateway.

## Commands

```bash
# Start everything
cd ocean-sentry/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
cd ocean-sentry/n8n && docker compose up -d

# Check n8n logs
docker compose logs -f n8n

# Restart n8n
docker compose restart

# Stop
docker compose down
```

## Troubleshooting

See `TROUBLESHOOTING.md`
