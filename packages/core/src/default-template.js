export const SECTION_PROMPT_MAP = {
    cover_page: `Cover page with a SINGLE H1 title in this exact pattern: "<System Name> - Technical Design Documentation". Do NOT output a standalone heading that is only "Technical Design Documentation".
Write the text <!-- DAMAC_LOGO --> on its own line where the logo should appear. Do NOT use any image markdown or URLs for the logo — only that exact HTML comment placeholder.
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

SECTION STRUCTURE (CRITICAL — applies ONLY to this Technical Approach section):
- This section is organized BY COMPONENT, not by topic.
- Each major system component gets its own numbered subsection (3.1, 3.2, 3.3, …) with four mandatory sub-sections: Architecture Overview, Process Flow, High-Level Flow Overview, and Detailed Step-by-Step Flow.
- After all per-component subsections, cross-cutting concerns (End-to-End Flows, Data Design, Security, Error Handling, Observability, Deployment) continue the Section 3 numbering.

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
    configuration: `Configuration & Environment
- 1–2 introductory paragraphs describing the overarching configuration strategy and how configuration controls runtime behavior across environments.

X.1 Environment Variables
- 1–2 paragraphs describing the role of environment variables in the system, how they are loaded/resolved, and the expected deployment-time setup.
- ONLY list variables that are actually referenced in the codebase (e.g., in .env.example, process.env, os.environ, or config loaders).
- Table:
| Variable | Required | Default | Description |
|---|---:|---|---|

X.2 Config Files
- 1–2 paragraphs describing the configuration files present in the repository (e.g., .env.example, config.yaml, appsettings.json, tsconfig.json, docker-compose.yml) and the role each plays.
- List ONLY files that actually exist in the codebase — do not infer or assume configuration files.
- Table:
| File | Format | Purpose | Environment-Specific |
|---|---|---|---:|

X.3 Secrets
- 1–2 paragraphs describing how secrets, API keys, certificates, and sensitive configuration values are managed and injected at runtime.
- Describe the mechanism used (e.g., environment variables, vault, sealed secrets, encrypted config) based on what the code actually shows.
- Do NOT reveal actual secret values — describe the configuration shape and management approach only.
- Do NOT assume secret management tools unless they are referenced in the codebase.`,
    system_overview: `System Overview
- Derive ALL content strictly from what is observable in the codebase (README, package.json, config files, code structure, comments, and naming conventions).
- Do NOT invent or assume system names, purposes, or user roles that are not evidenced in the repository.

System Name
- State the system/project name as found in the repository (e.g., from package.json "name" field, README title, or top-level project configuration).

Purpose
- 1–2 paragraphs describing what the system does based on its actual code, README, or documentation files.
- Focus on observable functionality — what the code actually implements, not what it could theoretically do.

Users
- 1 introductory paragraph summarizing the types of users or actors that interact with the system.
- Present users in a structured table for readability:
| User / Actor | Description | Access Point |
|---|---|---|
- Derive user types from authentication logic, role definitions, UI flows, API consumers, or README descriptions.
- If user roles are not explicitly defined in the codebase, describe the actors implied by the system's interfaces (e.g., "end users accessing the web UI", "API consumers", "administrators with access to admin routes").
- Do NOT fabricate user personas or roles that have no basis in the code.`,
    system_architecture: `System Architecture
- Derive ALL content from the actual codebase structure, dependencies, configuration files, and import patterns. Do NOT assume architectural patterns that are not evidenced.
- 1–2 introductory paragraphs summarizing the overall architectural style and how the system is organized.

X.1 High-Level Flow
- 1–2 paragraphs describing how requests or data flow through the system based on actual code paths (e.g., Client → API → Database, or Worker → Queue → Processor).
- Include a Mermaid flowchart or sequence diagram showing the high-level flow ONLY if the flow can be traced through the codebase.
- Caption + explanatory paragraph per diagram.

X.2 Main Components
- 1 introductory paragraph summarizing the major components identified in the codebase.
- For each component category below, describe ONLY what exists in the codebase. If a category has no corresponding code, omit it entirely rather than stating it is absent.
- Number each component that exists as a sub-subsection (X.2.1, X.2.2, X.2.3, …). Only include components that have corresponding code.

X.2.1 Frontend
- 1–2 paragraphs describing the frontend technology and structure if a frontend exists (e.g., React app, Next.js pages, Vue components). Mention the framework, routing approach, and component organization as observed in the code.

X.2.2 Backend
- 1–2 paragraphs describing the backend service(s), framework, and entry points as found in the code (e.g., Express server, FastAPI app, Spring Boot application).

X.2.3 Database
- 1–2 paragraphs describing the database technology and access patterns based on schema files, migration scripts, ORM configuration, or connection strings present in the codebase.

X.2.4 External Integrations
- 1–2 paragraphs listing external services the system connects to, derived from HTTP client calls, SDK imports, API key references, or integration configuration visible in the code.
- Do NOT assume integrations that are not referenced in the codebase.`,
    tech_stack: `Tech Stack
- List ONLY technologies that are actually present in the codebase — referenced in dependency files (package.json, requirements.txt, pom.xml, go.mod, Cargo.toml, Gemfile, etc.), import statements, configuration files, or Dockerfiles.
- Do NOT list technologies that are merely common in the ecosystem but not evidenced in this specific repository.
- 1–2 introductory paragraphs summarizing the technology choices and their sources (dependency files, config, etc.).
- Number each category as a subsection. Only include categories that have corresponding technologies in the codebase.

X.1 Backend
- List backend languages, frameworks, and libraries with their versions where available from dependency files.

X.2 Frontend
- List frontend frameworks, UI libraries, and build tools with their versions where available.

X.3 Database
- List database systems referenced in the codebase (connection strings, ORM configs, migration files, schema definitions).

X.4 Infrastructure
- List infrastructure tools and platforms referenced in the codebase (Docker, Kubernetes manifests, Terraform files, CI/CD configs, cloud provider SDKs).

X.5 Other Tools & Services
- List any additional tools, services, or libraries that don't fit the categories above (e.g., testing frameworks, linters, code generation tools, monitoring SDKs).
- Include version numbers where available from dependency files.`,
    codebase_structure: `Codebase Structure
- Derive ALL content from the actual repository file and folder layout. Do NOT describe hypothetical or recommended structures.

X.1 Repository
- 1–2 paragraphs describing the repository layout: monorepo vs single-repo, top-level organization, and any workspace or package management approach visible in the configuration.

X.2 Key Folders & Modules
- List the significant top-level and second-level directories with a brief factual description of what each contains, based on the files actually inside them.
- Table:
| Folder/Module | Purpose | Key Files |
|---|---|---|

X.3 Component Descriptions
- Each major component or package identified in the folder structure gets its own numbered sub-subsection (X.3.1, X.3.2, X.3.3, …).

X.3.N <Component/Package Name>
- 1–2 paragraphs describing its role based on its actual contents (entry points, exports, README, or naming conventions).
- Do NOT describe what a component "should" contain — describe only what it does contain.`,
    database_design: `Database Design
- Derive ALL content from actual schema files, migration scripts, ORM model definitions, or SQL files present in the codebase. Do NOT infer tables, fields, or relationships that are not defined.

Database Type
- 1 paragraph stating the database system(s) used, based on connection configuration, ORM setup, or schema file formats found in the codebase.

Key Tables / Collections
- List the tables, collections, or entities defined in the codebase with a brief description of each based on its fields and naming.
- Table:
| Table/Collection | Description | Key Fields |
|---|---|---|

Important Fields & Relationships
- 1–2 paragraphs describing the primary relationships between entities (foreign keys, references, embedded documents) as defined in schema files or model definitions.
- Include a Mermaid ER diagram showing the relationships ONLY for entities that are actually defined in the codebase.
- Caption + explanatory paragraph.
- Do NOT fabricate fields or relationships that are not present in the schema or model definitions.`,
    api_documentation: `API Documentation
- Document ONLY endpoints that are actually defined in the codebase (route definitions, controller methods, handler functions). Do NOT invent endpoints.
- If no API endpoints exist in the codebase, write a single paragraph stating that no API routes were identified.
- 1–2 introductory paragraphs describing the API structure, base paths, and any common conventions (response envelope, error format, versioning) observed in the code.

X.1 Endpoint Summary
- A summary table listing all endpoints discovered in the codebase:

| # | Endpoint | Method | Description | Auth Required |
|---:|---|---|---|---:|

X.2 Endpoint Details
- Each endpoint gets its own numbered sub-subsection (X.2.1, X.2.2, X.2.3, …).
- Keep each endpoint entry factual and concise. Do NOT pad with theoretical REST best practices or generic API descriptions.

X.2.N <HTTP METHOD> <PATH>
- 1 paragraph describing what this endpoint does and its business purpose.

X.2.N.1 Request
- Describe path parameters, query parameters, headers, and request body fields based on the actual handler code, validation schemas, or type definitions.
- Table (include only if the endpoint accepts parameters):
| Parameter | Location | Required | Type | Description |
|---|---|---:|---|---|

X.2.N.2 Response
- Describe the response structure based on return statements, response DTOs, or type definitions in the code.
- Table (include only if the response has a structured body):
| Field | Type | Description |
|---|---|---|
- Mention relevant HTTP status codes and error shapes in prose.

X.2.N.3 Auth Requirements
- State the authentication/authorization requirements based on middleware, decorators, or guard logic applied to the route. If no auth is applied, state that plainly.`,
    core_workflows: `Core Workflows
- Describe ONLY workflows that can be traced through the actual code paths. Do NOT invent user journeys or system behaviors that are not implemented.
- Each workflow should be a sequence of concrete steps that map to actual functions, handlers, or service calls in the codebase.

- For each major workflow identified in the codebase:

<Workflow Name>
- 1 paragraph describing what this workflow accomplishes and who/what triggers it.
- Numbered steps showing the sequence of actions:
  1. User action or trigger (based on UI components, API calls, or event handlers)
  2. System processing (based on actual service/handler logic)
  3. Data operations (based on actual database calls or state mutations)
  4. Response or outcome (based on actual return values or UI updates)
- Each step must reference actual code paths — do not describe generic or theoretical behavior.
- If error handling exists for the workflow, briefly note the failure path.

- Include Mermaid sequence diagrams for complex workflows that span multiple components.
- Caption + explanatory paragraph per diagram.`,
    integrations_external: `Integrations & External Services
- List ONLY services that are actually called, imported, or configured in the codebase. Do NOT assume integrations based on the type of application.
- If no external integrations exist, write a single paragraph noting that the system operates independently based on the analyzed codebase.
- 1–2 introductory paragraphs summarizing the external dependencies and integration approach.

X.1 List of Third-Party Services
- This subsection is MANDATORY — it must always be generated.
- Provide a summary table of ALL third-party services identified in the codebase. If no third-party services exist, include the heading with a brief paragraph stating the system has no external service dependencies.
- Table:
| # | Service | SDK/Client | Configuration Source |
|---:|---|---|---|

X.2 Purpose and Usage
- Each external service gets its own numbered sub-subsection (X.2.1, X.2.2, X.2.3, …).

X.2.N <Service Name>
- 1–2 paragraphs describing:
  - What the integration does based on how it is called in the code
  - Which parts of the system use it (specific modules, services, or handlers)
  - How it is configured (API keys, base URLs, client initialization)

X.3 Error & Failure Handling
- Each integration's error handling gets its own numbered sub-subsection (X.3.1, X.3.2, X.3.3, …).

X.3.N <Service Name> — Error Handling
- 1–2 paragraphs describing the error handling patterns visible in the code for this integration:
  - Try/catch blocks, retry logic, timeout configuration, fallback behavior
  - How failures propagate (thrown exceptions, error responses, logged warnings)
- If no explicit error handling exists for this integration, state that plainly rather than describing what "should" exist.`,
    security_overview: `Security
- Describe ONLY security measures that are actually implemented in the codebase. Do NOT claim compliance with standards, frameworks, or practices that are not evidenced in the code.

Authentication
- 1–2 paragraphs describing how user identity is established, based on actual authentication middleware, login handlers, token generation/validation, or session management code.
- Mention the specific mechanism (e.g., JWT tokens, session cookies, OAuth2 flows, API keys) only if implemented in the code.
- If no authentication mechanism exists, state that plainly.

Authorization
- 1–2 paragraphs describing how permissions and access control are enforced, based on actual middleware, guards, role checks, or policy definitions in the code.
- Describe what roles or permission levels exist only if they are defined in the codebase (e.g., in enums, database fields, or middleware logic).
- If no authorization logic exists, state that plainly.

- Do NOT claim RBAC, ABAC, OAuth2, SSO, or any other security pattern unless the implementation is clearly present in the codebase.
- Do NOT list generic security best practices or theoretical recommendations.`,
};
export const PREAMBLE_PROMPT = `Generate a professional, publication-quality Technical Design Document (TDD) for the target system using ONLY the content present in this repository's codebase.

NON-NEGOTIABLE RULES (NO INVENTION — ZERO HALLUCINATION TOLERANCE)
- Do NOT assume anything outside the codebase.
- Do NOT add features, integrations, roles, workflows, SLAs, or compliance claims unless clearly supported by code/config.
- Do NOT generate generic theoretical descriptions, boilerplate explanations, or industry best-practice filler. Every sentence must be grounded in the actual repository content.
- Do NOT use meaningless jargon or buzzwords (e.g., "leveraging cutting-edge microservices", "enterprise-grade scalability") unless the code actually demonstrates those patterns.
- Be comprehensive: include all modules/services/endpoints/models/jobs/configs present in the repo.
- If something is ambiguous, describe it cautiously and only at the level the code supports.
- Do NOT include "Evidence" columns/fields anywhere in the document.
- Do NOT write phrases like "not found in codebase", "not mentioned", "missing", or similar. If something isn't supported, simply don't claim it. If a required template area has limited signals, write a short neutral paragraph describing only what is visible.
- When listing technologies, tools, or services, include ONLY those actually referenced in dependency files, imports, or configuration — never pad lists with assumed or common-in-the-industry items.

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
- If a Technical Approach section is included, it has one subsection per major system component, each with Architecture Overview, Process Flow, High-Level Flow Overview, and Detailed Step-by-Step Flow. Cross-cutting concerns follow with continued numbering. Do NOT generate this section if it is not listed among the enabled sections.
- Method Details section covers all methods found in the codebase, or explicitly states none exist.
- Configuration section covers environment variables, config files, and secrets handling.
- ZERO HALLUCINATION CHECK: Re-read every claim in the document. If any technology, integration, feature, user role, endpoint, table, or workflow cannot be traced to a specific file or code pattern in the repository, remove it.
- No generic filler: every paragraph must convey specific, code-grounded information. Remove any sentence that could apply to any arbitrary system without modification.
- Tech Stack lists ONLY technologies from actual dependency/config files — no padding with assumed tools.
- API Documentation covers ONLY endpoints defined in route/controller files — no invented endpoints.
- Database Design describes ONLY tables/collections from schema/model files — no assumed data models.
- Core Workflows trace ONLY through actual code paths — no theoretical user journeys.
- Integrations list ONLY services with actual SDK imports, API calls, or configuration references.
- Security describes ONLY mechanisms with actual implementation code — no claimed compliance without evidence.`;
export function getDefaultSections() {
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
        { id: 'configuration', title: 'Configuration & Environment', description: 'Environment variables, config files, and secrets handling.', enabled: true, order: 15, category: 'config', hasDiagram: false, hasTable: true },
        { id: 'system_overview', title: 'System Overview', description: 'System name, purpose, and users derived from the codebase.', enabled: true, order: 16, category: 'overview', hasDiagram: false, hasTable: true },
        { id: 'system_architecture', title: 'System Architecture', description: 'High-level flow and main components (frontend, backend, database, external integrations).', enabled: true, order: 17, category: 'architecture', hasDiagram: true, hasTable: false },
        { id: 'tech_stack', title: 'Tech Stack', description: 'Backend, frontend, database, infrastructure, and other tools as found in dependency files.', enabled: true, order: 18, category: 'technical', hasDiagram: false, hasTable: true },
        { id: 'codebase_structure', title: 'Codebase Structure', description: 'Repository layout, key folders/modules, and component descriptions.', enabled: true, order: 19, category: 'technical', hasDiagram: false, hasTable: true },
        { id: 'database_design', title: 'Database Design', description: 'Database type, key tables/collections, and field relationships from schema definitions.', enabled: true, order: 20, category: 'technical', hasDiagram: true, hasTable: true },
        { id: 'api_documentation', title: 'API Documentation', description: 'Key endpoints with method, request, response, and auth requirements.', enabled: true, order: 21, category: 'api', hasDiagram: false, hasTable: true },
        { id: 'core_workflows', title: 'Core Workflows', description: 'User actions and system responses traced step-by-step through actual code paths.', enabled: true, order: 22, category: 'workflows', hasDiagram: true, hasTable: false },
        { id: 'integrations_external', title: 'Integrations & External Services', description: 'Third-party services, their purpose, usage, and error/failure handling.', enabled: true, order: 23, category: 'integrations', hasDiagram: false, hasTable: true },
        { id: 'security_overview', title: 'Security', description: 'Authentication and authorization mechanisms as implemented in the codebase.', enabled: true, order: 24, category: 'security', hasDiagram: false, hasTable: false },
    ];
}
export function assembleSectionsToPrompt(sections, optionalNotes) {
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
