import { PasswordRecord } from '../types';

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPatternRegex(pattern: string) {
  const normalized = pattern.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('*')) {
    const regexSource = normalized.split('*').map(escapeForRegex).join('.*');

    return new RegExp(regexSource, 'i');
  }

  return null;
}

export function getUrlLabel(urlValue: string) {
  try {
    const url = new URL(urlValue);
    return url.host;
  } catch (error) {
    return 'Unsupported page';
  }
}

export function matchesSitePattern(urlValue: string, pattern: string) {
  if (!pattern.trim()) {
    return false;
  }

  try {
    const url = new URL(urlValue);
    const regex = toPatternRegex(pattern);
    const candidates = [
      url.href.toLowerCase(),
      url.origin.toLowerCase(),
      url.host.toLowerCase(),
      url.hostname.toLowerCase(),
    ];

    if (regex) {
      return candidates.some((candidate) => regex.test(candidate));
    }

    const normalizedPattern = pattern.trim().toLowerCase();
    return candidates.some((candidate) =>
      candidate.includes(normalizedPattern)
    );
  } catch (error) {
    return false;
  }
}

export function findMatchingRecords(
  records: PasswordRecord[],
  urlValue: string
) {
  return records.filter((record) =>
    matchesSitePattern(urlValue, record.sitePattern)
  );
}
