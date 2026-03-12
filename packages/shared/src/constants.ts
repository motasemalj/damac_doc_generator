export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_UPLOAD_SIZE_LABEL = '100MB';

export const ALLOWED_UPLOAD_EXTENSIONS = ['.zip'];
export const BLOCKED_FILE_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.sh',
  '.msi', '.app', '.dmg', '.pkg', '.deb', '.rpm',
  '.com', '.scr', '.pif', '.vbs', '.js.map',
];

export const ALLOWED_EXTRACTABLE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
  '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css',
  '.scss', '.less', '.md', '.txt', '.env.example',
  '.sql', '.graphql', '.gql', '.proto',
  '.dockerfile', '.dockerignore', '.gitignore',
  '.editorconfig', '.prettierrc', '.eslintrc',
  '.lock', '.prisma', '.tf', '.hcl',
];

export const KEY_FILE_PATTERNS = [
  'README.md', 'README.txt', 'README',
  'package.json', 'tsconfig.json',
  'requirements.txt', 'setup.py', 'pyproject.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Cargo.toml', 'go.mod', 'Gemfile',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
  '.env.example', '.env.sample',
  'openapi.yaml', 'openapi.json', 'swagger.yaml', 'swagger.json',
  'schema.prisma', 'schema.graphql',
];

export const CODE_ROUTE_PATTERNS = [
  /routes?\//i,
  /controllers?\//i,
  /api\//i,
  /endpoints?\//i,
  /handlers?\//i,
];

export const CODE_MODEL_PATTERNS = [
  /models?\//i,
  /entities?\//i,
  /schemas?\//i,
  /types?\//i,
  /interfaces?\//i,
];

export const MAX_FILE_CONTENT_LENGTH = 10000;
export const MAX_SUMMARY_PACK_SIZE = 120000;

export const GENERATION_RATE_LIMIT_PER_HOUR = 10;
export const GENERATION_MAX_RETRIES = 3;

export const DAMAC_BRAND = {
  name: 'DAMAC',
  productName: 'DocGen',
  fullProductName: 'DAMAC DocGen',
  tagline: 'Intelligent Technical Documentation Platform',
  colors: {
    primary: '#1B2B4B',
    primaryLight: '#2D4A7A',
    accent: '#C5A572',
    accentLight: '#D4BA8A',
    background: '#FAFBFC',
    surface: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
  },
} as const;

export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-pro';
export const OPENAI_MAX_TOKENS = 128000;
