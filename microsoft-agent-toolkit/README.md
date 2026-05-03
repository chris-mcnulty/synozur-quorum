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
| `icons/color.png` / `icons/outline.png` | App icons (192x192 and 32x32). Replace before submission. |
| `build-pack.sh` | Builds `pack.zip` for sideloading via Teams/M365 Agents Toolkit. |

## Quick start — Microsoft 365 Agents Toolkit

1. Replace `${REPLIT_DOMAIN}` in every JSON file with your published Quorum
   domain (e.g. `quorum.example.com`).
2. Generate an MCP API key in Quorum → Tenant admin → MCP keys.
3. Run `./build-pack.sh` to produce `pack.zip`.
4. In VS Code with the Microsoft 365 Agents Toolkit extension, run
   *"Sideload package…"* and pick the generated `pack.zip`.
5. Open Copilot Chat in Microsoft 365 and select **Quorum Council** from
   the agent picker. Authenticate using your API key when prompted.

## Quick start — Copilot Studio

1. In Copilot Studio, open *Tools → Custom connectors → Add a connector → From YAML*.
2. Upload `copilot-studio-connector.yaml`.
3. When prompted for the auth, paste an MCP API key (recommended) or
   register an OAuth 2.1 client.
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
Validate with any JSON Schema validator before sideloading; the Microsoft
365 Agents Toolkit validates automatically on package build.
