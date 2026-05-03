/**
 * Documentation page describing how to connect Quorum to MCP-compatible
 * clients (Claude Desktop, Cursor, Copilot Studio, M365 Agents Toolkit).
 *
 * Mounted at /docs/mcp via App.tsx.
 */

const CLAUDE_DESKTOP_SNIPPET = `{
  "mcpServers": {
    "quorum": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://YOUR_DOMAIN/api/mcp",
        "--header",
        "Authorization: Bearer mcp_PASTE_YOUR_KEY_HERE"
      ]
    }
  }
}`;

const CURSOR_SNIPPET = `{
  "mcpServers": {
    "quorum": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer mcp_PASTE_YOUR_KEY_HERE"
      }
    }
  }
}`;

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "1 · Generate an MCP API key",
    body: (
      <p>
        Open <strong>Tenant admin → MCP keys</strong>. Give the key a name,
        select the scopes you want to grant, and click <em>Create</em>. Copy
        the full <code>mcp_…</code> token — it is only shown once.
      </p>
    ),
  },
  {
    title: "2 · Claude Desktop",
    body: (
      <>
        <p>
          Open <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
          {" "}(macOS) or the equivalent on Windows, and add the entry below.
        </p>
        <pre>
          <code>{CLAUDE_DESKTOP_SNIPPET}</code>
        </pre>
        <p>Restart Claude Desktop. Quorum tools appear under the toolbox icon.</p>
      </>
    ),
  },
  {
    title: "3 · Cursor",
    body: (
      <>
        <p>
          In Cursor, open <code>~/.cursor/mcp.json</code> and add:
        </p>
        <pre>
          <code>{CURSOR_SNIPPET}</code>
        </pre>
      </>
    ),
  },
  {
    title: "4 · Copilot Studio (Microsoft)",
    body: (
      <>
        <p>
          In Copilot Studio, open <em>Tools → Custom connectors → Add a connector → From YAML</em>
          {" "}and upload{" "}
          <code>microsoft-agent-toolkit/copilot-studio-connector.yaml</code>{" "}
          from this repo. Provide your MCP API key as the bearer token when
          prompted.
        </p>
        <p>
          Reference the connector from any Copilot Studio agent — the Quorum
          tools (<code>convene_session</code>, <code>list_boards</code>, …) will
          appear automatically.
        </p>
      </>
    ),
  },
  {
    title: "5 · Microsoft 365 Agents Toolkit",
    body: (
      <>
        <p>
          The repo ships a sideloadable declarative agent under{" "}
          <code>microsoft-agent-toolkit/</code>. Run{" "}
          <code>./build-pack.sh</code> to produce <code>pack.zip</code>, then
          in VS Code with the M365 Agents Toolkit extension run{" "}
          <em>Sideload package…</em> and select the zip. The Quorum Council
          declarative agent appears in Microsoft 365 Copilot's agent picker.
        </p>
      </>
    ),
  },
];

export default function DocsMcp() {
  return (
    <div
      className="boa min-h-[100dvh]"
      style={{ background: "var(--boa-paper)" }}
    >
      <div className="max-w-[840px] mx-auto px-8 py-16">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.2em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Integration · MCP
        </div>
        <h1
          className="boa-display text-[44px] leading-tight mb-3"
          style={{ color: "var(--boa-ink)" }}
        >
          Use Quorum from Claude, Cursor, and Copilot
        </h1>
        <p
          className="text-[15px] mb-12 max-w-[640px]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Quorum exposes a Model Context Protocol (MCP) server at{" "}
          <code>/api/mcp</code> on this domain. Any MCP-compatible client can
          authenticate with a tenant-scoped API key and use the council as a
          first-class tool surface — convene sessions, read minutes, branch
          deliberations, record outcomes.
        </p>

        <div className="space-y-12">
          {STEPS.map((s) => (
            <section key={s.title}>
              <h2
                className="boa-display text-[24px] mb-3 pb-2 border-b boa-rule"
                style={{ color: "var(--boa-ink)" }}
              >
                {s.title}
              </h2>
              <div
                className="prose prose-sm max-w-none"
                style={{ color: "var(--boa-ink-2)" }}
              >
                {s.body}
              </div>
            </section>
          ))}

          <section>
            <h2
              className="boa-display text-[24px] mb-3 pb-2 border-b boa-rule"
              style={{ color: "var(--boa-ink)" }}
            >
              Tools, resources, and prompts
            </h2>
            <ul
              className="text-[14px] leading-relaxed list-disc pl-6"
              style={{ color: "var(--boa-ink-2)" }}
            >
              <li>
                Tools: <code>list_tenants</code>, <code>list_boards</code>,{" "}
                <code>get_board</code>, <code>list_advisors</code>,{" "}
                <code>list_sessions</code>, <code>get_session_minutes</code>,{" "}
                <code>list_decisions</code>, <code>convene_session</code>,{" "}
                <code>wait_for_session_completion</code>,{" "}
                <code>branch_session</code>,{" "}
                <code>record_decision_outcome</code>.
              </li>
              <li>
                Resources: <code>quorum://tenants/current</code>,{" "}
                <code>quorum://boards/{"{boardId}"}</code>,{" "}
                <code>quorum://sessions/{"{sessionId}"}</code>.
              </li>
              <li>
                Prompts: <code>brief_me_on_board</code>,{" "}
                <code>convene_council_on_question</code>.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
