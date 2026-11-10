# Project review walkthrough

## Start

Double-click Open CarbonX.cmd and open http://127.0.0.1:8765/#public. This is a running application with persistent local records, not a directly opened HTML file.

Use a wide browser window for the review. The interface also supports a narrow screen.

## A five-minute demonstration

1. Begin on the public transparency page. Explain that visitors can see explicitly published company summaries without signing in. Annual usage, recent submitted readings and environmental observations retain their own periods/times.
2. Choose Watch the review journey. Play the five stages: submit, read, compare, observe and human review. The floating cards explain the evidence trail without exposing backend operations.
3. Select Satellite view and animate the observation scan. Select Air quality and move the slider. These are labelled presentation simulations; they make the ideas visible without changing a stored reading.
4. Choose Company portal, then Explore company demo. This creates a synthetic company, report, historical records and example submission using the actual pipeline. Open Submissions & public page.
5. Submit a claim or record a synthetic usage reading. For the demonstration, describe the source as synthetic. The company owner can choose whether its summary and stored environmental context are public.
6. Use View this company as government in the example banner. The same company and records are retained. Open Claim submissions and inspect the supporting company evidence.
7. Record a review decision with a reason. Use Company registry to manage the CarbonX licence, or Cases & actions to record a request, notice, inspection, finding or incident.
8. Switch back with View this company as company. The review note and any follow-up case appear in the company workspace. A suspended/revoked CarbonX licence pauses company changes while preserving read access.
9. Open Public transparency. The published licence status and submitted usage records appear, without exposing private reports, account details or private case notes.

Restore the synthetic licence to Active after demonstrating a suspension if you want submissions to be available for the next reviewer.

## Government capabilities

- Register a company and create its owner, analyst or reviewer account.
- Review submitted claims and record accepted, rejected, under-review or follow-up decisions.
- Inspect company report claims, protected original reports and historical usage.
- Assign/update a licence number and set pending, active, suspended or revoked status with a reason.
- Create evidence requests, notices, inspection records, findings or incident cases.
- Separate private case notes from optional public notices, and resolve/reopen cases with an audit reason.
- Disable/re-enable company accounts; disabling revokes their sessions.
- Control public-summary publication and export the company register.

These actions update CarbonX's administrative records. No external government licensing system is connected, and the interface claims no government affiliation.

## Real administrator setup

A deployment operator creates a real administrator through the project terminal:

```powershell
npm.cmd run admin:create
```

Enter the administrator's name, email and a password of at least 12 characters. The password prompt is hidden; do not place passwords in command arguments, source, screenshots or Git.

Government accounts cannot be obtained through company registration. The provisioner opens SQLite without running startup job recovery, so it does not mark an active server's jobs interrupted.

For normal operation, disable presentation accounts with ALLOW_DEMO=false. A real government account can register company records and add company users through its protected portal. New company self-registration creates a company owner only.

## Demonstration isolation

Explore government demo creates a new synthetic company and a government session restricted to that exact company. Register-company operations are disabled in the government sandbox. New sandbox users must use a synthetic @carbonx.invalid address.

The banner role switch is available only for a synthetic company while ALLOW_DEMO is enabled. It creates the other demo perspective within that company, rotates the session and retains the same evidence. Real accounts cannot use it.

## What “updated” means

The public page checks for new published records every 30 seconds. A newly submitted reading becomes visible after refresh; a page visit or the refresh control also loads the latest stored records.

This is not a connection to a continuous meter feed. A company submits observed readings with a time, unit, source and optional facility. The future meter integration can submit authenticated readings through the company API. No invented continuous usage stream is displayed as real.

Live weather/air-quality and Sentinel-2 integrations remain available in the company Environment view. Public environmental summaries appear only after publication is enabled; they show stored provider results with timestamps, not a fabricated live measurement.

Hosted AI still needs a fresh server-side API key and model configuration. The animated journey does not assert that a hosted AI request occurred.
