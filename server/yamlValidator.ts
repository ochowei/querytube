export interface QueryConfig {
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

export interface YamlSearchInput {
  version?: number;
  defaults?: YamlDefaults;
  queries: QueryConfig[];
}

const ALLOWED_ORDERS = ['relevance', 'date', 'rating', 'title', 'viewCount'] as const;
const ALLOWED_SAFE_SEARCH = ['none', 'moderate', 'strict'] as const;

export function validateParsedYaml(data: unknown): { valid: boolean; errors: string[]; parsed?: YamlSearchInput } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['YAML must be an object with a queries list.'] };
  }

  const obj = data as Partial<YamlSearchInput>;

  if (!('queries' in obj)) {
    return { valid: false, errors: ['Missing required "queries" list in YAML.'] };
  }

  if (!Array.isArray(obj.queries)) {
    return { valid: false, errors: ['"queries" property must be a list/array.'] };
  }

  if (obj.queries.length === 0) {
    return { valid: false, errors: ['"queries" must contain at least one query item.'] };
  }

  if (obj.defaults) {
    if (typeof obj.defaults !== 'object' || Array.isArray(obj.defaults)) {
      errors.push('"defaults" must be an object/mapping.');
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

  obj.queries.forEach((q, index) => {
    const prefix = `Query #${index + 1}`;
    if (!q || typeof q !== 'object') {
      errors.push(`${prefix} is not a valid object.`);
      return;
    }

    if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
      errors.push(`${prefix} is missing a non-empty string "id".`);
    } else {
      const cleanId = q.id.trim();
      if (seenIds.has(cleanId)) {
        errors.push(`Duplicate query id "${cleanId}" detected.`);
      } else {
        seenIds.add(cleanId);
      }
    }

    if (q.q === undefined || q.q === null || typeof q.q !== 'string' || q.q.trim() === '') {
      errors.push(`${prefix} (${q.id || 'unnamed'}) is missing a non-empty query string "q".`);
    }

    if (q.max_results !== undefined) {
      const mr = Number(q.max_results);
      if (!Number.isInteger(mr) || mr < 1 || mr > 50) {
        errors.push(`${prefix} (${q.id || 'unnamed'}): max_results must be an integer between 1 and 50.`);
      }
    }

    if (q.order !== undefined && !ALLOWED_ORDERS.includes(q.order as any)) {
      errors.push(`${prefix} (${q.id || 'unnamed'}): order must be one of: ${ALLOWED_ORDERS.join(', ')}.`);
    }

    if (q.safe_search !== undefined && !ALLOWED_SAFE_SEARCH.includes(q.safe_search as any)) {
      errors.push(`${prefix} (${q.id || 'unnamed'}): safe_search must be one of: ${ALLOWED_SAFE_SEARCH.join(', ')}.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (obj as YamlSearchInput) : undefined,
  };
}
