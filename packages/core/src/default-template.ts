export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  order: number;
  category: 'cover' | 'overview' | 'specification' | 'technical' | 'api' | 'methods' | 'config';
  hasDiagram: boolean;
  hasTable: boolean;
}

export const SECTION_PROMPT_MAP: Record<string, string> = {
  cover_page: `Cover page with system name and "Technical Design Documentation" mentioned. Write the text <!-- DAMAC_LOGO --> on its own line where the logo should appear. Do NOT use any image markdown or URLs for the logo — only that exact HTML comment placeholder.
Table of Contents`,

  executive_summary: `Executive Summary
- 3–5 paragraphs:
  - What the system does, why it exists, who uses it, and the key outcomes it enables.
  - How it fits into a broader business process.
  - How processing/operations are organized at a high level (e.g., run/batch model, workflows, governance).
- Keep it non-technical and business-readable.
- No deep technical details here.`,

  purpose_introduction: `1. Purpose & Introduction
1.1 Purpose
- 2–3 paragraphs describing why this document exists and how teams use it (onboarding, change impact, operations).
1.2 Introduction
- 2–4 paragraphs describing scope, primary actors, boundaries, and high-level workflows.
- Keep language accessible to non-technical readers; avoid naming internal classes/packages.`,

  system_specification: `2. System Specification
- 1–2 paragraphs positioning the specification (capabilities + quality characteristics) and describing any consistent API/response conventions seen in code.`,

  functional_requirements: `2.1 Functional Requirements
- Derive from code behavior. List FR1, FR2, FR3… Each requirement must include:
  - Short title
  - A business-readable paragraph describing capability and outcome.
  - Mention key constraints plainly (permissions, required inputs, lifecycle, status transitions) without deep implementation detail.
  - Use bullets only when helpful; always lead with a paragraph.`,

  nonfunctional_requirements: `2.2 Nonfunctional Requirements
- Include only categories demonstrated by code/config/patterns: performance, reliability, security, scalability, maintainability, observability, privacy/compliance (only if truly indicated).
- List NFR1, NFR2, NFR3… Each requirement must begin with its NFR identifier.
- For each NFR:
  - A clear statement + short explanation of how the system supports it (plain language first, then specifics).
  - No "not found" statements.`,

  architecture_overview: `3. Technical Approach
- 1–2 paragraphs describing how the system is constructed and how the design supports maintainability and operations.
- Identify every major component, module, and service in the system. Each major component becomes its own numbered subsection under Section 3.

IMPORTANT: For EACH major component found in the codebase, create a dedicated subsection numbered sequentially (3.1, 3.2, 3.3, …). Every major component MUST have its own subsection — no component should be omitted.

3.X <Component/Module/Service Name>
- 1–2 paragraphs introducing the component: what it does, why it exists, and its role in the overall system.

3.X.1 Architecture Overview
- 2–4 paragraphs describing:
  - Internal architecture, design patterns, and structural organization of this component
  - Responsibilities and boundaries
  - Key classes, modules, or sub-components within it
  - How it interfaces with and depends on other system components
- Include a Mermaid diagram of the component's internal architecture or its relationships within the system if warranted.
- Caption + explanatory paragraph.

3.X.2 Process Flow
- 2–4 paragraphs describing the primary operations and workflows this component performs or participates in.
- Mermaid sequence or activity diagram showing the component's main processing flow(s).
- Caption + explanatory paragraph.

3.X.3 High-Level Flow Overview
- 2–4 paragraphs summarizing the end-to-end data and control flow involving this component:
  - Upstream inputs and triggers
  - Internal processing and data transformations
  - Downstream outputs, side effects, and handoffs to other components
  - Key connections and data contracts with other system components

3.X.4 Detailed Step-by-Step Flow
- For each primary operation this component performs:
  - Numbered steps covering input validation, core processing logic, data transformations, error handling, side effects, and state transitions.
  - Follow with a paragraph covering failure modes, recoverability, and operational implications.
- Do not include "Evidence"; keep steps grounded in code.

Repeat this pattern (3.X with four sub-sections) for EVERY major component in the system. After all per-component subsections, cross-cutting technical concerns follow in subsequent subsections (continuing the Section 3 numbering).`,

  process_flow: `End-to-End Process Flows (continue numbering as the next subsection under Section 3, after all per-component subsections above)
- 2–4 paragraphs describing the major end-to-end flows that span across multiple components in the system (business-first, then technical).
- Mermaid sequence/activity diagram(s) showing all participating components and their interactions for each major flow.
- Caption + explanatory paragraph per diagram.
- For each primary end-to-end flow:
  - Numbered steps tracing across all involved components from initiation to completion.
  - Follow with a paragraph covering validations, failure modes, side effects, and state transitions in professional language.
  - Do not include "Evidence"; keep steps grounded in code.`,

  data_design: `Data Design (continue numbering under Section 3)
- 2–4 paragraphs describing:
  - Persistence approach and technologies
  - Core domain entities and their relationships
  - Lifecycle/state fields where relevant
  - Data integrity constraints and business rules enforced at the data layer
- Mermaid ER diagram
- Caption + explanatory paragraph
- DB object inventory table (name + repository-grounded description).`,

  security_access: `Security & Access Control (continue numbering under Section 3)
- 2–4 paragraphs covering:
  - Authentication (how identity is established) if present
  - Authorization (how permissions are enforced) if present
  - Validation and defensive checks
  - Secrets/config handling patterns
- Avoid claiming RBAC/SSO/etc. unless clearly implemented.`,

  error_handling: `Error Handling & Resilience (continue numbering under Section 3)
- 2–4 paragraphs covering:
  - Validation vs business rule failures vs runtime errors
  - Retries/timeouts/idempotency/DLQ/compensation where present
  - Async execution failure behavior and recoverability
  - Circuit breaker, bulkhead, or graceful degradation patterns if present
- Keep it operationally meaningful.`,

  observability: `Observability (continue numbering under Section 3)
- 2–4 paragraphs covering:
  - Logging practices and log levels
  - Tracing/metrics/health endpoints if present
  - Correlation identifiers and audit logs if present
  - Dashboard, alerting, and operational runbook signals if present
- Focus on how operators troubleshoot.`,

  deployment_runtime: `Deployment & Runtime (continue numbering under Section 3)
- 2–4 paragraphs covering:
  - Build/run approach (Maven/Gradle, Docker, K8s manifests, CI/CD signals) if present
  - Runtime dependencies (DBs, queues, file mounts, external services)
  - Environment separation patterns
- Mermaid deployment diagram
- Caption + explanatory paragraph`,

  api_specification: `4. API Specification
- Start with 2–3 paragraphs describing:
  - API grouping and conventions
  - Versioning/base paths if present
  - Authentication expectations if present
  - Common response/error envelope patterns if present
- For EACH endpoint:

4.X <HTTP METHOD> <PATH> — <Endpoint Name>
- Write TWO paragraphs:
  1) Business/operational purpose (who uses it, what outcome it supports)
  2) Behavioral summary (validation, constraints, side effects, notable response behavior)

4.X.1 Request headers
- 1 paragraph introducing headers in a natural tone (no "this table…").
Table (NO evidence column):
| Header | Required | Type | Notes |
|---|---:|---|---|

4.X.2 Request parameters (path/query/body)
- 1 paragraph introducing inputs and constraints.
Table:
| Field | Location | Required | Type | Validation/Rules | Notes |
|---|---|---:|---|---|---|

4.X.3 Response structure
- 1 paragraph describing how to interpret the response and errors.
Table:
| Field | Type | Required | Notes |
|---|---|---:|---|
- Include status codes and error shape in prose (avoid over-technical jargon).

4.X.4 Sample Request & Response
- 1 paragraph describing what the sample illustrates.
- Provide samples only if grounded in tests/schemas/types; keep minimal and readable.
- If exact examples don't exist, generate conservative examples consistent with DTO/schema shapes WITHOUT labeling them as "not found".`,

  method_details: `5. Method Details
- 1–2 paragraphs providing an overview of the functions and methods found in the codebase — approximate count, naming conventions, and general organizational patterns.

5.X <functionName / methodName> (<file path>)
- List EVERY function and method found in the codebase. Each one gets its own numbered subsection (5.1, 5.2, 5.3, …).
- For each function/method, provide:
  - **Signature**: Full signature including name, parameters (with types), and return type.
  - **Purpose**: What the function does and why it exists.
  - **Parameters**: Each parameter described — type, purpose, constraints, and default value if any.
  - **Return Value**: What is returned, including possible states or error conditions.
  - **Behavior**: Key logic, validations, business rules, side effects, exceptions, and state mutations.
  - **Dependencies**: Other functions, services, or external systems it calls or relies on.
  - **File Location**: The file path where this function is defined.

No function or method should be omitted. If the codebase contains no functions or methods, write a single paragraph stating: "No methods or functions were identified in the analyzed codebase."`,

  configuration: `6. Configuration & Environment Variables
- 2–3 paragraphs describing:
  - The overarching configuration strategy and how configuration controls runtime behavior across environments
  - What categories of configuration exist (database, external service endpoints, feature flags, rule paths, telemetry, secrets)
  - Operational impact of changing key settings and the configuration change management approach

6.1 Environment Variables
- 1–2 paragraphs describing the role of environment variables in the system, how they are loaded/resolved, and the expected deployment-time setup.
- Table:
| Variable | Required | Default | Description | Impact |
|---|---:|---|---|---|

6.2 Core Runtime Settings
- 1–2 paragraphs describing application-level runtime configuration that governs system behavior beyond environment variables (e.g., timeouts, pool sizes, pagination defaults, rate limits).
- Table:
| Setting | Type | Default | Description | Restart Required |
|---|---|---|---|---:|

6.3 Database & Persistence Configuration
- 1–2 paragraphs describing how database connections, connection pool sizes, timeouts, migration settings, and any ORM/query-level configurations are managed.
- Table or narrative list of key database configuration parameters found in the codebase.

6.4 External Service & Integration Configuration
- 1–2 paragraphs describing how external APIs, third-party services, message brokers, and integration endpoints are configured — including base URLs, API keys, timeout policies, and retry behavior.
- Table or narrative list of external service configuration parameters.

6.5 Feature Flags & Toggles
- 1–2 paragraphs describing any feature flag system, A/B testing configuration, or runtime toggles found in the codebase. If none exist, write a brief neutral paragraph noting the absence without using "not found" language.

6.6 Security & Secrets Configuration
- 1–2 paragraphs describing how secrets, API keys, certificates, and sensitive configuration values are managed and injected at runtime.
- Do NOT reveal actual secret values — describe the configuration shape and management approach only.

6.7 Logging, Monitoring & Telemetry Configuration
- 1–2 paragraphs describing how log levels, log formats, monitoring endpoints, telemetry collection, and alerting thresholds are configured.

6.8 Build & Dependency Signals
- Short narrative list describing build tools, dependency management, version constraints, and CI/CD configuration signals observed in the codebase.`,
};

export const PREAMBLE_PROMPT = `Generate a professional, publication-quality Technical Design Document (TDD) for the target system using ONLY the content present in this repository's codebase.

NON-NEGOTIABLE RULES (NO INVENTION)
- Do NOT assume anything outside the codebase.
- Do NOT add features, integrations, roles, workflows, SLAs, or compliance claims unless clearly supported by code/config.
- Be comprehensive: include all modules/services/endpoints/models/jobs/configs present in the repo.
- If something is ambiguous, describe it cautiously and only at the level the code supports.
- Do NOT include "Evidence" columns/fields anywhere in the document.
- Do NOT write phrases like "not found in codebase", "not mentioned", "missing", or similar. If something isn't supported, simply don't claim it. If a required template area has limited signals, write a short neutral paragraph describing only what is visible.

TONE + WRITING RULESET (CRITICAL)
- Write in a polished enterprise TDD voice: concise, confident, readable.
- The document must read like release-ready technical documentation, never like an AI response to instructions.
- NEVER use meta phrases like "This section/subsection/endpoint/diagram…" or "Below you will find…". Headings must flow naturally into narrative.
- Sections 0 and 1 must be written for NON-technical readers:
  - Explain what the system is, who it serves, what outcomes it enables, and how it is operated at a high level.
  - Avoid implementation jargon (framework names, class names, database specifics) unless necessary and briefly explained.
- Sections 2–6 may include technical detail, but must remain readable:
  - Prefer business-outcome language first, then implementation detail.
  - Avoid excessive jargon; when unavoidable, add a brief plain-language clarification inline.
- Every heading/subheading must contain narrative prose:
  - Minimum 1–3 solid paragraphs per heading (unless a section is inherently a table/list).
  - If you include tables or bullets, add paragraphs before/after explaining purpose, key takeaways, and rationale.
- Avoid repetitive sentence openings (don't start every paragraph with "The service…"). Vary phrasing.

SECTION 3 STRUCTURE (CRITICAL)
- Section 3 (Technical Approach) is organized BY COMPONENT, not by topic.
- Each major system component gets its own numbered subsection (3.1, 3.2, 3.3, …) with four mandatory sub-sections: Architecture Overview, Process Flow, High-Level Flow Overview, and Detailed Step-by-Step Flow.
- After all per-component subsections, cross-cutting concerns (End-to-End Flows, Data Design, Security, Error Handling, Observability, Deployment) continue the Section 3 numbering.

DIAGRAMS (MERMAID) + FIGURES
- Use Mermaid diagrams where applicable: architecture, key flows, data model (ER), deployment.
- Every diagram MUST include:
  1) Sequential figure label and caption directly below it: "Figure X. …"
  2) A short paragraph explaining what the figure conveys and why it matters operationally.
- Number figures sequentially across the entire document (Figure 1, Figure 2, …).`;

export const QUALITY_GATES_PROMPT = `FINAL QUALITY GATES
- No heading is empty or only a list/table.
- No "This section/subsection/endpoint/diagram…" phrasing anywhere.
- Sections 0 and 1 are non-technical and business-readable.
- Figures are numbered, captioned, and explained.
- No Evidence fields/columns; no "not found/not mentioned" statements.
- Section 3 has one subsection per major system component, each with Architecture Overview, Process Flow, High-Level Flow Overview, and Detailed Step-by-Step Flow.
- Cross-cutting concerns (data design, security, error handling, observability, deployment) follow the per-component subsections under Section 3 with continued numbering.
- Method Details section covers all methods found in the codebase, or explicitly states none exist.
- Configuration section is comprehensive across all subsections.`;

export function getDefaultSections(): TemplateSection[] {
  return [
    { id: 'cover_page', title: 'Cover Page & Table of Contents', description: 'Title page with system name, DAMAC logo, and a structured table of contents.', enabled: true, order: 0, category: 'cover', hasDiagram: false, hasTable: false },
    { id: 'executive_summary', title: 'Executive Summary', description: 'Non-technical overview of what the system does, who uses it, and the outcomes it enables.', enabled: true, order: 1, category: 'overview', hasDiagram: false, hasTable: false },
    { id: 'purpose_introduction', title: 'Purpose & Introduction', description: 'Why this document exists, scope, primary actors, and high-level workflows.', enabled: true, order: 2, category: 'overview', hasDiagram: false, hasTable: false },
    { id: 'system_specification', title: 'System Specification', description: 'Capabilities overview and API conventions observed in the codebase.', enabled: true, order: 3, category: 'specification', hasDiagram: false, hasTable: false },
    { id: 'functional_requirements', title: 'Functional Requirements', description: 'Business-readable requirements derived from code behavior (FR1, FR2, ...).', enabled: true, order: 4, category: 'specification', hasDiagram: false, hasTable: false },
    { id: 'nonfunctional_requirements', title: 'Non-functional Requirements', description: 'Performance, reliability, security, and other quality attributes demonstrated by code.', enabled: true, order: 5, category: 'specification', hasDiagram: false, hasTable: false },
    { id: 'architecture_overview', title: 'Technical Approach — Per-Component Detail', description: 'Each major system component gets a dedicated subsection (3.1, 3.2, …) with Architecture Overview, Process Flow, High-Level Flow Overview, and Detailed Step-by-Step Flow.', enabled: true, order: 6, category: 'technical', hasDiagram: true, hasTable: false },
    { id: 'process_flow', title: 'End-to-End Process Flows', description: 'Cross-cutting end-to-end flows spanning multiple components, with sequence diagrams and step-by-step traces.', enabled: true, order: 7, category: 'technical', hasDiagram: true, hasTable: false },
    { id: 'data_design', title: 'Data Design', description: 'Cross-cutting persistence approach, entity relationships, ER diagram, and DB object inventory.', enabled: true, order: 8, category: 'technical', hasDiagram: true, hasTable: true },
    { id: 'security_access', title: 'Security & Access Control', description: 'Cross-cutting authentication, authorization, validation, and secrets handling patterns.', enabled: true, order: 9, category: 'technical', hasDiagram: false, hasTable: false },
    { id: 'error_handling', title: 'Error Handling & Resilience', description: 'Cross-cutting error strategies, retries, failure recovery, and operational resilience.', enabled: true, order: 10, category: 'technical', hasDiagram: false, hasTable: false },
    { id: 'observability', title: 'Observability', description: 'Cross-cutting logging, metrics, health endpoints, and troubleshooting approaches.', enabled: true, order: 11, category: 'technical', hasDiagram: false, hasTable: false },
    { id: 'deployment_runtime', title: 'Deployment & Runtime', description: 'Cross-cutting build process, runtime dependencies, environment patterns, and deployment diagram.', enabled: true, order: 12, category: 'technical', hasDiagram: true, hasTable: false },
    { id: 'api_specification', title: 'API Specification', description: 'Complete specification of all endpoints with request/response details and samples.', enabled: true, order: 13, category: 'api', hasDiagram: false, hasTable: true },
    { id: 'method_details', title: 'Method Details', description: 'Comprehensive inventory of all methods and functions in the codebase with signatures, behavior, and cross-cutting patterns.', enabled: true, order: 14, category: 'methods', hasDiagram: false, hasTable: true },
    { id: 'configuration', title: 'Configuration & Environment', description: 'Environment variables, runtime settings, database config, external services, feature flags, secrets, telemetry, and build signals.', enabled: true, order: 15, category: 'config', hasDiagram: false, hasTable: true },
  ];
}

export function assembleSectionsToPrompt(sections: TemplateSection[], optionalNotes?: string): string {
  const enabled = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const sectionPrompts = enabled
    .map((s) => SECTION_PROMPT_MAP[s.id])
    .filter(Boolean);

  let prompt = PREAMBLE_PROMPT + '\n\nOUTPUT\nProduce ONE Markdown document with the following sections and professional writing throughout:\n';
  prompt += sectionPrompts.join('\n\n');
  prompt += '\n\n' + QUALITY_GATES_PROMPT;

  if (optionalNotes) {
    prompt += '\n\n' + optionalNotes;
  }

  return prompt;
}

// Legacy single-string template for backward compatibility
export const DEFAULT_DAMAC_TEMPLATE = assembleSectionsToPrompt(getDefaultSections());
