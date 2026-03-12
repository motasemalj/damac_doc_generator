import * as path from 'path';

const MAX_CONTEXT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CONTEXT_EXTRACTED_TEXT_CHARS = 16000;

const TEXT_LIKE_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.json', '.yaml', '.yml', '.xml', '.csv', '.tsv',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.rb', '.php',
  '.cs', '.kt', '.swift', '.scala', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.html', '.css', '.scss', '.less', '.graphql', '.gql', '.env', '.ini',
  '.cfg', '.conf', '.toml', '.properties', '.log', '.txt',
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

export function buildContextFilesPromptText(
  contextFiles: Array<{ originalFileName: string; extractedText: string }>,
): string {
  if (contextFiles.length === 0) return '';

  const sections = contextFiles
    .filter((file) => file.extractedText.trim().length > 0)
    .map((file, index) => [
      `Context File ${index + 1}: ${file.originalFileName}`,
      file.extractedText.trim(),
    ].join('\n'))
    .join('\n\n---\n\n');

  if (!sections) return '';

  return `\n\nADDITIONAL PROJECT CONTEXT FILES\nUse the following supporting project context alongside the codebase snapshot when generating the TDD. These files may contain business context, requirements, reference snippets, or supporting technical notes.\n\n${sections}`;
}
