# Voice Input Configuration

## Architecture

```
Telegram Voice Message (.ogg)
       ↓
n8n: Get file_id → Download from Telegram API
       ↓
Convert to Base64
       ↓
Google Gemini (multimodal audio transcription)
       ↓
Transcribed text
       ↓
Intent Router → Normal text flow
```

## Provider: Google Gemini

Voice transcription uses Gemini's multimodal audio capability. Gemini receives the audio as inline base64 data and returns only the transcription — it does NOT interpret, answer, or make decisions about the content.

### Configuration

In `n8n/.env`:
```
GEMINI_API_KEY=your-gemini-api-key
```

That's it. No model or language configuration needed — Gemini auto-detects the language.

### How It Works

1. Telegram sends voice as `.ogg` (Opus codec)
2. n8n downloads the file via Telegram Bot API
3. Audio is base64-encoded in a Code node
4. Sent to Gemini `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
5. Prompt: "Transcribe this audio accurately. Preserve the language spoken by the fisherman. Return only the transcription text. Do not answer or interpret the question."
6. Gemini returns raw transcription
7. Transcription enters the same deterministic intent router used by text messages

### Language Support

Gemini auto-detects the spoken language. No language parameter needed.

Supported languages include:
- English
- Tamil
- Hindi
- Telugu
- Bengali
- And many more (Gemini supports 100+ languages)

The backend intelligence is language-independent — all API responses work regardless of query language.

## Error Handling

If Gemini fails (network error, invalid audio, missing API key):
- User receives: "Sorry, I couldn't understand the voice message. Please try again or send your request as text."
- The workflow continues gracefully without crashing.

## Supported Audio Formats

Telegram sends voice messages as `.ogg` (Opus codec). Gemini supports:
- ogg, mp3, wav, flac, aac, wma, amr

No format conversion needed for Telegram voice messages.

## Important

Gemini is ONLY used for audio-to-text transcription. It does NOT:
- Make fishing decisions
- Calculate suitability scores
- Interpret anomaly risk
- Generate ocean intelligence

All intelligence comes from the Ocean Sentry backend (Copernicus + Argo + ML).

## Testing Voice

1. Open Telegram → your Ocean Sentry bot
2. Hold the microphone button
3. Say: "Is it good to fish here?"
4. Release to send
5. Bot should respond with fishing intelligence (if location is stored)

## Cost

Gemini 2.0 Flash: very low cost per audio transcription request.
Typical voice message (5-10 seconds): negligible cost.
