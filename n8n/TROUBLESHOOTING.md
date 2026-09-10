# Troubleshooting

## Bot Not Responding

1. **Check workflow is active** — n8n UI → workflow → toggle must be ON
2. **Check Telegram credential** — Settings → Credentials → verify token
3. **Check n8n logs**: `docker compose logs -f n8n`
4. **Webhook registered?** — When workflow activates, n8n registers with Telegram automatically

## "Connection refused" from n8n to Backend

**Symptom:** HTTP Request nodes fail with ECONNREFUSED

**Cause:** n8n runs inside Docker and can't reach `localhost:8000`

**Fix:** Ensure `OCEAN_SENTRY_API_URL=http://host.docker.internal:8000` in `.env`

The docker-compose already includes:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## Backend Not Starting

```bash
cd ocean-sentry/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Check for:
- Missing dependencies: `pip install -r requirements.txt`
- Port already in use: `lsof -i :8000`
- Missing data files: `ls data/processed/collocated_qc.parquet`

## Voice Messages Not Working

1. **Check GEMINI_API_KEY** — Must be set in `.env`
2. **TELEGRAM_BOT_TOKEN** in environment — needed for file download
3. **Test manually**: Send a short voice message and check n8n execution log
4. **Verify Gemini access**: Ensure your API key has access to Gemini 2.0 Flash

## "No stored location" Error

The bot needs a GPS location before answering text queries.

**Fix:** Share your Telegram location first (📎 → Location → Send current location)

## Stale Data Warning

Data freshness shows hours since last update. This is normal — Argo profiles update periodically.

## Out of Coverage Area

Ocean Sentry currently covers:
- Bay of Bengal: 5.4–18.1°N, 80.8–92.2°E

Locations outside this region return `insufficient_data`.

## n8n Memory/Performance

If n8n becomes slow:
```bash
docker compose restart
```

To reset n8n completely:
```bash
docker compose down -v  # removes volume
docker compose up -d
# Re-import workflows
```

## Common n8n Errors

| Error | Fix |
|-------|-----|
| `ECONNREFUSED` | Backend not running or wrong URL |
| `401 Unauthorized` | Invalid Telegram token |
| `404 Not Found` | Wrong API path or location not stored |
| `timeout` | Backend overloaded or network issue |
| `Cannot read property` | Upstream node returned unexpected format |

## Docker Networking (macOS)

On macOS, Docker Desktop provides `host.docker.internal` automatically.

On Linux, the `extra_hosts` directive in docker-compose handles it:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## Checking Webhook Status

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Should show your n8n webhook URL when the workflow is active.

## Resetting Telegram Webhook

If webhook is stuck:
```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```
Then reactivate the workflow in n8n.
