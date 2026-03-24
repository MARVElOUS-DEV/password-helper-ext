import { PasswordRecord } from '../types';

export function matchesRecordSearch(record: PasswordRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    record.name,
    record.sitePattern,
    record.reference,
    record.username,
    record.notes,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}
