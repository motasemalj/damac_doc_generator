import { MAX_UPLOAD_SIZE_BYTES, ALLOWED_UPLOAD_EXTENSIONS, BLOCKED_FILE_EXTENSIONS } from './constants';

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain an uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain a lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain a number' };
  return { valid: true };
}

export function validateUploadFile(
  fileName: string,
  fileSize: number,
): { valid: boolean; message?: string } {
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return { valid: false, message: `Only ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')} files are allowed` };
  }

  if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
    return { valid: false, message: `File size exceeds maximum of ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB` };
  }

  return { valid: true };
}

export function isBlockedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return BLOCKED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateTemplateName(name: string): { valid: boolean; message?: string } {
  if (!name || name.trim().length === 0) return { valid: false, message: 'Template name is required' };
  if (name.length > 200) return { valid: false, message: 'Template name must be under 200 characters' };
  return { valid: true };
}

const TEMPLATE_VAR_REGEX = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
const MALFORMED_VAR_REGEX = /\{\{[^}]*$|\{[^{]|[^}]\}/;

export function extractTemplateVariables(promptText: string): string[] {
  const vars = new Set<string>();
  let match;
  while ((match = TEMPLATE_VAR_REGEX.exec(promptText)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

export function validateTemplatePrompt(promptText: string): { valid: boolean; message?: string } {
  if (!promptText || promptText.trim().length === 0) {
    return { valid: false, message: 'Template prompt text is required' };
  }

  const lines = promptText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const braces = lines[i].match(/\{+|\}+/g);
    if (braces) {
      for (const b of braces) {
        if (b.length === 1) {
          continue;
        }
        if (b.length > 2) {
          return { valid: false, message: `Malformed expression on line ${i + 1}: too many braces` };
        }
      }
    }
  }

  return { valid: true };
}

export function substituteTemplateVariables(
  promptText: string,
  variables: Record<string, string>,
): { result: string; unresolvedVars: string[] } {
  const unresolved: string[] = [];
  const result = promptText.replace(TEMPLATE_VAR_REGEX, (match, varName) => {
    if (varName in variables && variables[varName] !== undefined && variables[varName] !== '') {
      return variables[varName];
    }
    unresolved.push(varName);
    return '';
  });
  return { result, unresolvedVars: unresolved };
}

export function hasUnresolvedTemplateVars(text: string): boolean {
  return TEMPLATE_VAR_REGEX.test(text);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
}
