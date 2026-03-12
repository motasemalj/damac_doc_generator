const DANGEROUS_HTML_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'input',
  'textarea', 'button', 'select', 'style', 'link', 'meta',
  'base', 'applet', 'frame', 'frameset', 'layer', 'ilayer',
];

const DANGEROUS_ATTRS = [
  'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
  'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur',
  'onsubmit', 'onreset', 'onchange', 'oninput',
];

export class MarkdownSanitizer {
  static sanitize(markdown: string): string {
    let result = markdown;

    for (const tag of DANGEROUS_HTML_TAGS) {
      const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      const closeRegex = new RegExp(`</${tag}>`, 'gi');
      result = result.replace(openRegex, '');
      result = result.replace(closeRegex, '');
    }

    for (const attr of DANGEROUS_ATTRS) {
      const attrRegex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      result = result.replace(attrRegex, '');
    }

    result = result.replace(/javascript\s*:/gi, '');
    result = result.replace(/data\s*:\s*text\/html/gi, '');
    result = result.replace(/vbscript\s*:/gi, '');

    return result;
  }

  static stripHtml(markdown: string): string {
    return markdown.replace(/<[^>]*>/g, '');
  }

  static isClean(markdown: string): boolean {
    for (const tag of DANGEROUS_HTML_TAGS) {
      if (new RegExp(`<${tag}[\\s>]`, 'i').test(markdown)) return false;
    }
    if (/javascript\s*:/i.test(markdown)) return false;
    return true;
  }
}
