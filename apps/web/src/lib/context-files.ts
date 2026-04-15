import * as path from 'path';

const MAX_CONTEXT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CONTEXT_EXTRACTED_TEXT_CHARS = 16000;

const TEXT_LIKE_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.json', '.yaml', '.yml', '.xml', '.csv', '.tsv',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php',
  '.cs', '.kt', '.swift', '.scala', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.html', '.css', '.scss', '.less', '.graphql', '.gql', '.env', '.ini',
  '.cfg', '.conf', '.toml', '.properties', '.log', '.txt', '.proto',
]);

function isTextLike(fileName: string, mimeType?: string | null): boolean {
  const extension = path.extname(fileName).toLowerCase();
  if (TEXT_LIKE_EXTENSIONS.has(extension)) return true;
  if (!mimeType) return false;
  return mimeType.startsWith('text/')
    || mimeType.includes('json')
    || mimeType.includes('xml')
    || mimeType.includes('javascript')
    || mimeType.includes('typescript');
}

export function validateContextFile(fileName: string, fileSize: number, mimeType?: string | null) {
  if (!fileName) {
    return { valid: false, message: 'File name is required' };
  }

  if (fileSize <= 0) {
    return { valid: false, message: 'File is empty' };
  }

  if (fileSize > MAX_CONTEXT_FILE_SIZE_BYTES) {
    return { valid: false, message: 'Context file size exceeds maximum of 10MB' };
  }

  if (!isTextLike(fileName, mimeType)) {
    return {
      valid: false,
      message: 'Only text, markdown, config, and source-code files are supported for context uploads',
    };
  }

  return { valid: true };
}

export function extractContextText(buffer: Buffer): string {
  const text = buffer.toString('utf8').replace(/\0/g, '').trim();
  if (!text) return '';
  if (text.length <= MAX_CONTEXT_EXTRACTED_TEXT_CHARS) return text;

  return `${text.slice(0, MAX_CONTEXT_EXTRACTED_TEXT_CHARS)}\n\n[Truncated due to length]`;
}

// ---------------------------------------------------------------------------
// File classification — shared by generation and AI edit
// ---------------------------------------------------------------------------

export interface ClassifiedFile {
  name: string;
  content: string;
  fileType: string;
  guidance: string;
}

export function classifyContextFile(name: string, content: string): ClassifiedFile {
  const ext = path.extname(name).toLowerCase();
  const baseName = path.basename(name).toLowerCase();

  if (baseName.includes('openapi') || baseName.includes('swagger') || content.includes('"openapi"') || content.includes('openapi:')) {
    return {
      name, content,
      fileType: 'OpenAPI/Swagger Specification',
      guidance: 'This is an API specification. Use it to document API endpoints, request/response schemas, parameters, and status codes. Map each path+method to the corresponding API Specification subsection.',
    };
  }

  if (ext === '.sql' || baseName.includes('schema') || baseName.includes('migration')) {
    return {
      name, content,
      fileType: 'Database Schema / SQL',
      guidance: 'This contains database schema definitions. Use it to document data models, entity relationships, table structures, column types, constraints, and indexes in the Data Design section.',
    };
  }

  if (ext === '.graphql' || ext === '.gql') {
    return {
      name, content,
      fileType: 'GraphQL Schema',
      guidance: 'This is a GraphQL schema. Use it to document type definitions, queries, mutations, subscriptions, and their input/output shapes in the API Specification section.',
    };
  }

  if (ext === '.proto') {
    return {
      name, content,
      fileType: 'Protocol Buffers Definition',
      guidance: 'This is a protobuf definition. Use it to document service definitions, message types, and RPC method signatures.',
    };
  }

  if (baseName === 'package.json' || baseName === 'cargo.toml' || baseName === 'go.mod' || baseName === 'requirements.txt' || baseName === 'pom.xml' || baseName.includes('build.gradle')) {
    return {
      name, content,
      fileType: 'Dependency / Build Configuration',
      guidance: 'This contains project dependencies and build configuration. Use it to document technology stack references, dependency versions, and build pipeline details.',
    };
  }

  if (baseName.includes('docker') || baseName === 'docker-compose.yml' || baseName === 'docker-compose.yaml') {
    return {
      name, content,
      fileType: 'Docker / Container Configuration',
      guidance: 'This contains container and deployment configuration. Use it to document deployment architecture, service topology, container settings, and runtime environment details.',
    };
  }

  if (ext === '.env' || baseName.includes('.env.')) {
    return {
      name, content,
      fileType: 'Environment Configuration',
      guidance: 'This contains environment variable definitions. Use it to document the Configuration & Environment section. Do NOT include actual secret values — document only the variable names, types, and purposes.',
    };
  }

  if (ext === '.md' || ext === '.mdx' || ext === '.txt') {
    return {
      name, content,
      fileType: 'Documentation / Text',
      guidance: 'This is a documentation or reference file. Extract relevant technical details, requirements, or architectural decisions to inform the generated documentation.',
    };
  }

  if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml' || ext === '.ini' || ext === '.cfg') {
    return {
      name, content,
      fileType: 'Configuration File',
      guidance: 'This is a configuration file. Use it to document relevant configuration details, settings, and parameters in the appropriate section.',
    };
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb', '.php', '.cs', '.kt', '.swift'].includes(ext)) {
    return {
      name, content,
      fileType: 'Source Code',
      guidance: 'This is source code. Analyze its structure, classes, functions, imports, and patterns to inform accurate technical documentation. Extract method signatures, data types, error handling patterns, and architectural patterns.',
    };
  }

  return {
    name, content,
    fileType: 'Reference File',
    guidance: 'Use this file as additional context. Extract relevant information as appropriate.',
  };
}

// ---------------------------------------------------------------------------
// Prompt assembly for classified context files
// ---------------------------------------------------------------------------

export function buildContextFilesPromptText(
  contextFiles: Array<{ originalFileName: string; extractedText: string }>,
  userInstructions?: string | null,
): string {
  const filesWithContent = contextFiles.filter((f) => f.extractedText.trim().length > 0);
  if (filesWithContent.length === 0 && !userInstructions?.trim()) return '';

  const parts: string[] = [];
  parts.push('ADDITIONAL PROJECT CONTEXT FILES');
  parts.push('The following context files have been provided as supplementary reference material for generating the TDD.');
  parts.push('Treat each file as an authoritative source for its domain — extract concrete data (types, endpoints, schemas, names, parameters) rather than paraphrasing vaguely.');

  if (userInstructions?.trim()) {
    parts.push('');
    parts.push('USER INSTRUCTIONS FOR CONTEXT FILES');
    parts.push(userInstructions.trim());
  }

  for (const file of filesWithContent) {
    const classified = classifyContextFile(file.originalFileName, file.extractedText);
    parts.push('');
    parts.push(`--- ${classified.name} [${classified.fileType}] ---`);
    parts.push(`Context: ${classified.guidance}`);
    parts.push('');
    parts.push(classified.content);
  }

  return `\n\n${parts.join('\n')}`;
}
