import { FormEvent, useEffect, useState } from 'react';
import {
  createEmptyDraft,
  deletePasswordRecord,
  getPasswordRecords,
  savePasswordRecord,
} from '../../shared/storage';
import { matchesRecordSearch } from '../../shared/records';
import { PasswordDraft, PasswordRecord } from '../../types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function Options() {
  const [records, setRecords] = useState<PasswordRecord[]>([]);
  const [draft, setDraft] = useState<PasswordDraft>(createEmptyDraft());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      try {
        const nextRecords = await getPasswordRecords();
        if (isMounted) {
          setRecords(nextRecords);
        }
      } catch (error) {
        if (isMounted) {
          setStatusMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load saved records.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateDraft<K extends keyof PasswordDraft>(
    key: K,
    value: PasswordDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetDraft() {
    setDraft(createEmptyDraft());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.name.trim() || !draft.sitePattern.trim() || !draft.password) {
      setStatusMessage('Name, site pattern, and password are required.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const savedRecord = await savePasswordRecord(draft);
      const nextRecords = await getPasswordRecords();
      setRecords(nextRecords);
      setDraft(createEmptyDraft());
      setStatusMessage(`Saved "${savedRecord.name}".`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save the password record.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: PasswordRecord) {
    if (!window.confirm(`Delete "${record.name}"?`)) {
      return;
    }

    await deletePasswordRecord(record.id);
    setRecords(await getPasswordRecords());

    if (draft.id === record.id) {
      resetDraft();
    }

    setStatusMessage(`Deleted "${record.name}".`);
  }

  function handleEdit(record: PasswordRecord) {
    setDraft({
      id: record.id,
      name: record.name,
      sitePattern: record.sitePattern,
      reference: record.reference,
      username: record.username,
      password: record.password,
      usernameSelector: record.usernameSelector,
      passwordSelector: record.passwordSelector,
      notes: record.notes,
    });
    setStatusMessage(`Editing "${record.name}".`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const filteredRecords = records.filter((record) =>
    matchesRecordSearch(record, searchQuery)
  );

  return (
    <main className="options">
      <section className="options__hero">
        <div>
          <span className="options__eyebrow">Dev Password Helper</span>
          <h1>Manage development passwords in one place.</h1>
          <p>
            Records are stored in `chrome.storage.local` and can be matched by
            host, subdomain, or wildcard patterns. Keep in mind that this is
            convenient, not encrypted.
          </p>
        </div>
        <div className="options__security">
          <strong>Security note</strong>
          <p>
            Passwords are stored in plain text inside your local browser
            profile.
          </p>
        </div>
      </section>

      <section className="options__layout">
        <form className="options__form" onSubmit={handleSubmit}>
          <div className="options__form-header">
            <div>
              <h2>{draft.id ? 'Edit record' : 'New record'}</h2>
              <p>Use selectors only when a page needs custom targeting.</p>
            </div>
            <button
              className="options__ghost"
              onClick={resetDraft}
              type="button"
            >
              Clear form
            </button>
          </div>

          <label>
            <span>Name</span>
            <input
              autoComplete="off"
              onChange={(event) => updateDraft('name', event.target.value)}
              placeholder="Staging Admin"
              type="text"
              value={draft.name}
            />
          </label>

          <label>
            <span>Site pattern</span>
            <input
              autoComplete="off"
              onChange={(event) =>
                updateDraft('sitePattern', event.target.value)
              }
              placeholder="staging.example.com or *.internal"
              type="text"
              value={draft.sitePattern}
            />
          </label>

          <label>
            <span>Reference</span>
            <input
              autoComplete="off"
              onChange={(event) => updateDraft('reference', event.target.value)}
              placeholder="Where this password came from"
              type="text"
              value={draft.reference}
            />
          </label>

          <div className="options__field-grid">
            <label>
              <span>Username</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('username', event.target.value)
                }
                placeholder="admin@example.com"
                type="text"
                value={draft.username}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('password', event.target.value)
                }
                placeholder="Password"
                type="password"
                value={draft.password}
              />
            </label>
          </div>

          <div className="options__field-grid">
            <label>
              <span>Username selector</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('usernameSelector', event.target.value)
                }
                placeholder='input[name="email"]'
                type="text"
                value={draft.usernameSelector}
              />
            </label>

            <label>
              <span>Password selector</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('passwordSelector', event.target.value)
                }
                placeholder='input[type="password"]'
                type="text"
                value={draft.passwordSelector}
              />
            </label>
          </div>

          <label>
            <span>Notes</span>
            <textarea
              onChange={(event) => updateDraft('notes', event.target.value)}
              placeholder="Optional environment notes, ports, or reminders."
              rows={5}
              value={draft.notes}
            />
          </label>

          <button className="options__submit" disabled={isSaving} type="submit">
            {isSaving
              ? 'Saving...'
              : draft.id
              ? 'Update record'
              : 'Save record'}
          </button>

          {statusMessage ? (
            <p className="options__status">{statusMessage}</p>
          ) : null}
        </form>

        <section className="options__records">
          <div className="options__records-header">
            <h2>Saved records</h2>
            <span>{records.length}</span>
          </div>

          <label className="options__search">
            <span>Search</span>
            <input
              autoComplete="off"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Find by name, site, username, reference, or notes"
              type="search"
              value={searchQuery}
            />
          </label>

          {isLoading ? (
            <p className="options__empty">Loading saved records...</p>
          ) : null}
          {!isLoading && records.length === 0 ? (
            <p className="options__empty">
              Create a record for each environment you log into often.
            </p>
          ) : null}
          {!isLoading && records.length > 0 && filteredRecords.length === 0 ? (
            <p className="options__empty">
              No records match the current search.
            </p>
          ) : null}

          {!isLoading
            ? filteredRecords.map((record) => (
                <article className="options__record" key={record.id}>
                  <div className="options__record-top">
                    <div>
                      <h3>{record.name}</h3>
                      <p>{record.sitePattern}</p>
                    </div>
                    <span>{formatDate(record.updatedAt)}</span>
                  </div>

                  <dl className="options__record-details">
                    <div>
                      <dt>Reference</dt>
                      <dd>{record.reference || 'No reference'}</dd>
                    </div>
                    <div>
                      <dt>Username</dt>
                      <dd>{record.username || 'Not set'}</dd>
                    </div>
                    <div>
                      <dt>Selectors</dt>
                      <dd>
                        {record.usernameSelector || record.passwordSelector
                          ? `${record.usernameSelector || 'auto'} / ${
                              record.passwordSelector || 'auto'
                            }`
                          : 'Automatic'}
                      </dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{record.notes || 'No notes'}</dd>
                    </div>
                  </dl>

                  <div className="options__record-actions">
                    <button
                      className="options__ghost"
                      onClick={() => handleEdit(record)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="options__danger"
                      onClick={() => void handleDelete(record)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            : null}
        </section>
      </section>
    </main>
  );
}
