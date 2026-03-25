import { PasswordDraft, PasswordRecord } from '../types';

export type PaginationToken = number | 'ellipsis';

export interface RecordSiteGroup {
  sitePattern: string;
  records: PasswordRecord[];
  accountCount: number;
}

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
    record.accountLabel,
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
    accountLabel: record.accountLabel,
    sitePattern: record.sitePattern,
    reference: record.reference,
    username: record.username,
    password: record.password,
    usernameSelector: record.usernameSelector,
    passwordSelector: record.passwordSelector,
    isDefault: false,
    lastUsedAt: '',
    notes: record.notes,
  };
}

export function getRecordAccountTitle(record: PasswordRecord) {
  return record.accountLabel || record.username || record.name;
}

export function compareAutofillRecords(
  left: PasswordRecord,
  right: PasswordRecord
) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  if (left.lastUsedAt !== right.lastUsedAt) {
    return right.lastUsedAt.localeCompare(left.lastUsedAt);
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }

  return left.name.localeCompare(right.name);
}

export function sortAutofillRecords(records: PasswordRecord[]) {
  return [...records].sort(compareAutofillRecords);
}

export function groupRecordsBySite(records: PasswordRecord[]) {
  const groups = new Map<string, PasswordRecord[]>();

  records.forEach((record) => {
    const nextRecords = groups.get(record.sitePattern) ?? [];
    nextRecords.push(record);
    groups.set(record.sitePattern, nextRecords);
  });

  return Array.from(groups.entries())
    .map(([sitePattern, siteRecords]) => {
      const sortedRecords = sortAutofillRecords(siteRecords);

      return {
        sitePattern,
        records: sortedRecords,
        accountCount: sortedRecords.length,
      } satisfies RecordSiteGroup;
    })
    .sort((left, right) => {
      const [leftTopRecord] = left.records;
      const [rightTopRecord] = right.records;

      if (leftTopRecord && rightTopRecord) {
        return compareAutofillRecords(leftTopRecord, rightTopRecord);
      }

      return left.sitePattern.localeCompare(right.sitePattern);
    });
}

export function buildPaginationTokens(
  currentPage: number,
  totalPages: number
): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  if (currentPage <= 3) {
    visiblePages.add(2);
    visiblePages.add(3);
    visiblePages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    visiblePages.add(totalPages - 1);
    visiblePages.add(totalPages - 2);
    visiblePages.add(totalPages - 3);
  }

  const sortedPages = Array.from(visiblePages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const tokens: PaginationToken[] = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      tokens.push('ellipsis');
    }

    tokens.push(page);
  });

  return tokens;
}
