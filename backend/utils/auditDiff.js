const DEFAULT_IGNORED_PATHS = ['__v', 'createdAt', 'updatedAt'];
const DEFAULT_REDACTED_TERMS = ['password', 'token', 'authorization', 'secret'];
const DEFAULT_ARRAY_KEYS = ['_id', 'id', 'permId'];

function normalize(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSame(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function leafName(path) {
  return path.split('.').pop()?.replace(/\[.*\]$/, '') || path;
}

function matchesPath(path, configuredPaths) {
  const leaf = leafName(path);
  return configuredPaths.some((entry) => entry === path || entry === leaf);
}

function containsSensitiveTerm(path, terms) {
  const lowerPath = path.toLowerCase();
  return terms.some((term) => lowerPath.includes(term.toLowerCase()));
}

function boundedValue(value, maxValueLength) {
  if (value === undefined) return undefined;
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= maxValueLength) return value;
  return {
    omitted: true,
    type: Array.isArray(value) ? 'array' : typeof value,
    approximateSize: serialized.length,
  };
}

function findArrayKey(before, after, configuredKey) {
  if (configuredKey) return configuredKey;
  const objects = [...before, ...after].filter(isPlainObject);
  if (!objects.length || objects.length !== before.length + after.length) return undefined;
  return DEFAULT_ARRAY_KEYS.find((key) => objects.every((item) => item[key] != null));
}

function computeAuditDiff(before = {}, after = {}, options = {}) {
  const ignoredPaths = [...DEFAULT_IGNORED_PATHS, ...(options.ignoredPaths || [])];
  const redactedPaths = options.redactedPaths || [];
  const redactedTerms = [...DEFAULT_REDACTED_TERMS, ...(options.redactedTerms || [])];
  const arrayKeys = options.arrayKeys || {};
  const maxChanges = options.maxChanges ?? 100;
  const maxValueLength = options.maxValueLength ?? 2000;
  const changes = [];
  let truncated = false;

  function addChange(change) {
    if (changes.length >= maxChanges) {
      truncated = true;
      return;
    }
    changes.push(change);
  }

  function walk(previous, current, path) {
    if (truncated || matchesPath(path, ignoredPaths) || isSame(previous, current)) return;

    if (matchesPath(path, redactedPaths) || containsSensitiveTerm(path, redactedTerms)) {
      addChange({ operation: 'replace', path, before: '[REDACTED]', after: '[REDACTED]' });
      return;
    }

    if (previous === undefined) {
      addChange({ operation: 'add', path, after: boundedValue(current, maxValueLength) });
      return;
    }

    if (current === undefined) {
      addChange({ operation: 'remove', path, before: boundedValue(previous, maxValueLength) });
      return;
    }

    if (Array.isArray(previous) && Array.isArray(current)) {
      const arrayKey = findArrayKey(previous, current, arrayKeys[path]);
      if (!arrayKey) {
        addChange({
          operation: 'replace',
          path,
          before: boundedValue(previous, maxValueLength),
          after: boundedValue(current, maxValueLength),
        });
        return;
      }

      const previousByKey = new Map(previous.map((item) => [String(item[arrayKey]), item]));
      const currentByKey = new Map(current.map((item) => [String(item[arrayKey]), item]));
      const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);
      for (const key of keys) {
        walk(previousByKey.get(key), currentByKey.get(key), `${path}[${arrayKey}=${key}]`);
      }
      return;
    }

    if (isPlainObject(previous) && isPlainObject(current)) {
      const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
      for (const key of keys) {
        walk(previous[key], current[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    addChange({
      operation: 'replace',
      path,
      before: boundedValue(previous, maxValueLength),
      after: boundedValue(current, maxValueLength),
    });
  }

  walk(normalize(before), normalize(after), '');

  const summary = changes.reduce(
    (totals, change) => {
      const summaryKey = {
        add: 'added',
        remove: 'removed',
        replace: 'replaced',
      }[change.operation];
      totals[summaryKey] += 1;
      return totals;
    },
    { added: 0, removed: 0, replaced: 0 },
  );

  return {
    changes: changes.length ? changes : undefined,
    changeSummary: changes.length ? { ...summary, total: changes.length } : undefined,
    changesTruncated: truncated || undefined,
  };
}

function humanizeResource(resourceType) {
  return String(resourceType || 'resource')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function changeLabel(change) {
  const value = change.operation === 'remove' ? change.before : change.after;
  if (isPlainObject(value) && typeof value.name === 'string') return value.name;
  if (change.operation === 'replace'
    && ['string', 'number', 'boolean'].includes(typeof change.before)
    && ['string', 'number', 'boolean'].includes(typeof change.after)) {
    return `${change.path}: ${change.before} to ${change.after}`;
  }
  return change.path || 'document';
}

function buildAuditMessage({ action, resourceType, resourceLabel, changeSummary, changes, bulk }) {
  const target = `${humanizeResource(resourceType)}${resourceLabel ? ` ${resourceLabel}` : ''}`;
  if (bulk?.affectedCount != null) {
    return `${bulk.affectedCount} ${humanizeResource(resourceType)} records ${action}d`;
  }
  if (!changeSummary) return `${target} ${action}d`;

  const parts = [];
  if (changeSummary.added) parts.push(`${changeSummary.added} added`);
  if (changeSummary.removed) parts.push(`${changeSummary.removed} removed`);
  if (changeSummary.replaced) parts.push(`${changeSummary.replaced} changed`);
  const highlighted = (changes || []).slice(0, 3).map(changeLabel);
  const detail = highlighted.length ? `: ${highlighted.join(', ')}` : '';
  return `${target} ${action}d — ${parts.join(', ')}${detail}`;
}

module.exports = { computeAuditDiff, buildAuditMessage };
