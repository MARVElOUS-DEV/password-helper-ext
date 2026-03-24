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

function normalizeRecord(record: PasswordRecord): PasswordRecord {
  return {
    id: record.id,
    name: record.name.trim(),
    sitePattern: record.sitePattern.trim(),
    reference: record.reference?.trim() ?? '',
    username: record.username.trim(),
    password: record.password,
    usernameSelector: record.usernameSelector.trim(),
    passwordSelector: record.passwordSelector.trim(),
    notes: record.notes.trim(),
    updatedAt: record.updatedAt,
  };
}

async function readStorage(): Promise<PasswordRecord[]> {
  const result = await getStorageArea().get(STORAGE_KEY);
  const records = (result as StorageShape)[STORAGE_KEY] ?? [];
  return sortRecords(records.map(normalizeRecord));
}

async function writeStorage(records: PasswordRecord[]) {
  await getStorageArea().set({
    [STORAGE_KEY]: sortRecords(records),
  });
}

export function createEmptyDraft(): PasswordDraft {
  return {
    name: '',
    sitePattern: '',
    reference: '',
    username: '',
    password: '',
    usernameSelector: '',
    passwordSelector: '',
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
    updatedAt: new Date().toISOString(),
  });

  const nextRecords = records.filter((record) => record.id !== nextRecord.id);
  nextRecords.push(nextRecord);
  await writeStorage(nextRecords);

  return nextRecord;
}

export async function deletePasswordRecord(id: string) {
  const records = await readStorage();
  await writeStorage(records.filter((record) => record.id !== id));
}
