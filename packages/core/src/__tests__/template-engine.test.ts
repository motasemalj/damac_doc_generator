import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../template-engine';

describe('TemplateEngine', () => {
  describe('extractVariables', () => {
    it('should extract template variables', () => {
      const vars = TemplateEngine.extractVariables('Hello {{SYSTEM_NAME}}, notes: {{OPTIONAL_NOTES}}');
      expect(vars).toEqual(['SYSTEM_NAME', 'OPTIONAL_NOTES']);
    });

    it('should return empty array for no variables', () => {
      const vars = TemplateEngine.extractVariables('No variables here');
      expect(vars).toEqual([]);
    });

    it('should deduplicate variables', () => {
      const vars = TemplateEngine.extractVariables('{{VAR}} and {{VAR}} again');
      expect(vars).toEqual(['VAR']);
    });
  });

  describe('validate', () => {
    it('should accept valid template', () => {
      const result = TemplateEngine.validate('Generate a TDD for {{SYSTEM_NAME}}');
      expect(result.valid).toBe(true);
    });

    it('should reject empty template', () => {
      const result = TemplateEngine.validate('');
      expect(result.valid).toBe(false);
    });

    it('should reject triple braces', () => {
      const result = TemplateEngine.validate('Bad {{{VAR}}}');
      expect(result.valid).toBe(false);
    });
  });

  describe('render', () => {
    it('should substitute variables', () => {
      const { result, warnings } = TemplateEngine.render(
        'System: {{SYSTEM_NAME}}, Notes: {{OPTIONAL_NOTES}}',
        { SYSTEM_NAME: 'MyApp', OPTIONAL_NOTES: 'Focus on security' },
      );
      expect(result).toBe('System: MyApp, Notes: Focus on security');
      expect(warnings).toHaveLength(0);
    });

    it('should warn on missing required variable', () => {
      const { result, warnings } = TemplateEngine.render(
        'System: {{SYSTEM_NAME}}',
        {},
      );
      expect(result).toBe('System: ');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should not warn on missing optional variable', () => {
      const { result, warnings } = TemplateEngine.render(
        'Notes: {{OPTIONAL_NOTES}}',
        {},
      );
      expect(result).toBe('Notes: ');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('preview', () => {
    it('should show placeholder names for unset variables', () => {
      const result = TemplateEngine.preview(
        'System: {{SYSTEM_NAME}}',
        {},
      );
      expect(result).toBe('System: [SYSTEM_NAME]');
    });

    it('should show actual values when provided', () => {
      const result = TemplateEngine.preview(
        'System: {{SYSTEM_NAME}}',
        { SYSTEM_NAME: 'MyApp' },
      );
      expect(result).toBe('System: MyApp');
    });
  });

  describe('buildVariablesSchema', () => {
    it('should build schema from template', () => {
      const schema = TemplateEngine.buildVariablesSchema('{{SYSTEM_NAME}} {{OPTIONAL_NOTES}}');
      expect(schema).toHaveLength(2);
      expect(schema[0].name).toBe('SYSTEM_NAME');
      expect(schema[0].required).toBe(true);
      expect(schema[1].name).toBe('OPTIONAL_NOTES');
      expect(schema[1].required).toBe(false);
    });
  });
});
