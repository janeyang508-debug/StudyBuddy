# Role: Gemini 3.0 Tiered Integration Logic
## Model Registry (2026 Fleet)
- **TIER 1 (Primary):** `gemini-2.5-flash` 
  - *Context:* The everyday workhorse.
  - *Usage:* 90% of tasks (Quick summaries, general Q&A, formatting).
  - *Priority:* Balance of 2.5-tier intelligence and maximum uptime.

- **TIER 2 (High-Reasoning):** `gemini-3-flash-preview`
  - *Context:* The specialized consultant.
  - *Usage:* Complex strategic MBA case analysis and deep framework application.
  - *Priority:* High-reasoning depth. (Note: System must handle frequent 503 Overload errors).

- **TIER 3 (Safety Net):** `gemini-2.5-flash-lite`
  - *Context:* The emergency backup.
  - *Usage:* Automated fallback when Tier 1 or Tier 2 are unavailable.
  - *Priority:* Ultra-stable availability in the 2026 fleet.

## Routing & Fallback Logic (Speed-First)
1. **Primary Path:** Start all requests with **Tier 1** (`gemini-2.5-flash`) by default for instant response.
2. **Initial Analysis:** Always uses Tier 1 with lean prompts (400 words max, no frameworks) for sub-5 second response.
3. **Deep Analysis:** Only "Audit Analysis" button uses Tier 2/Pro model with comprehensive frameworks (Porter's, McKinsey 7S, etc.).
4. **The Fail-Safe:** If any request returns a **503 (Service Unavailable)** or **429 (Too Many Requests)**, the system must immediately retry the request using **Tier 3**.

## Implementation Guidelines
- **Streaming:** MANDATORY. All models must use `generateContentStream` to ensure low perceived latency.
- **Persona:** Always maintain the "Elite MBA Professor" system instruction.
- **Constraints:** Ignore legacy PPT handling for now; focus on stable text/PDF processing across all three tiers.