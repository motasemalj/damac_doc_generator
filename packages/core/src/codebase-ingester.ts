import * as fs from 'fs';
import * as path from 'path';
import {
  KEY_FILE_PATTERNS,
  CODE_ROUTE_PATTERNS,
  CODE_MODEL_PATTERNS,
  MAX_FILE_CONTENT_LENGTH,
  MAX_SUMMARY_PACK_SIZE,
  BLOCKED_FILE_EXTENSIONS,
} from '@damac/shared';
import type { FileTreeNode, CodebaseSummary } from '@damac/shared';

export class CodebaseIngester {
  static buildFileTree(dirPath: string, basePath: string = ''): FileTreeNode[] {
    const nodes: FileTreeNode[] = [];
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return nodes;
    }

    const skipDirs = new Set([
      'node_modules', '.git', '.next', 'dist', 'build', 'out',
      '__pycache__', '.venv', 'venv', '.tox', 'target',
      'vendor', '.gradle', '.idea', '.vscode', 'coverage',
      '.turbo', '.cache', 'tmp', 'temp',
    ]);

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) || entry.name.startsWith('.')) continue;
        const children = this.buildFileTree(fullPath, relPath);
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children,
        });
      } else {
        const isBlocked = BLOCKED_FILE_EXTENSIONS.some((ext) =>
          entry.name.toLowerCase().endsWith(ext),
        );
        if (isBlocked) continue;

        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch {
          // skip
        }

        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size,
        });
      }
    }

    return nodes;
  }

  static flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
    const flat: FileTreeNode[] = [];
    for (const node of nodes) {
      flat.push(node);
      if (node.children) {
        flat.push(...this.flattenTree(node.children));
      }
    }
    return flat;
  }

  static treeToString(nodes: FileTreeNode[], indent: string = ''): string {
    let result = '';
    for (const node of nodes) {
      if (node.type === 'directory') {
        result += `${indent}${node.name}/\n`;
        if (node.children) {
          result += this.treeToString(node.children, indent + '  ');
        }
      } else {
        result += `${indent}${node.name}\n`;
      }
    }
    return result;
  }

  static identifyKeyFiles(dirPath: string, tree: FileTreeNode[]): string[] {
    const flatFiles = this.flattenTree(tree).filter((n) => n.type === 'file');
    const keyPaths: string[] = [];

    for (const file of flatFiles) {
      const name = file.name.toLowerCase();
      const relPath = file.path;

      if (KEY_FILE_PATTERNS.some((p) => name === p.toLowerCase())) {
        keyPaths.push(relPath);
        continue;
      }

      if (CODE_ROUTE_PATTERNS.some((p) => p.test(relPath))) {
        keyPaths.push(relPath);
        continue;
      }

      if (CODE_MODEL_PATTERNS.some((p) => p.test(relPath))) {
        keyPaths.push(relPath);
        continue;
      }
    }

    return keyPaths;
  }

  static readFileContent(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.length > MAX_FILE_CONTENT_LENGTH) {
        return content.substring(0, MAX_FILE_CONTENT_LENGTH) + '\n... [truncated]';
      }
      return content;
    } catch {
      return '';
    }
  }

  static detectLanguages(tree: FileTreeNode[]): string[] {
    const extMap: Record<string, string> = {
      '.ts': 'TypeScript', '.tsx': 'TypeScript',
      '.js': 'JavaScript', '.jsx': 'JavaScript',
      '.py': 'Python', '.java': 'Java',
      '.go': 'Go', '.rs': 'Rust',
      '.rb': 'Ruby', '.php': 'PHP',
      '.cs': 'C#', '.cpp': 'C++', '.c': 'C',
      '.swift': 'Swift', '.kt': 'Kotlin',
      '.scala': 'Scala', '.dart': 'Dart',
    };

    const langs = new Set<string>();
    const flat = this.flattenTree(tree).filter((n) => n.type === 'file');

    for (const file of flat) {
      const ext = path.extname(file.name).toLowerCase();
      if (extMap[ext]) {
        langs.add(extMap[ext]);
      }
    }

    return Array.from(langs);
  }

  static buildSummaryPack(extractedDir: string): CodebaseSummary {
    const fileTree = this.buildFileTree(extractedDir);
    const flatFiles = this.flattenTree(fileTree).filter((n) => n.type === 'file');
    const totalSize = flatFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    const languages = this.detectLanguages(fileTree);
    const keyFilePaths = this.identifyKeyFiles(extractedDir, fileTree);

    const keyFiles: { path: string; content: string }[] = [];
    let totalContentSize = 0;

    for (const relPath of keyFilePaths) {
      if (totalContentSize >= MAX_SUMMARY_PACK_SIZE) break;
      const fullPath = path.join(extractedDir, relPath);
      const content = this.readFileContent(fullPath);
      if (content) {
        totalContentSize += content.length;
        keyFiles.push({ path: relPath, content });
      }
    }

    return {
      fileTree,
      totalFiles: flatFiles.length,
      totalSize,
      keyFiles,
      languages,
    };
  }

  static summaryToPromptText(summary: CodebaseSummary): string {
    let prompt = '## CODEBASE ANALYSIS\n\n';
    prompt += `### Repository Statistics\n`;
    prompt += `- Total Files: ${summary.totalFiles}\n`;
    prompt += `- Total Size: ${(summary.totalSize / 1024).toFixed(1)} KB\n`;
    prompt += `- Languages: ${summary.languages.join(', ') || 'Unknown'}\n\n`;

    prompt += `### File Tree\n\`\`\`\n${this.treeToString(summary.fileTree)}\`\`\`\n\n`;

    prompt += `### Key Files Content\n\n`;
    for (const file of summary.keyFiles) {
      const ext = path.extname(file.path).replace('.', '') || 'text';
      prompt += `#### ${file.path}\n\`\`\`${ext}\n${file.content}\n\`\`\`\n\n`;
    }

    let result = prompt;
    if (result.length > MAX_SUMMARY_PACK_SIZE) {
      result = result.substring(0, MAX_SUMMARY_PACK_SIZE) + '\n\n[Content truncated due to size limits]';
    }

    return result;
  }
}
