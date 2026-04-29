import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const TEMPLATES_DIR = path.resolve(__dirname, '../../../../dsl-templates/一些模板');

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode: string;
  category: string;
  yamlContent: string;
}

const ICON_MAP: Record<string, string> = {
  clown_face: '🤡',
  exploding_head: '🤯',
  face_vomiting: '🤮',
  laughing: '😆',
  space_invader: '👾',
};

function resolveIcon(icon: string | undefined): string {
  if (!icon) return '🤖';
  if (ICON_MAP[icon]) return ICON_MAP[icon];
  // Already an emoji or other displayable character
  if (icon.length <= 2) return icon;
  // Unknown text icon name → fallback
  return '🤖';
}

const CATEGORY_MAP: Record<string, string> = {
  '01_内容生成与创作': '内容生成与创作',
  '05_文档处理与OCR': '文档处理与OCR',
  '14_参考示例': '参考示例',
};

function scanDir(dir: string, category: string): TemplateMeta[] {
  const results: TemplateMeta[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, category));
    } else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = yaml.load(content) as any;
        const app = parsed?.app || {};
        const cat = CATEGORY_MAP[category] || category;
        results.push({
          id: Buffer.from(fullPath).toString('base64url').slice(0, 24),
          name: app.name || entry.name.replace(/\.ya?ml$/, ''),
          description: (app.description || '').slice(0, 200),
          icon: resolveIcon(app.icon),
          mode: app.mode || 'unknown',
          category: cat,
          yamlContent: content,
        });
      } catch { /* skip invalid yaml */ }
    }
  }
  return results;
}

export function listTemplates(category?: string): TemplateMeta[] {
  const allTemplates: TemplateMeta[] = [];
  if (!fs.existsSync(TEMPLATES_DIR)) return allTemplates;

  const topDirs = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  for (const entry of topDirs) {
    if (!entry.isDirectory()) continue;
    const catKey = entry.name;
    allTemplates.push(...scanDir(path.join(TEMPLATES_DIR, entry.name), catKey));
  }

  if (category && category !== 'all') {
    return allTemplates.filter((t) => t.category === category);
  }
  return allTemplates;
}
