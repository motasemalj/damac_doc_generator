export { TemplateEngine } from './template-engine';
export { CodebaseIngester } from './codebase-ingester';
export { GenerationService } from './generation-service';
export { MarkdownSanitizer } from './markdown-sanitizer';
export {
  getDocumentStructure,
  normalizeGeneratedMarkdown,
} from './document-structure';
export {
  DEFAULT_DAMAC_TEMPLATE,
  getDefaultSections,
  assembleSectionsToPrompt,
  SECTION_PROMPT_MAP,
  PREAMBLE_PROMPT,
  QUALITY_GATES_PROMPT,
} from './default-template';
export type { TemplateSection } from './default-template';
