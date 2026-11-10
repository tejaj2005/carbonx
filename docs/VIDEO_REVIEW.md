# Hackathon recording review

Reviewed the user-supplied file "▶️ zignasa - n8n - Google Chrome 2025-12-14 20-37-51.mp4" on 10 November 2026.

## Inspection

The supplied file is 5,001,798 bytes and matches the previously inspected reference recording byte-for-byte (SHA-256 00cfd1a50915dc395da77b3d12e0a82209113f73b9f66c35f503a9af9bdaa0d7). Full stream decoding succeeded. Container duration is about 6.29 seconds, 1920×1080 H.264 with an AAC audio track. Visual review covered frame samples through the recording, including 0.25-second contact sheets and full-resolution workflow frames. No claim is made to have transcribed the audio.

The clip shows a completed n8n workflow canvas with green execution markers/item counts. It does not open coordinate payloads, HTTP response tables, anomaly code, AI prompts or delivered email content. Those details cannot be independently inferred from the canvas alone.

## Visible sequence

1. Manual Execute workflow trigger branches to Satellite Data API, Emission History API and Energy Usage Sample API.
2. Merge appends the three input streams; Anomaly Detection Code follows.
3. A dashboard branch generates Dashboard HTML and returns it through a webhook.
4. A report branch generates a PDF report, routes an HTML item, converts report outputs, merges reports and reaches Gmail Send a message.
5. An AI branch passes through Generate Report → AI Agent (connected to OpenAI Chat Model) → Create Visualization Data.

The node labelled Convert to PDF displays a file-conversion subtitle on the canvas; this clip by itself does not prove a real PDF format. CarbonX's current PDF export uses PDFKit and is tested separately.

## Interpretation using the separately supplied workflow/export audit

The legacy HTTP nodes called ISS orbital position, Open-Meteo air quality and Open-Meteo weather. Consequently, the labels Satellite, Emission History and Energy Usage should not be carried forward as claims of satellite site imagery, measured company emissions or energy consumption.

The old workflow connected OpenAI and Gmail through n8n credential references. No reusable secrets were recovered. The recording is reference material, not permission to contact the lost workspace or reuse old message recipients.

## Changes inspired by the recording

- A readable five-stage visual flow: Location → Air quality → Satellite → Emissions → Review.
- Coordinates and source time remain visible so viewers understand which place and data are being checked.
- A satellite orbit/scan illustration and actual dated site results appear together, with clear source boundaries.
- Snapshot playback demonstrates the sequence without pretending to execute a fresh API request.
- A separate synthetic emissions slider previews above/below-threshold outcomes and a reviewer handoff.
- Actual company/government in-app notices remain a separate stored workflow. The simulator does not create notices or licence actions.
- A visible source catalogue explains which fields are modelled, measured, company-reported or synthetic.
- Related report/evidence and monitoring/site views are grouped to reduce navigation clutter.

No old n8n workflow was run, no n8n Cloud recovery was attempted and no email was sent.
