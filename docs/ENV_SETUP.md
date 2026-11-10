# Environment setup

The ignored .env file is prepared in the project root. Never attach a populated .env file in chat or commit it.

1. Open .env and fill XAI_API_KEY with your Grok/xAI key.
2. Leave XAI_MODEL=grok-4.7 unless your xAI account uses another supported text model.
3. Optionally fill DATA_GOV_IN_API_KEY with your free personal OGD key for official CPCB station summaries.
4. Restart CarbonX so the server reads the new values.

Open-Meteo weather, modelled air quality and Earth Search / Sentinel-2 use the public URLs already supplied. They do not need invented API keys. Leave those endpoint settings unchanged.

## Check the connections

From the project terminal:

```powershell
npm.cmd run integrations:check
```

This checks weather, atmospheric output, the Sentinel-2 catalogue, optional official stations and (when a key exists) xAI's model list. It prints statuses, never secret values. A successful model-list check does not prove inference.

For a small synthetic Grok inference test, using your API credits:

```powershell
npm.cmd run integrations:check -- --ai
```

No real report is sent by this test. Normal AI report processing sends extracted report passages and selected evidence to xAI. Grok is an external API with credits/billing; it is not a free local model.

Grok supports structured extraction, cited evidence answers, action plans and monitoring explanations. Evidence search stays lexical in this configuration; no unsupported Grok embedding endpoint or second AI key is assumed. Missing credentials leave the labelled baseline active.

No AI is called automatically by the setup script, and no actual inference was verified while the key was blank. The --ai flag is an explicit optional request for inference.

## Other integrations

Official measured station data needs your own data.gov.in account key. No reusable key was found in the legacy workflow and an account key cannot be generated without the account.

Supabase migration and email are not connected by these environment changes. They remain separate later work; no nonfunctional Supabase or email keys were added to the active template.

For public HTTPS hosting, set HOST as required by the host, COOKIE_SECURE=true and ALLOW_DEMO=false, then provision a real government administrator. Keep this local preview's defaults for local review.

## Official references

- https://docs.x.ai/developers/model-capabilities/text/structured-outputs
- https://docs.x.ai/developers/models
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/air-quality-api
- https://github.com/Element84/earth-search
- https://www.data.gov.in/help
