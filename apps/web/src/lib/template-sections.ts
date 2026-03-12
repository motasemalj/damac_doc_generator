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

const AVAILABLE_TEMPLATE_SECTIONS: TemplateSection[] = [
  { id: 'cover_page', title: 'Cover Page & Table of Contents', description: 'Title page with system name, DAMAC logo, and a structured table of contents.', enabled: true, order: 0, category: 'cover', hasDiagram: false, hasTable: false },
  { id: 'executive_summary', title: 'Executive Summary', description: 'Non-technical overview of what the system does, who uses it, and the outcomes it enables.', enabled: true, order: 1, category: 'overview', hasDiagram: false, hasTable: false },
  { id: 'purpose_introduction', title: 'Purpose & Introduction', description: 'Why this document exists, scope, primary actors, and high-level workflows.', enabled: true, order: 2, category: 'overview', hasDiagram: false, hasTable: false },
  { id: 'system_specification', title: 'System Specification', description: 'Capabilities overview and API conventions observed in the codebase.', enabled: true, order: 3, category: 'specification', hasDiagram: false, hasTable: false },
  { id: 'functional_requirements', title: 'Functional Requirements', description: 'Business-readable requirements derived from code behavior.', enabled: true, order: 4, category: 'specification', hasDiagram: false, hasTable: false },
  { id: 'nonfunctional_requirements', title: 'Non-functional Requirements', description: 'Performance, reliability, security, and quality attributes.', enabled: true, order: 5, category: 'specification', hasDiagram: false, hasTable: false },
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

const SECTION_BY_ID = new Map(
  AVAILABLE_TEMPLATE_SECTIONS.map((section) => [section.id, section]),
);

export function getAvailableTemplateSections(): TemplateSection[] {
  return AVAILABLE_TEMPLATE_SECTIONS.map((section) => ({ ...section }));
}

export function normalizeTemplateSections(rawSections: unknown): TemplateSection[] {
  if (!Array.isArray(rawSections)) return [];

  const deduped: TemplateSection[] = [];
  const seen = new Set<string>();

  for (const [index, rawSection] of rawSections.entries()) {
    if (!rawSection || typeof rawSection !== 'object') continue;

    const sectionId = 'id' in rawSection && typeof rawSection.id === 'string'
      ? rawSection.id
      : null;
    if (!sectionId || seen.has(sectionId)) continue;

    const baseSection = SECTION_BY_ID.get(sectionId);
    if (!baseSection) continue;

    seen.add(sectionId);

    deduped.push({
      ...baseSection,
      enabled: typeof (rawSection as { enabled?: unknown }).enabled === 'boolean'
        ? Boolean((rawSection as { enabled?: unknown }).enabled)
        : baseSection.enabled,
      order: typeof (rawSection as { order?: unknown }).order === 'number'
        ? Number((rawSection as { order?: unknown }).order)
        : index,
    });
  }

  return deduped
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));
}

export function parseTemplateSections(
  rawSectionsSchema: string | null | undefined,
  fallbackSections: TemplateSection[] = [],
): TemplateSection[] {
  if (!rawSectionsSchema) {
    return fallbackSections.map((section, index) => ({ ...section, order: index }));
  }

  try {
    const parsed = JSON.parse(rawSectionsSchema);
    const normalized = normalizeTemplateSections(parsed);
    if (normalized.length > 0) return normalized;
  } catch {
    // Ignore malformed JSON and fall back below.
  }

  return fallbackSections.map((section, index) => ({ ...section, order: index }));
}
