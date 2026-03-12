import {
  extractTemplateVariables,
  substituteTemplateVariables,
  hasUnresolvedTemplateVars,
  validateTemplatePrompt,
} from '@damac/shared';
import type { TemplateVariable } from '@damac/shared';

export class TemplateEngine {
  static extractVariables(promptText: string): string[] {
    return extractTemplateVariables(promptText);
  }

  static buildVariablesSchema(promptText: string): TemplateVariable[] {
    const varNames = extractTemplateVariables(promptText);
    return varNames.map((name) => ({
      name,
      label: name
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' '),
      required: !name.startsWith('OPTIONAL'),
      defaultValue: '',
    }));
  }

  static validate(promptText: string): { valid: boolean; message?: string } {
    return validateTemplatePrompt(promptText);
  }

  static render(
    promptText: string,
    variables: Record<string, string>,
  ): { result: string; warnings: string[] } {
    const warnings: string[] = [];
    const { result, unresolvedVars } = substituteTemplateVariables(promptText, variables);

    for (const v of unresolvedVars) {
      if (!v.startsWith('OPTIONAL')) {
        warnings.push(`Required variable {{${v}}} was not provided`);
      }
    }

    if (hasUnresolvedTemplateVars(result)) {
      const remaining = extractTemplateVariables(result);
      const requiredRemaining = remaining.filter((v) => !v.startsWith('OPTIONAL'));
      if (requiredRemaining.length > 0) {
        warnings.push(`Unresolved required variables: ${requiredRemaining.join(', ')}`);
      }
    }

    return { result, warnings };
  }

  static preview(
    promptText: string,
    variables: Record<string, string>,
  ): string {
    const sampleVars: Record<string, string> = {};
    const allVars = extractTemplateVariables(promptText);
    for (const v of allVars) {
      sampleVars[v] = variables[v] || `[${v}]`;
    }
    const { result } = substituteTemplateVariables(promptText, sampleVars);
    return result;
  }
}
