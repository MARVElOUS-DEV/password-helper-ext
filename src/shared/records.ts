import { PasswordDraft, PasswordRecord } from '../types';

function createDuplicateName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return 'Ops';
  }

  if (/\bops\b$/i.test(trimmedName)) {
    return `${trimmedName} Copy`;
  }

  return `${trimmedName} Ops`;
}

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

export function createDuplicateDraft(record: PasswordRecord): PasswordDraft {
  return {
    name: createDuplicateName(record.name),
    sitePattern: record.sitePattern,
    reference: record.reference,
    username: record.username,
    password: record.password,
    usernameSelector: record.usernameSelector,
    passwordSelector: record.passwordSelector,
    notes: record.notes,
  };
}
