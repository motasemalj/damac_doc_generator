import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUploadFile,
  isBlockedFile,
  extractTemplateVariables,
  substituteTemplateVariables,
  hasUnresolvedTemplateVars,
  sanitizeFileName,
} from '../validators';

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('a@b.co')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('nope')).toBe(false);
    expect(validateEmail('@no.com')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should accept strong password', () => {
    expect(validatePassword('MyPass123').valid).toBe(true);
  });

  it('should reject short password', () => {
    expect(validatePassword('Ab1').valid).toBe(false);
  });

  it('should reject no uppercase', () => {
    expect(validatePassword('mypass123').valid).toBe(false);
  });

  it('should reject no number', () => {
    expect(validatePassword('MyPassword').valid).toBe(false);
  });
});

describe('validateUploadFile', () => {
  it('should accept zip file within size limit', () => {
    expect(validateUploadFile('project.zip', 1024).valid).toBe(true);
  });

  it('should reject non-zip file', () => {
    expect(validateUploadFile('file.exe', 1024).valid).toBe(false);
  });

  it('should reject oversized file', () => {
    expect(validateUploadFile('big.zip', 200 * 1024 * 1024).valid).toBe(false);
  });
});

describe('isBlockedFile', () => {
  it('should block exe files', () => {
    expect(isBlockedFile('virus.exe')).toBe(true);
  });

  it('should allow ts files', () => {
    expect(isBlockedFile('index.ts')).toBe(false);
  });
});

describe('extractTemplateVariables', () => {
  it('should extract variables', () => {
    const vars = extractTemplateVariables('{{FOO}} and {{BAR}}');
    expect(vars).toEqual(['FOO', 'BAR']);
  });
});

describe('substituteTemplateVariables', () => {
  it('should substitute provided values', () => {
    const { result } = substituteTemplateVariables('Hello {{NAME}}', { NAME: 'World' });
    expect(result).toBe('Hello World');
  });

  it('should track unresolved variables', () => {
    const { unresolvedVars } = substituteTemplateVariables('{{FOO}} {{BAR}}', { FOO: 'yes' });
    expect(unresolvedVars).toEqual(['BAR']);
  });
});

describe('hasUnresolvedTemplateVars', () => {
  it('should detect unresolved vars', () => {
    expect(hasUnresolvedTemplateVars('still has {{VAR}}')).toBe(true);
  });

  it('should pass resolved text', () => {
    expect(hasUnresolvedTemplateVars('no vars here')).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('should replace special characters', () => {
    expect(sanitizeFileName('my file (1).zip')).toBe('my_file__1_.zip');
  });
});
