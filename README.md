# 1st-autoworkflow
To give it a try I built this

## WhatsApp Wholesale Shoe Sales Call Tracker

`whatsapp-shoe-sales-call-tracker.json` is an importable n8n workflow that:

- Listens for incoming WhatsApp Business messages (text, voice notes, and shared location pins).
- Transcribes voice notes with OpenAI Whisper.
- Uses an LLM to extract the client's product interest, quantity/requirement, location, and interest level from each message.
- Logs every call/message in chronological sequence per client (Date, Time, Location, Requirement, Sequence No, etc.) to a `Sales Call Log` Google Sheet.
- Upserts a `Client Master` sheet with each client's latest status.
- Emails a hot-lead alert when a client's interest level is "High".

Import it into n8n (Workflows → Import from File), then follow the sticky notes inside the workflow canvas to wire up credentials and your Google Sheet.
