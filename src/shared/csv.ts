import { PasswordRecord } from '../types';

const CSV_HEADERS = [
  'name',
  'sitePattern',
  'reference',
  'username',
  'password',
  'usernameSelector',
  'passwordSelector',
  'notes',
  'updatedAt',
] as const;

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r\n/g, '\n');

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function createCsvContent(records: PasswordRecord[]) {
  const lines = [
    CSV_HEADERS.join(','),
    ...records.map((record) =>
      [
        record.name,
        record.sitePattern,
        record.reference,
        record.username,
        record.password,
        record.usernameSelector,
        record.passwordSelector,
        record.notes,
        record.updatedAt,
      ]
        .map((value) => escapeCsvValue(value))
        .join(',')
    ),
  ];

  return `\ufeff${lines.join('\n')}`;
}

function createExportFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, '0'),
    `${now.getDate()}`.padStart(2, '0'),
    `${now.getHours()}`.padStart(2, '0'),
    `${now.getMinutes()}`.padStart(2, '0'),
  ].join('');

  return `password-records-${stamp}.csv`;
}

export function downloadPasswordRecordsCsv(records: PasswordRecord[]) {
  const blob = new Blob([createCsvContent(records)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = createExportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
