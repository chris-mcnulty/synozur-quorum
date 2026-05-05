# Quorum — Product Backlog

Items here are scoped and ready to be picked up. Check this file before starting new work.

---

## Planned

### Azure AI Foundry integration

**Summary:** Connect the AI Provider Management system to Microsoft Azure AI Foundry so tenants can route Quorum's LLM calls through their own Azure-hosted model deployments instead of (or alongside) direct Anthropic/OpenAI calls.

**Scope:**
- Add `azure_foundry` as a selectable provider in the `AI_PROVIDERS` / `AI_MODEL_CATALOG` constants (`lib/db/src/schema/ai.ts`)
- Extend `tenant_ai_model_configs` to optionally store an Azure endpoint URL and deployment name (likely a `providerConfig` jsonb column, following the pattern in synozur-scdp's `ai_configuration.provider_config`)
- Add Azure Foundry config fields to the AI Models page (`AiModels.tsx`) — endpoint URL and deployment name inputs, shown only when the Azure Foundry provider is selected
- Wire the API server's session runner (`sessionRunner.ts`) and cross-exam runner (`crossExaminationRunner.ts`) to read the active model config and route calls accordingly — using the Azure AI Inference SDK (`@azure-rest/ai-inference`) when provider is `azure_foundry`, falling back to the Anthropic SDK for `anthropic`
- Expose a "test connection" button on the Model Configuration tab that pings the configured endpoint and returns latency + model identity
- Store the Azure endpoint URL as a tenant-level secret (not in plaintext DB) — use the existing `SESSION_SECRET` / object-storage pattern or a new `AZURE_FOUNDRY_ENDPOINT` env var approach, scoped per tenant
- Add usage log entries with `provider: "azure_foundry"` so the Usage Dashboard tracks Azure calls alongside Anthropic ones

**Reference:** synozur-scdp's `server/routes/admin.ts` (`AzureFoundryProvider` class) and `shared/schema.ts` (`AI_PROVIDERS.AZURE_FOUNDRY`, `AIProviderConfig.azureFoundryEndpoint/Deployment`) for implementation patterns.

**Dependencies:** AI Provider Management feature (complete ✓)

---

## Ideas / Future

- Wire `ai_usage_logs` call-sites into `sessionRunner.ts` and `crossExaminationRunner.ts` so the Usage Dashboard populates automatically after board sessions
- Per-tenant monthly token budget alerts (email when usage crosses a configured threshold %)
- Model comparison view — run the same session question through two different models and diff the outputs
