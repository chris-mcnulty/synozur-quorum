# Quorum — Microsoft 365 Agents Toolkit package

This directory contains the Microsoft 365 declarative agent and Copilot
Studio connector definitions that turn Quorum into an in-Copilot board of
advisors.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Teams app manifest (v1.17) referencing the declarative agent. |
| `declarativeAgent.json` | M365 declarative agent (v1.2) — name, instructions, conversation starters, MCP capability. |
| `mcpManifest.json` | MCP capability descriptor referenced by the declarative agent. |
| `copilot-studio-connector.yaml` | Custom connector definition for Copilot Studio agent builder. |
| `icons/color.png` | 192×192 full-color app icon (Quorum brand). |
| `icons/outline.png` | 32×32 white outline icon on transparent background. |
| `build-pack.sh` | Builds `pack.zip` with domain substituted — ready for sideload or submission. |

## Quick start — Sideload for testing

1. Deploy Quorum to Replit (or any host) and note the public domain, e.g.
   `quorum-abc123.replit.app`.
2. Generate an MCP API key in **Quorum → Tenant admin → MCP keys**.
3. Build the package:
   ```bash
   REPLIT_DOMAIN=quorum-abc123.replit.app ./build-pack.sh
   ```
   This substitutes `${REPLIT_DOMAIN}` in every JSON file and produces
   `pack.zip`.
4. In VS Code with the **Microsoft 365 Agents Toolkit** extension, open the
   command palette and run **"Teams: Sideload your app"**, then pick
   `pack.zip`.
5. Open Copilot Chat in Microsoft 365 and select **Quorum Council** from
   the agent picker. Authenticate using your MCP API key when prompted.

## Publish to Microsoft Partner Center

To make Quorum Council available to your entire organisation (or publicly in
the Teams store), submit the same `pack.zip` through Microsoft Partner Center:

1. Go to [https://partner.microsoft.com/dashboard/microsoftteams/overview](https://partner.microsoft.com/dashboard/microsoftteams/overview)
   and sign in with a **Publisher account** (individual or company).
2. Click **"New offer" → "Microsoft Teams app"** and upload `pack.zip`.
3. Fill in the store listing:
   - Display name: **Quorum Council**
   - Short description: _Convene a board of advisors on any decision._
   - Screenshots / videos showing the agent in action.
   - Privacy policy URL and Terms of use URL (update `manifest.json` fields
     `developer.privacyUrl` / `developer.termsOfUseUrl` before building).
4. Under **Availability**, choose **"Specific organisations"** for a private
   org-scoped rollout, or **"Everyone"** for the public store.
5. Submit for Microsoft review. Review typically takes 5–7 business days for
   new submissions and 2–3 days for updates.
6. Once approved, users find the agent in the Teams app store or by typing
   `@Quorum Council` in Copilot Chat.

> **Domain tip:** The `validDomains` field in `manifest.json` must match the
> actual host that serves `/api/mcp`. Run `build-pack.sh` with
> `REPLIT_DOMAIN` set to that host — the script substitutes the placeholder
> automatically so the submitted zip always has the real value.

## Quick start — Copilot Studio

1. In Copilot Studio, open **Tools → Custom connectors → Add a connector → From YAML**.
2. Upload `copilot-studio-connector.yaml` (substitute the domain first if
   your Copilot Studio environment cannot resolve `${REPLIT_DOMAIN}` itself).
3. When prompted for auth, paste an MCP API key (recommended) or register an
   OAuth 2.1 client.
4. Reference the connector from any Copilot Studio agent and the Quorum
   tools (`convene_session`, `list_boards`, …) appear automatically.

## Architecture

```
M365 Copilot ─┐
              │  Streamable HTTP / SSE
Copilot Studio├──────────► /api/mcp  (Quorum MCP server)
              │
Claude / Cursor┘  (via stdio bridge or SSE)
```

## Schema validation

The declarative agent schema is hosted at
`https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.2/schema.json`.
Validate with any JSON Schema validator before sideloading; the Microsoft 365
Agents Toolkit validates automatically when you run the sideload command.

You can also validate locally using the official Teams Toolkit CLI (requires
Node 18+):

```bash
# Install the Teams App CLI
npm install -g @microsoft/teamsapp-cli

# Validate your manifest
teamsapp validate --manifest-path microsoft-agent-toolkit/manifest.json
```

Alternatively, open the `microsoft-agent-toolkit/` folder in VS Code with the
**Microsoft 365 Agents Toolkit** extension installed — it highlights manifest
errors inline without any CLI setup.
