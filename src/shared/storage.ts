import { PasswordDraft, PasswordRecord } from '../types';

const STORAGE_KEY = 'password-records';

type StorageShape = {
  [STORAGE_KEY]?: PasswordRecord[];
};

function getStorageArea() {
  return chrome.storage.local;
}

function sortRecords(records: PasswordRecord[]) {
  return [...records].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function normalizeSitePattern(sitePattern: string) {
  return sitePattern.trim().toLowerCase();
}

function normalizeRecord(record: Partial<PasswordRecord>): PasswordRecord {
  return {
    id: record.id ?? crypto.randomUUID(),
    name: record.name?.trim() ?? '',
    accountLabel: record.accountLabel?.trim() ?? '',
    sitePattern: record.sitePattern?.trim() ?? '',
    reference: record.reference?.trim() ?? '',
    username: record.username?.trim() ?? '',
    password: record.password ?? '',
    usernameSelector: record.usernameSelector?.trim() ?? '',
    passwordSelector: record.passwordSelector?.trim() ?? '',
    isDefault: Boolean(record.isDefault),
    lastUsedAt: record.lastUsedAt ?? '',
    notes: record.notes?.trim() ?? '',
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };
}

function applyDefaultSiteRecordRule(records: PasswordRecord[]) {
  const defaultSeenBySite = new Set<string>();

  return records.map((record) => {
    if (!record.isDefault) {
      return record;
    }

    const siteKey = normalizeSitePattern(record.sitePattern);
    if (!siteKey || !defaultSeenBySite.has(siteKey)) {
      defaultSeenBySite.add(siteKey);
      return record;
    }

    return {
      ...record,
      isDefault: false,
    };
  });
}

async function readStorage(): Promise<PasswordRecord[]> {
  const result = await getStorageArea().get(STORAGE_KEY);
  const records = (result as StorageShape)[STORAGE_KEY] ?? [];
  return sortRecords(applyDefaultSiteRecordRule(records.map(normalizeRecord)));
}

async function writeStorage(records: PasswordRecord[]) {
  await getStorageArea().set({
    [STORAGE_KEY]: sortRecords(applyDefaultSiteRecordRule(records)),
  });
}

export function createEmptyDraft(): PasswordDraft {
  return {
    name: '',
    accountLabel: '',
    sitePattern: '',
    reference: '',
    username: '',
    password: '',
    usernameSelector: '',
    passwordSelector: '',
    isDefault: false,
    notes: '',
  };
}

export async function getPasswordRecords() {
  return readStorage();
}

export async function savePasswordRecord(
  draft: PasswordDraft
): Promise<PasswordRecord> {
  const records = await readStorage();
  const nextRecord: PasswordRecord = normalizeRecord({
    ...createEmptyDraft(),
    ...draft,
    id: draft.id ?? crypto.randomUUID(),
    lastUsedAt: draft.lastUsedAt ?? '',
    updatedAt: new Date().toISOString(),
  });

  const nextRecords = records
    .filter((record) => record.id !== nextRecord.id)
    .map((record) => {
      if (
        nextRecord.isDefault &&
        normalizeSitePattern(record.sitePattern) ===
          normalizeSitePattern(nextRecord.sitePattern)
      ) {
        return {
          ...record,
          isDefault: false,
        };
      }

      return record;
    });
  nextRecords.push(nextRecord);
  await writeStorage(nextRecords);

  return nextRecord;
}

export async function deletePasswordRecord(id: string) {
  const records = await readStorage();
  await writeStorage(records.filter((record) => record.id !== id));
}

export async function markPasswordRecordUsed(id: string) {
  const records = await readStorage();
  const usedAt = new Date().toISOString();

  await writeStorage(
    records.map((record) =>
      record.id === id
        ? {
            ...record,
            lastUsedAt: usedAt,
          }
        : record
    )
  );
}
