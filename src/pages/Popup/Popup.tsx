import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  detectSelectors,
  executeAutofill,
  getActiveTab,
  openOptionsPage,
} from '../../shared/chrome';
import CopyIcon from '../../shared/CopyIcon';
import DuplicateIcon from '../../shared/DuplicateIcon';
import {
  createDuplicateDraft,
  getRecordAccountTitle,
  matchesRecordSearch,
  sortAutofillRecords,
} from '../../shared/records';
import {
  createEmptyDraft,
  deletePasswordRecord,
  getPasswordRecords,
  markPasswordRecordUsed,
  savePasswordRecord,
} from '../../shared/storage';
import { findMatchingRecords, getUrlLabel } from '../../shared/url';
import { PasswordDraft, PasswordRecord } from '../../types';

function formatLastUsed(value: string) {
  if (!value) {
    return '未使用';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function groupRecordsBySitePattern(records: PasswordRecord[]) {
  const groups = new Map<string, PasswordRecord[]>();

  records.forEach((record) => {
    const current = groups.get(record.sitePattern) ?? [];
    current.push(record);
    groups.set(record.sitePattern, current);
  });

  return Array.from(groups.entries());
}

type PopupTab = 'autofill' | 'create' | 'records';

const TAB_CONFIG: Array<{
  id: PopupTab;
  label: string;
  description: string;
}> = [
  {
    id: 'autofill',
    label: '自动填充',
    description: '根据当前页面地址，快速找到匹配的账号记录。',
  },
  {
    id: 'create',
    label: '新建记录',
    description: '直接在弹窗中保存记录，并检测当前页面的输入框选择器。',
  },
  {
    id: 'records',
    label: '我的记录',
    description: '搜索、查看、编辑和删除已保存的密码记录。',
  },
];

export default function Popup() {
  const [records, setRecords] = useState<PasswordRecord[]>([]);
  const [activeTab, setActiveTab] = useState<PopupTab>('autofill');
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [autofillSearch, setAutofillSearch] = useState('');
  const [recordsSearch, setRecordsSearch] = useState('');
  const [draft, setDraft] = useState<PasswordDraft>(createEmptyDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [accountLabelFocusNonce, setAccountLabelFocusNonce] = useState(0);
  const accountLabelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPopupState() {
      try {
        const [tab, nextRecords] = await Promise.all([
          getActiveTab(),
          getPasswordRecords(),
        ]);

        if (!isMounted) {
          return;
        }

        setRecords(nextRecords);
        setActiveTabId(tab?.id ?? null);
        setActiveTabUrl(tab?.url ?? '');
        setDraft((current) => ({
          ...current,
          sitePattern:
            current.sitePattern ||
            (() => {
              try {
                return tab?.url ? new URL(tab.url).host : '';
              } catch (error) {
                return '';
              }
            })(),
        }));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusMessage(
          error instanceof Error ? error.message : '加载扩展状态失败。'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPopupState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (accountLabelFocusNonce === 0 || activeTab !== 'create') {
      return;
    }

    accountLabelInputRef.current?.focus();
    accountLabelInputRef.current?.select();
  }, [accountLabelFocusNonce, activeTab]);

  const matchingRecords = activeTabUrl
    ? sortAutofillRecords(findMatchingRecords(records, activeTabUrl))
    : [];
  const visibleMatchingRecords = matchingRecords.filter((record) =>
    matchesRecordSearch(record, autofillSearch)
  );
  const fallbackRecords =
    matchingRecords.length > 0 ? [] : sortAutofillRecords(records).slice(0, 4);
  const visibleFallbackRecords = fallbackRecords.filter((record) =>
    matchesRecordSearch(record, autofillSearch)
  );
  const visibleRecordCount =
    visibleMatchingRecords.length + visibleFallbackRecords.length;
  const matchingRecordGroups = groupRecordsBySitePattern(
    visibleMatchingRecords
  );
  const visibleStoredRecords = records.filter((record) =>
    matchesRecordSearch(record, recordsSearch)
  );

  async function handleAutofill(record: PasswordRecord) {
    if (!activeTabId) {
      setStatusMessage('请先在普通网页标签页中打开弹窗，再执行自动填充。');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('');

    try {
      const result = await executeAutofill(activeTabId, {
        username: record.username,
        password: record.password,
        usernameSelector: record.usernameSelector,
        passwordSelector: record.passwordSelector,
      });

      if (result.success) {
        await markPasswordRecordUsed(record.id);
        await refreshRecords();
      }

      setStatusMessage(result.message);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '当前页面自动填充失败。'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
    setDraft((current) => ({
      ...createEmptyDraft(),
      sitePattern: current.sitePattern,
    }));
  }

  async function refreshRecords() {
    const nextRecords = await getPasswordRecords();
    setRecords(nextRecords);
  }

  async function handleSaveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.name.trim() || !draft.sitePattern.trim() || !draft.password) {
      setStatusMessage('名称、站点规则和密码为必填项。');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const savedRecord = await savePasswordRecord(draft);
      await refreshRecords();
      setStatusMessage(`已保存「${savedRecord.name}」。`);
      resetDraft();
      setActiveTab('records');
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
    await refreshRecords();
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
    setActiveTab('create');
    setStatusMessage(`正在编辑「${record.name}」。`);
  }

  function handleDuplicate(record: PasswordRecord) {
    setDraft(createDuplicateDraft(record));
    setActiveTab('create');
    setStatusMessage(
      `已复制「${record.name}」为新记录，请修改账号标识或用户名后再保存。`
    );
    setAccountLabelFocusNonce((current) => current + 1);
  }

  async function handleDetectSelectors() {
    if (!activeTabId) {
      setStatusMessage('请先在普通网页标签页中打开弹窗，再执行字段检测。');
      return;
    }

    setIsDetecting(true);
    setStatusMessage('');

    try {
      const detected = await detectSelectors(activeTabId);
      setDraft((current) => ({
        ...current,
        sitePattern: current.sitePattern || detected.sitePattern,
        usernameSelector: detected.usernameSelector || current.usernameSelector,
        passwordSelector: detected.passwordSelector || current.passwordSelector,
      }));

      if (!detected.usernameSelector && !detected.passwordSelector) {
        setStatusMessage(
          '没有检测到明显的登录输入框，你仍然可以手动填写选择器。'
        );
      } else {
        setStatusMessage('已从当前页面检测到选择器。');
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '检测当前页面失败。'
      );
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleCopy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setStatusMessage(`已复制${label}到剪贴板。`);
  }

  async function handleOpenOptions() {
    await openOptionsPage();
    window.close();
  }

  const hasAnyRecords = records.length > 0;
  const urlLabel = activeTabUrl
    ? getUrlLabel(activeTabUrl)
    : '当前没有可用的网页标签页';
  const activeTabMeta =
    TAB_CONFIG.find((tab) => tab.id === activeTab) ?? TAB_CONFIG[0];

  function renderRecordCard(record: PasswordRecord, badge: string) {
    const title = getRecordAccountTitle(record);

    return (
      <article className="popup__card" key={record.id}>
        <div className="popup__card-top">
          <div>
            <h3>{title}</h3>
            <div className="popup__host-row">
              <p>{record.sitePattern}</p>
              <button
                aria-label={`复制「${record.name}」的站点规则`}
                className="popup__icon-button popup__icon-button--inline"
                onClick={() => void handleCopy(record.sitePattern, '站点规则')}
                title="复制站点规则"
                type="button"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
          <div className="popup__card-meta">
            <button
              aria-label={`复制「${record.name}」为新记录`}
              className="popup__icon-button"
              onClick={() => handleDuplicate(record)}
              title="复制为新记录"
              type="button"
            >
              <DuplicateIcon />
            </button>
            <div className="popup__card-badges">
              {record.isDefault ? (
                <span className="popup__badge popup__badge--accent">
                  默认账号
                </span>
              ) : null}
              <span className="popup__badge">{badge}</span>
            </div>
          </div>
        </div>
        <dl className="popup__details">
          <div>
            <dt>记录名称</dt>
            <dd>{record.name}</dd>
          </div>
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
        </dl>
        <div className="popup__actions">
          <button
            className="popup__button popup__button--primary"
            onClick={() => void handleAutofill(record)}
            type="button"
            disabled={isSubmitting}
          >
            自动填充
          </button>
          <button
            className="popup__button"
            onClick={() => void handleCopy(record.username, '用户名')}
            type="button"
          >
            复制账号
          </button>
          <button
            className="popup__button"
            onClick={() => void handleCopy(record.password, '密码')}
            type="button"
          >
            复制密码
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="popup">
      <section className="popup__surface">
        <header className="popup__header">
          <div>
            <p className="popup__eyebrow">开发环境密码助手</p>
            <h1>{activeTabMeta.label}</h1>
            <p className="popup__intro">{activeTabMeta.description}</p>
          </div>
          <button
            className="popup__link"
            onClick={() => void handleOpenOptions()}
            type="button"
          >
            打开设置页
          </button>
        </header>

        <div className="popup__tabs" role="tablist" aria-label="弹窗标签">
          {TAB_CONFIG.map((tab) => (
            <div className="popup__tab-slot" key={tab.id}>
              <button
                className={`popup__tab ${
                  activeTab === tab.id ? 'popup__tab--active' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`popup-panel-${tab.id}`}
                id={`popup-tab-${tab.id}`}
              >
                {tab.label}
              </button>
              {tab.id === 'records' ? (
                <span className="popup__tab-meta">{records.length}</span>
              ) : null}
            </div>
          ))}
        </div>

        {isLoading ? <p className="popup__empty">正在加载记录...</p> : null}

        {!isLoading && activeTab === 'autofill' ? (
          <section
            className="popup__panel"
            id="popup-panel-autofill"
            role="tabpanel"
            aria-labelledby="popup-tab-autofill"
          >
            <div className="popup__context">
              <span className="popup__context-label">当前页面</span>
              <span className="popup__context-value">{urlLabel}</span>
            </div>

            <div className="popup__panel-header">
              <div>
                <h2>
                  {matchingRecords.length > 0 ? '当前页面匹配结果' : '快速填充'}
                </h2>
                <p className="popup__panel-copy">
                  优先显示与当前页面匹配的账号，并按默认账号和最近使用时间排序。
                </p>
              </div>
            </div>

            <label className="popup__search">
              <span>搜索</span>
              <input
                autoComplete="off"
                onChange={(event) => setAutofillSearch(event.target.value)}
                placeholder="快速查找账号、站点或备注"
                type="search"
                value={autofillSearch}
              />
            </label>

            {!hasAnyRecords ? (
              <div className="popup__empty">
                <p>还没有保存任何密码记录。</p>
                <p>可以先到“新建记录”标签中创建第一条记录。</p>
              </div>
            ) : null}

            {hasAnyRecords && visibleRecordCount === 0 ? (
              <div className="popup__empty">
                <p>没有符合当前搜索条件的记录。</p>
              </div>
            ) : null}

            {matchingRecordGroups.map(([sitePattern, group]) => (
              <section className="popup__match-group" key={sitePattern}>
                <div className="popup__match-group-header">
                  <div>
                    <h3>{sitePattern}</h3>
                    <p className="popup__panel-copy">
                      {group.length} 个账号可用于当前页面。
                    </p>
                  </div>
                  <span className="popup__badge">{group.length}</span>
                </div>
                {group.map((record) => renderRecordCard(record, '匹配'))}
              </section>
            ))}

            {visibleFallbackRecords.map((record) =>
              renderRecordCard(record, '最近保存')
            )}
          </section>
        ) : null}

        {!isLoading && activeTab === 'create' ? (
          <section
            className="popup__panel"
            id="popup-panel-create"
            role="tabpanel"
            aria-labelledby="popup-tab-create"
          >
            <div className="popup__context">
              <span className="popup__context-label">建议站点</span>
              <span className="popup__context-value">
                {draft.sitePattern || urlLabel}
              </span>
            </div>

            <form
              className="popup__form"
              onSubmit={(event) => void handleSaveRecord(event)}
            >
              <div className="popup__panel-header">
                <div>
                  <h2>{draft.id ? '编辑记录' : '新建记录'}</h2>
                  <p className="popup__panel-copy">
                    直接在弹窗中保存记录，并尝试识别当前页面的登录输入框选择器。
                  </p>
                </div>
                <div className="popup__inline-actions">
                  <button
                    className="popup__button"
                    onClick={() => void handleDetectSelectors()}
                    type="button"
                    disabled={isDetecting}
                  >
                    {isDetecting ? '检测中...' : '检测字段'}
                  </button>
                  <button
                    className="popup__button"
                    onClick={resetDraft}
                    type="button"
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="popup__grid">
                <label className="popup__field">
                  <span>名称</span>
                  <input
                    autoComplete="off"
                    onChange={(event) =>
                      updateDraft('name', event.target.value)
                    }
                    placeholder="例如：测试环境后台"
                    type="text"
                    value={draft.name}
                  />
                </label>

                <label className="popup__field">
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

              <label className="popup__field">
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

              <label className="popup__field">
                <span>备注来源</span>
                <input
                  autoComplete="off"
                  onChange={(event) =>
                    updateDraft('reference', event.target.value)
                  }
                  placeholder="例如：工单、同事、文档或来源说明"
                  type="text"
                  value={draft.reference}
                />
              </label>

              <div className="popup__grid">
                <label className="popup__field">
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

                <label className="popup__field">
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

              <div className="popup__grid">
                <label className="popup__field">
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

                <label className="popup__field">
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

              <label className="popup__field">
                <span>备注</span>
                <textarea
                  onChange={(event) => updateDraft('notes', event.target.value)}
                  placeholder="可填写环境说明、注意事项或提醒"
                  rows={4}
                  value={draft.notes}
                />
              </label>

              <label className="popup__checkbox">
                <input
                  checked={draft.isDefault}
                  onChange={(event) =>
                    updateDraft('isDefault', event.target.checked)
                  }
                  type="checkbox"
                />
                <span>设为该站点默认账号</span>
              </label>

              <button
                className="popup__button popup__button--primary popup__submit"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : draft.id ? '更新记录' : '保存记录'}
              </button>
            </form>
          </section>
        ) : null}

        {!isLoading && activeTab === 'records' ? (
          <section
            className="popup__panel"
            id="popup-panel-records"
            role="tabpanel"
            aria-labelledby="popup-tab-records"
          >
            <div className="popup__panel-header">
              <div>
                <h2>已保存记录</h2>
                <p className="popup__panel-copy">
                  无需离开弹窗，就可以搜索、查看、编辑和删除已保存的记录。
                </p>
              </div>
            </div>

            <label className="popup__search">
              <span>搜索</span>
              <input
                autoComplete="off"
                onChange={(event) => setRecordsSearch(event.target.value)}
                placeholder="按名称、站点、账号、来源或备注搜索"
                type="search"
                value={recordsSearch}
              />
            </label>

            {!hasAnyRecords ? (
              <div className="popup__empty">
                <p>还没有已保存的记录。</p>
              </div>
            ) : null}

            {hasAnyRecords && visibleStoredRecords.length === 0 ? (
              <div className="popup__empty">
                <p>没有符合当前搜索条件的已保存记录。</p>
              </div>
            ) : null}

            {visibleStoredRecords.map((record) => (
              <article className="popup__card" key={record.id}>
                <div className="popup__card-top">
                  <div>
                    <h3>{getRecordAccountTitle(record)}</h3>
                    <p>{record.sitePattern}</p>
                  </div>
                  <div className="popup__card-meta">
                    <button
                      aria-label={`复制「${record.name}」为新记录`}
                      className="popup__icon-button"
                      onClick={() => handleDuplicate(record)}
                      title="复制为新记录"
                      type="button"
                    >
                      <DuplicateIcon />
                    </button>
                    <div className="popup__card-badges">
                      {record.isDefault ? (
                        <span className="popup__badge popup__badge--accent">
                          默认账号
                        </span>
                      ) : null}
                      <span className="popup__badge">已保存</span>
                    </div>
                  </div>
                </div>
                <dl className="popup__details">
                  <div>
                    <dt>记录名称</dt>
                    <dd>{record.name}</dd>
                  </div>
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
                </dl>
                <div className="popup__actions">
                  <button
                    className="popup__button"
                    onClick={() => handleEdit(record)}
                    type="button"
                  >
                    编辑
                  </button>
                  <button
                    className="popup__button"
                    onClick={() => void handleCopy(record.password, '密码')}
                    type="button"
                  >
                    复制密码
                  </button>
                  <button
                    className="popup__button popup__button--danger"
                    onClick={() => void handleDelete(record)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </section>

      {statusMessage ? <p className="popup__status">{statusMessage}</p> : null}
    </main>
  );
}
