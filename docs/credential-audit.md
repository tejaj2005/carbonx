# CarbonX credential recovery audit

Inspection date: 10 November 2026

## Result

No reusable plaintext API key, OAuth access token, OAuth refresh token, private key, or password was identified in the inspected archive, available Git history, commit messages, screenshot, or sampled recording frames.

The exported workflow contains two references to credentials stored in its original n8n instance. Those references contain a credential name and record ID, not the underlying secret. The credential IDs cannot authenticate the new CarbonX application.

This result describes the inspected material. It does not establish that an original credential is active, safe, portable, or recoverable from an account that is no longer available.

## Sources and coverage

- User-provided ZIP: C:\Users\TTEJA\Downloads\ZIGNASA_CARBON-CREDIT-FRAUD-DETECTION-SYSTEM_AI-AUTOMATIONS-main.zip
- Public repository: https://github.com/tejaj2005/ZIGNASA_CARBON-CREDIT-FRAUD-DETECTION-SYSTEM_AI-AUTOMATIONS
- Public access verified by a successful anonymous clone with saved credential helpers disabled.
- Advertised branch inspected: main, at commit cf6b22cdc4be9ef02743f5dae433ed22cd694006.
- All eight reachable commits inspected, dated 28 November through 14 December 2025.
- Six unique historical file blobs inspected: the workflow JSON, report HTML, two README versions, screenshot, and recording.
- All five non-directory ZIP entries have the same bytes as corresponding Git blobs. The archive is not an additional version with different keys.
- Text inspection covered known provider-key signatures, bearer tokens, JWT-like strings, private-key blocks, sensitive assignments and JSON fields, authentication headers, URL credentials, and secret query parameters. The node credential objects and HTTP request parameters were also inspected structurally.
- Commit objects and binary byte strings were checked for known credential signatures.
- The screenshot shows the workflow canvas.
- The MP4 is 6.29 seconds at 1920 by 1080. Twenty-six frames sampled at four frames per second span the full recording. All reviewed frames show the workflow canvas; no credential edit panel or visible key was observed. This is visual sampling, not a claim that every pixel in every encoded frame was subjected to OCR.

Unavailable scope: private branches or repositories, deleted or unreachable commits no longer exposed by GitHub, other ZIPs or backups, the original n8n credential database, provider account dashboards, and execution logs not included in this archive.

No workflows were executed, no candidate credential was tested, no messages were sent, and no remote content or account settings were changed.

## What was found

| Workflow component      | Stored information                                                                                 | Reusable secret recovered |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------- |
| OpenAI Chat Model       | openAiApi credential reference, named n8n free OpenAI API credits; model configured as gpt-4o-mini | No                        |
| Send a message          | gmailOAuth2 credential reference, named Gmail account                                              | No                        |
| Satellite Data API      | Where the ISS at positions endpoint with timestamps                                                | No key configured         |
| Emission History API    | Open-Meteo air-quality endpoint with coordinates and weather-variable parameters                   | No key configured         |
| Energy Usage Sample API | Open-Meteo weather forecast endpoint with coordinates and weather variables                        | No key configured         |

The OpenAI node is located around line 154 of Carbon Credit Fraud Detection System.json.json. The Gmail node is around line 196. The IDs under their credentials objects identify n8n records. They are not provider API keys.

The label n8n free OpenAI API credits may indicate an n8n-provided credential arrangement. A label does not prove that there is a user-owned provider key available for use outside the original n8n workspace.

Official n8n documentation confirms that exported workflow JSON includes credential names and IDs; its migration guidance says workflow exports do not transfer credential secrets. It also cautions that HTTP request nodes can contain manually entered authentication values. None were found in these three HTTP nodes.

Sources: [n8n workflow export documentation](https://docs.n8n.io/workflows/export-import/), [n8n migration and credentials guidance](https://support.n8n.io/article/migrating-from-cloud-to-self-hosted).

## Credential setup for the new application

The user has confirmed that the old n8n Cloud workspace is lost and has explicitly excluded recovery of it. No connection, sign-in, or recovery attempt was made, and none is proposed here. The old credential names and IDs remain historical evidence only.

1. Create fresh provider credentials for CarbonX in the provider account intended for the new application. For an OpenAI integration, keep OPENAI_API_KEY in server configuration, rather than application source, browser code, or a public workflow export.
2. If Gmail integration is added, authorize a new OAuth connection for CarbonX. The exported gmailOAuth2 record ID does not supply a reusable access token, refresh token, client ID, or client secret.
3. Reuse the documented public endpoint definitions where appropriate. No API key was configured in the archived Where the ISS at or Open-Meteo request URLs. Confirm the providers' current terms and limits for the actual deployment.

If any real key is later found in publicly accessible code or media, replace it through its provider before integration. No confirmed raw-key exposure was found in the material inspected for this audit.

## API reuse and implementation implications

The endpoint definitions are recoverable without recovering API keys:

- https://api.wheretheiss.at/v1/satellites/25544/positions
- https://air-quality-api.open-meteo.com/v1/air-quality
- https://api.open-meteo.com/v1/forecast

Where the ISS at documents its endpoint as requiring no authentication at present, subject to rate limits. Its result is ISS orbital position and velocity. It does not provide satellite imagery or measure emissions at an industrial site. [Provider documentation](https://wheretheiss.at/w/developer).

The weather endpoint supplies weather variables. Its node name Energy Usage Sample API does not make those values measured industrial energy usage. The workflow's company emission values and risk rules are hardcoded sample inputs. They must not be presented as verified environmental measurements in the implementation.

Open-Meteo authentication, commercial-use terms, and applicable limits should be selected for the actual deployment; there was no Open-Meteo key in the archived URLs to recover.

## Other public information

The workflow contains nine literal email recipients. Their addresses have deliberately not been reproduced in this report. The recording also exposes an n8n Cloud hostname and workflow URL. These are not API keys, but they are public account/contact metadata.

The sample company names and emission findings in the archive are hardcoded demonstration content, not independently verified fraud findings.

## Verification records

The local supplemental scan records the archive-to-Git SHA-256 comparisons and sanitized finding counts at .local/credential-audit/supplemental-scan.json. Review frames and the isolated portable FFmpeg helper are also under .local/credential-audit.

All supplemental audit outputs were written within the user-confirmed CarbonX folder. No application package, frontend, backend, or prototype file was modified as part of this supplemental audit.
