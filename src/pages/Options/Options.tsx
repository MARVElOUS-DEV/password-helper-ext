import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  createEmptyDraft,
  deletePasswordRecord,
  getPasswordRecords,
  savePasswordRecord,
} from '../../shared/storage';
import { downloadPasswordRecordsCsv } from '../../shared/csv';
import DuplicateIcon from '../../shared/DuplicateIcon';
import {
  buildPaginationTokens,
  createDuplicateDraft,
  getRecordAccountTitle,
  groupRecordsBySite,
  matchesRecordSearch,
} from '../../shared/records';
import { PasswordDraft, PasswordRecord } from '../../types';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function formatDate(value: string) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatLastUsed(value: string) {
  if (!value) {
    return '未使用';
  }

  return formatDate(value);
}

export default function Options() {
  const [records, setRecords] = useState<PasswordRecord[]>([]);
  const [draft, setDraft] = useState<PasswordDraft>(createEmptyDraft());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accountLabelFocusNonce, setAccountLabelFocusNonce] = useState(0);
  const accountLabelInputRef = useRef<HTMLInputElement | null>(null);

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
            error instanceof Error ? error.message : '加载已保存记录失败。'
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

  useEffect(() => {
    if (accountLabelFocusNonce === 0) {
      return;
    }

    accountLabelInputRef.current?.focus();
    accountLabelInputRef.current?.select();
  }, [accountLabelFocusNonce]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery]);

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
      setStatusMessage('名称、站点规则和密码为必填项。');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const savedRecord = await savePasswordRecord(draft);
      const nextRecords = await getPasswordRecords();
      setRecords(nextRecords);
      setDraft(createEmptyDraft());
      setStatusMessage(`已保存「${savedRecord.name}」。`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '保存密码记录失败。'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: PasswordRecord) {
    if (!window.confirm(`确定删除「${record.name}」吗？`)) {
      return;
    }

    await deletePasswordRecord(record.id);
    setRecords(await getPasswordRecords());

    if (draft.id === record.id) {
      resetDraft();
    }

    setStatusMessage(`已删除「${record.name}」。`);
  }

  function handleEdit(record: PasswordRecord) {
    setDraft({
      id: record.id,
      name: record.name,
      accountLabel: record.accountLabel,
      sitePattern: record.sitePattern,
      reference: record.reference,
      username: record.username,
      password: record.password,
      usernameSelector: record.usernameSelector,
      passwordSelector: record.passwordSelector,
      isDefault: record.isDefault,
      lastUsedAt: record.lastUsedAt,
      notes: record.notes,
    });
    setStatusMessage(`正在编辑「${record.name}」。`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDuplicate(record: PasswordRecord) {
    setDraft(createDuplicateDraft(record));
    setStatusMessage(
      `已复制「${record.name}」为新记录，请修改账号标识或用户名后再保存。`
    );
    setAccountLabelFocusNonce((current) => current + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleExportCsv() {
    if (records.length === 0) {
      setStatusMessage('当前没有可导出的记录。');
      return;
    }

    downloadPasswordRecordsCsv(records);
    setStatusMessage(`已导出 ${records.length} 条记录为 CSV 文件。`);
  }

  const filteredRecords = records.filter((record) =>
    matchesRecordSearch(record, searchQuery)
  );
  const filteredSiteGroups = groupRecordsBySite(filteredRecords);
  const totalSiteGroups = filteredSiteGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalSiteGroups / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const visibleSiteGroups = filteredSiteGroups.slice(
    pageStartIndex,
    pageStartIndex + pageSize
  );
  const paginationTokens = buildPaginationTokens(safeCurrentPage, totalPages);
  const visibleSiteStart = totalSiteGroups === 0 ? 0 : pageStartIndex + 1;
  const visibleSiteEnd = Math.min(pageStartIndex + pageSize, totalSiteGroups);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  return (
    <main className="options">
      <section className="options__hero">
        <div>
          <span className="options__eyebrow">开发环境密码助手</span>
          <h1>在一个地方管理开发环境密码。</h1>
          <p>
            所有记录都保存在 `chrome.storage.local` 中，并支持按主机名、子域名或
            通配符规则匹配。它的目标是方便使用，而不是加密保险箱。
          </p>
        </div>
        <div className="options__security">
          <strong>安全提示</strong>
          <p>密码会以明文形式保存在当前浏览器本地配置中。</p>
        </div>
      </section>

      <section className="options__layout">
        <form className="options__form" onSubmit={handleSubmit}>
          <div className="options__form-header">
            <div>
              <h2>{draft.id ? '编辑记录' : '新建记录'}</h2>
              <p>只有页面需要自定义定位时，才需要填写选择器。</p>
            </div>
            <button
              className="options__ghost"
              onClick={resetDraft}
              type="button"
            >
              清空表单
            </button>
          </div>

          <div className="options__field-grid">
            <label>
              <span>名称</span>
              <input
                autoComplete="off"
                onChange={(event) => updateDraft('name', event.target.value)}
                placeholder="例如：测试环境后台"
                type="text"
                value={draft.name}
              />
            </label>

            <label>
              <span>账号标识</span>
              <input
                ref={accountLabelInputRef}
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('accountLabel', event.target.value)
                }
                placeholder="例如：管理员 / 测试账号 / 张三"
                type="text"
                value={draft.accountLabel}
              />
            </label>
          </div>

          <label>
            <span>站点规则</span>
            <input
              autoComplete="off"
              onChange={(event) =>
                updateDraft('sitePattern', event.target.value)
              }
              placeholder="例如：staging.example.com 或 *.internal"
              type="text"
              value={draft.sitePattern}
            />
          </label>

          <label>
            <span>备注来源</span>
            <input
              autoComplete="off"
              onChange={(event) => updateDraft('reference', event.target.value)}
              placeholder="例如：工单、同事、文档或来源说明"
              type="text"
              value={draft.reference}
            />
          </label>

          <div className="options__field-grid">
            <label>
              <span>用户名</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('username', event.target.value)
                }
                placeholder="例如：admin@example.com"
                type="text"
                value={draft.username}
              />
            </label>

            <label>
              <span>密码</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateDraft('password', event.target.value)
                }
                placeholder="请输入密码"
                type="password"
                value={draft.password}
              />
            </label>
          </div>

          <div className="options__field-grid">
            <label>
              <span>用户名选择器</span>
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
              <span>密码选择器</span>
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
            <span>备注</span>
            <textarea
              onChange={(event) => updateDraft('notes', event.target.value)}
              placeholder="可填写环境说明、端口信息或其他提醒。"
              rows={5}
              value={draft.notes}
            />
          </label>

          <label className="options__checkbox">
            <input
              checked={draft.isDefault}
              onChange={(event) =>
                updateDraft('isDefault', event.target.checked)
              }
              type="checkbox"
            />
            <span>设为该站点默认账号</span>
          </label>

          <button className="options__submit" disabled={isSaving} type="submit">
            {isSaving ? '保存中...' : draft.id ? '更新记录' : '保存记录'}
          </button>

          {statusMessage ? (
            <p className="options__status">{statusMessage}</p>
          ) : null}
        </form>

        <section className="options__records">
          <div className="options__records-header">
            <h2>已保存记录</h2>
            <div className="options__records-meta">
              <span>{records.length} 个账号</span>
              <button
                className="options__ghost"
                disabled={records.length === 0}
                onClick={handleExportCsv}
                type="button"
              >
                导出 CSV
              </button>
            </div>
          </div>

          <label className="options__search">
            <span>搜索</span>
            <input
              autoComplete="off"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="按名称、站点、账号、来源或备注搜索"
              type="search"
              value={searchQuery}
            />
          </label>

          {isLoading ? (
            <p className="options__empty">正在加载已保存记录...</p>
          ) : null}
          {!isLoading && records.length === 0 ? (
            <p className="options__empty">
              为常用环境创建记录后，就可以更快地登录和管理账号。
            </p>
          ) : null}
          {!isLoading && records.length > 0 && filteredRecords.length === 0 ? (
            <p className="options__empty">没有符合当前搜索条件的记录。</p>
          ) : null}

          {!isLoading && filteredSiteGroups.length > 0 ? (
            <div className="options__pagination">
              <div className="options__pagination-summary">
                <strong>
                  第 {safeCurrentPage} / {totalPages} 页
                </strong>
                <p>
                  显示 {visibleSiteStart}-{visibleSiteEnd} / {totalSiteGroups}{' '}
                  个站点，共 {filteredRecords.length} 个账号。
                </p>
              </div>

              <div className="options__pagination-controls">
                <label className="options__page-size">
                  <span>每页</span>
                  <select
                    onChange={(event) =>
                      setPageSize(Number(event.target.value))
                    }
                    value={pageSize}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="options__pager">
                  <button
                    className="options__ghost"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
                    type="button"
                  >
                    上一页
                  </button>

                  <div className="options__pager-pages">
                    {paginationTokens.map((token, index) =>
                      token === 'ellipsis' ? (
                        <span
                          className="options__pager-ellipsis"
                          key={`ellipsis-${index}`}
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          aria-current={
                            token === safeCurrentPage ? 'page' : undefined
                          }
                          className={`options__page-button ${
                            token === safeCurrentPage
                              ? 'options__page-button--active'
                              : ''
                          }`}
                          key={token}
                          onClick={() => setCurrentPage(token)}
                          type="button"
                        >
                          {token}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    className="options__ghost"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage((page) => page + 1)}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!isLoading
            ? visibleSiteGroups.map((group) => (
                <section
                  className="options__site-group"
                  key={group.sitePattern}
                >
                  <div className="options__site-group-header">
                    <div>
                      <h3>{group.sitePattern}</h3>
                      <p>
                        {group.accountCount} 个账号
                        {group.records.some((record) => record.isDefault)
                          ? ' · 含默认账号'
                          : ''}
                      </p>
                    </div>
                    <div className="options__site-group-meta">
                      <span>
                        最近更新 {formatDate(group.records[0].updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="options__site-group-accounts">
                    {group.records.map((record) => (
                      <article className="options__record" key={record.id}>
                        <div className="options__record-top">
                          <div>
                            <h4>{getRecordAccountTitle(record)}</h4>
                            <p>{record.name}</p>
                          </div>
                          <div className="options__record-meta">
                            <button
                              aria-label={`复制「${record.name}」为新记录`}
                              className="options__icon-button"
                              onClick={() => handleDuplicate(record)}
                              title="复制为新记录"
                              type="button"
                            >
                              <DuplicateIcon />
                            </button>
                            {record.isDefault ? (
                              <span className="options__default-badge">
                                默认账号
                              </span>
                            ) : null}
                            <span>{formatDate(record.updatedAt)}</span>
                          </div>
                        </div>

                        <dl className="options__record-details">
                          <div>
                            <dt>账号标识</dt>
                            <dd>{record.accountLabel || '未填写'}</dd>
                          </div>
                          <div>
                            <dt>用户名</dt>
                            <dd>{record.username || '未设置'}</dd>
                          </div>
                          <div>
                            <dt>上次使用</dt>
                            <dd>{formatLastUsed(record.lastUsedAt)}</dd>
                          </div>
                          <div>
                            <dt>选择器</dt>
                            <dd>
                              {record.usernameSelector ||
                              record.passwordSelector
                                ? `${record.usernameSelector || '自动'} / ${
                                    record.passwordSelector || '自动'
                                  }`
                                : '自动识别'}
                            </dd>
                          </div>
                          <div>
                            <dt>备注来源</dt>
                            <dd>{record.reference || '未填写'}</dd>
                          </div>
                          <div>
                            <dt>备注</dt>
                            <dd>{record.notes || '未填写'}</dd>
                          </div>
                        </dl>

                        <div className="options__record-actions">
                          <button
                            className="options__ghost"
                            onClick={() => handleEdit(record)}
                            type="button"
                          >
                            编辑
                          </button>
                          <button
                            className="options__danger"
                            onClick={() => void handleDelete(record)}
                            type="button"
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            : null}
        </section>
      </section>
    </main>
  );
}
