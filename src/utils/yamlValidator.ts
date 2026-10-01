import { load } from 'js-yaml';

export interface QueryItem {
  id: string;
  q: string;
  max_results?: number;
  order?: 'relevance' | 'date' | 'rating' | 'title' | 'viewCount';
  relevance_language?: string;
  region_code?: string;
  published_after?: string;
  published_before?: string;
  safe_search?: 'none' | 'moderate' | 'strict';
}

export interface YamlDefaults {
  max_results?: number;
  order?: 'relevance' | 'date' | 'rating' | 'title' | 'viewCount';
  type?: string;
  safe_search?: 'none' | 'moderate' | 'strict';
}

export interface ParsedYamlSpec {
  version?: number;
  defaults?: YamlDefaults;
  queries: QueryItem[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: ParsedYamlSpec;
  queryCount: number;
}

const ALLOWED_ORDERS = ['relevance', 'date', 'rating', 'title', 'viewCount'] as const;
const ALLOWED_SAFE_SEARCH = ['none', 'moderate', 'strict'] as const;

export function validateYamlString(rawYaml: string): ValidationResult {
  if (!rawYaml || rawYaml.trim() === '') {
    return {
      valid: false,
      errors: ['YAML input is empty. Please enter or upload YAML.'],
      queryCount: 0,
    };
  }

  let data: unknown;
  try {
    data = load(rawYaml);
  } catch (err: any) {
    return {
      valid: false,
      errors: [`Syntax error: ${err?.message || 'Invalid YAML format'}`],
      queryCount: 0,
    };
  }

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Root YAML must be an object/mapping containing "queries".'],
      queryCount: 0,
    };
  }

  const obj = data as Partial<ParsedYamlSpec>;
  const errors: string[] = [];

  if (!('queries' in obj)) {
    errors.push('Missing required "queries" list in YAML root.');
    return { valid: false, errors, queryCount: 0 };
  }

  if (!Array.isArray(obj.queries)) {
    errors.push('The "queries" field must be a YAML list/array.');
    return { valid: false, errors, queryCount: 0 };
  }

  if (obj.queries.length === 0) {
    errors.push('"queries" must contain at least one query item.');
    return { valid: false, errors, queryCount: 0 };
  }

  // Validate defaults if present
  if (obj.defaults) {
    if (typeof obj.defaults !== 'object' || Array.isArray(obj.defaults)) {
      errors.push('"defaults" must be a key-value mapping.');
    } else {
      if (obj.defaults.max_results !== undefined) {
        const mr = Number(obj.defaults.max_results);
        if (!Number.isInteger(mr) || mr < 1 || mr > 50) {
          errors.push('defaults.max_results must be an integer between 1 and 50.');
        }
      }
      if (obj.defaults.order !== undefined && !ALLOWED_ORDERS.includes(obj.defaults.order as any)) {
        errors.push(`defaults.order must be one of: ${ALLOWED_ORDERS.join(', ')}.`);
      }
      if (obj.defaults.safe_search !== undefined && !ALLOWED_SAFE_SEARCH.includes(obj.defaults.safe_search as any)) {
        errors.push(`defaults.safe_search must be one of: ${ALLOWED_SAFE_SEARCH.join(', ')}.`);
      }
    }
  }

  const seenIds = new Set<string>();

  obj.queries.forEach((q, idx) => {
    const num = idx + 1;
    if (!q || typeof q !== 'object') {
      errors.push(`Query #${num} is not a valid mapping.`);
      return;
    }

    if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
      errors.push(`Query #${num}: Missing required non-empty string "id".`);
    } else {
      const cleanId = q.id.trim();
      if (seenIds.has(cleanId)) {
        errors.push(`Query #${num}: Duplicate query id "${cleanId}". Every query must have a unique id.`);
      } else {
        seenIds.add(cleanId);
      }
    }

    if (q.q === undefined || q.q === null || typeof q.q !== 'string' || q.q.trim() === '') {
      errors.push(`Query #${num} (${q.id || 'unnamed'}): Missing required non-empty search query "q".`);
    }

    if (q.max_results !== undefined) {
      const mr = Number(q.max_results);
      if (!Number.isInteger(mr) || mr < 1 || mr > 50) {
        errors.push(`Query #${num} (${q.id || 'unnamed'}): max_results (${q.max_results}) must be an integer between 1 and 50.`);
      }
    }

    if (q.order !== undefined && !ALLOWED_ORDERS.includes(q.order as any)) {
      errors.push(`Query #${num} (${q.id || 'unnamed'}): order "${q.order}" must be one of: ${ALLOWED_ORDERS.join(', ')}.`);
    }

    if (q.safe_search !== undefined && !ALLOWED_SAFE_SEARCH.includes(q.safe_search as any)) {
      errors.push(`Query #${num} (${q.id || 'unnamed'}): safe_search "${q.safe_search}" must be one of: ${ALLOWED_SAFE_SEARCH.join(', ')}.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (obj as ParsedYamlSpec) : undefined,
    queryCount: obj.queries.length,
  };
}

export const SAMPLE_YAMLS: Record<string, { title: string; description: string; yaml: string }> = {
  default: {
    title: 'Multi-Language Review (Default)',
    description: 'World of Warcraft reviews in English, Japanese, and Traditional Chinese',
    yaml: `version: 1

defaults:
  max_results: 10
  order: relevance
  type: video
  safe_search: moderate

queries:
  - id: en-review
    q: "World of Warcraft Forever review"
    relevance_language: en
    region_code: US

  - id: ja-review
    q: "WoW Forever 感想"
    relevance_language: ja
    region_code: JP

  - id: zh-tw
    q: "魔獸世界 永恆 心得"
    relevance_language: zh-Hant
    region_code: TW
`,
  },
  techNews: {
    title: 'Global Tech & AI News',
    description: 'Latest Artificial Intelligence and Developer tooling updates across regions',
    yaml: `version: 1

defaults:
  max_results: 5
  order: date
  type: video

queries:
  - id: ai-us
    q: "Artificial Intelligence breakthrough"
    relevance_language: en
    region_code: US

  - id: dev-tools
    q: "TypeScript web framework 2026"
    relevance_language: en

  - id: tech-kr
    q: "인공지능 최신 뉴스"
    relevance_language: ko
    region_code: KR

  - id: tech-fr
    q: "intelligence artificielle actualités"
    relevance_language: fr
    region_code: FR
`,
  },
  gameTrailers: {
    title: 'Gaming Showcases & Trailers',
    description: 'Highly rated game reveal trailers sorted by rating',
    yaml: `version: 1

defaults:
  max_results: 8
  order: rating
  type: video

queries:
  - id: rpg-trailers
    q: "Action RPG Official Trailer 2026"
    relevance_language: en

  - id: indie-showcase
    q: "Indie Game Festival Trailer"
    relevance_language: en
`,
  },
};
