# CarbonX environment setup

Current status update: Supabase Auth and private Storage are implemented, enabled and live verified. Six evidence files were migrated and checksum checked. PostgreSQL persistence/migration code is implemented and locally tested, but hosted database activation is blocked by TLS negotiation from this network. Official CPCB public sample mode is now live-verified: ten station records for each of eight metros, with partial coverage. An initial HTTP 429 cleared on retry. See [BACKEND_STATUS.md](BACKEND_STATUS.md) for the current configuration and next steps; older observations below are historical.

The root .env is ignored by Git and Docker. Copy .env.example to .env and add credentials locally. Never commit .env or paste production credentials into project documentation. If a credential has been exposed, revoke it and create a replacement.

## AI

1. In .env set AI_PROVIDER=groq, GROQ_API_KEY to your replacement key, and GROQ_MODEL=openai/gpt-oss-20b.
2. Keep ENABLE_HOSTED_AI=true. No local model or separate OpenAI key is needed. The model's openai/ prefix is its identifier on Groq.
3. Restart CarbonX. Run npm.cmd run integrations:check. To request a small synthetic inference test, run npm.cmd run integrations:check -- --ai.
4. Normal AI processing sends selected uploaded report text/evidence to Groq. The checker sends only a synthetic status prompt. Account free-tier rate limits, model availability and any enabled billing still apply.

The Groq adapter uses https://api.groq.com/openai/v1. It cannot send a Groq credential to xAI. Grok/xAI remains an explicit optional alternative using AI_PROVIDER=xai, XAI_API_KEY and XAI_MODEL.

AI supports source-quoted claim extraction, cited evidence answers, evidence-gathering actions and alert explanations. Server prompts are in server/prompts.mjs. JSON output is locally validated; citations must match supplied evidence. AI does not approve claims, change licences or establish a legal violation. Missing keys leave the baseline available. Search remains lexical; no extra embeddings API is assumed.

## Weather and air quality

Open-Meteo weather and CAMS regional air-quality model endpoints already work without keys. They are contextual model output, not factory emissions telemetry.
For official station summaries, create your own data.gov.in account key and place it in DATA_GOV_IN_API_KEY. Station availability, metadata and measurement basis must still be checked.

## Current satellite view

The primary India view uses EUMETSAT public infrared imagery with a 15-minute source interval. It needs no key. Capture time, age and stale states are shown. Historical Sentinel-2 comparisons remain separate.

## Optional credential-based historical satellite imagery

1. Register/sign in to Copernicus Data Space at https://dataspace.copernicus.eu/.
2. Open the Sentinel Hub dashboard, User Settings, OAuth clients, and create a client.
3. Put its ID into COPERNICUS_CLIENT_ID and its secret into COPERNICUS_CLIENT_SECRET.
4. Set SATELLITE_PROVIDER=sentinelhub and restart. Until then leave earth-search selected; its existing dated Sentinel-2 integration needs no key.
5. In Site data, select a real facility and two historical windows, then request a comparison. Authentication alone is not an imagery result.

The adapter caches OAuth tokens, searches the site coordinates and requests daily Sentinel-2 NDVI/NDWI statistics in a 1 km UTM window at 10 m resolution. SCL classes 4/5/6 plus the data mask reject unsuitable pixels. At least 30 pixels and 20% valid coverage are required. Catalogue cloud cover describes the selected catalogue scene; indices describe a daily mosaic, not exclusive pixels from that scene. Free-account quotas and scene availability apply. No automatic switch to another provider hides an authentication failure.

ISS position is an orbital coordinate feed, not imagery or a company-location validator. It does not become facility emissions evidence when an API key is added.

## Supabase

Configure Supabase URL and server credentials locally only when using its optional integrations. See SUPABASE_SETUP.md for current implementation and verification status. Email setup is optional.

## Run

npm.cmd run build
npm.cmd start

Keep the server running for background polling. For HTTPS hosting set COOKIE_SECURE=true and disable public demo access. See production-readiness.md before deployment.

## Official documentation

- https://console.groq.com/docs/quickstart
- https://console.groq.com/docs/structured-outputs
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Catalog/Examples.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical/Examples.html
- https://wheretheiss.at/w/developer

## Windows certificate trust

On this Windows machine the local Node process required the system trust store for provider HTTPS connections. The ignored .env now includes NODE_OPTIONS=--use-system-ca. TLS certificate and hostname verification remain enabled; no custom certificate is bundled. This flag requires a supporting Node version (Node 24+ recommended); it is local configuration, not a new API credential. Standard npm start, dev and integrations:check read it through --env-file-if-exists=.env. The public .env.example does not force this machine-specific setting.

Reference: https://nodejs.org/api/cli.html#--use-system-ca
