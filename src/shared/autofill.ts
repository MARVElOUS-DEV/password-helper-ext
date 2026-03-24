import { AutofillPayload, AutofillResult, DetectedSelectors } from '../types';

export function autofillActivePage(payload: AutofillPayload): AutofillResult {
  const dispatchChanges = (element: HTMLInputElement, value: string) => {
    const prototype = Object.getPrototypeOf(element) as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const isVisible = (element: HTMLInputElement) => {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      styles.visibility !== 'hidden' &&
      styles.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const firstCandidate = (selector: string) => {
    const all = Array.from(
      document.querySelectorAll<HTMLInputElement>(selector)
    ).filter((element) => !element.disabled && !element.readOnly);

    return all.find(isVisible) ?? all[0] ?? null;
  };

  const usernameField =
    (payload.usernameSelector
      ? firstCandidate(payload.usernameSelector)
      : null) ??
    firstCandidate(
      [
        'input[autocomplete="username"]',
        'input[type="email"]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[type="text"]',
      ].join(',')
    );

  const passwordField =
    (payload.passwordSelector
      ? firstCandidate(payload.passwordSelector)
      : null) ??
    firstCandidate(
      [
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[name*="password" i]',
        'input[id*="password" i]',
      ].join(',')
    );

  if (!usernameField && !passwordField) {
    return {
      success: false,
      message: '当前页面没有找到可编辑的用户名或密码输入框。',
    };
  }

  if (usernameField && payload.username) {
    dispatchChanges(usernameField, payload.username);
  }

  if (passwordField) {
    dispatchChanges(passwordField, payload.password);
    passwordField.focus();
  } else if (usernameField) {
    usernameField.focus();
  }

  return {
    success: true,
    message: '已将用户名和密码填入当前页面。',
  };
}

export function detectLoginSelectors(): DetectedSelectors {
  const visible = (element: HTMLInputElement) => {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      styles.visibility !== 'hidden' &&
      styles.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const selectable = (selector: string) =>
    Array.from(document.querySelectorAll<HTMLInputElement>(selector)).filter(
      (element) => !element.disabled && !element.readOnly && visible(element)
    );

  const usernameField =
    selectable(
      [
        'input[autocomplete="username"]',
        'input[type="email"]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[type="text"]',
      ].join(',')
    )[0] ?? null;

  const passwordField =
    selectable(
      [
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[name*="password" i]',
        'input[id*="password" i]',
      ].join(',')
    )[0] ?? null;

  const attributeSelector = (
    element: HTMLInputElement,
    attribute: 'id' | 'name'
  ) => {
    const value = element.getAttribute(attribute);
    return value ? `input[${attribute}="${CSS.escape(value)}"]` : '';
  };

  const buildSelector = (element: HTMLInputElement | null) => {
    if (!element) {
      return '';
    }

    const idSelector = attributeSelector(element, 'id');
    if (idSelector) {
      return idSelector;
    }

    const nameSelector = attributeSelector(element, 'name');
    if (nameSelector) {
      return nameSelector;
    }

    const form = element.form;
    const siblings = Array.from(
      (form ?? document).querySelectorAll<HTMLInputElement>('input')
    ).filter((candidate) => candidate.type === element.type);
    const index = Math.max(0, siblings.indexOf(element)) + 1;

    if (form?.id) {
      return `form#${CSS.escape(form.id)} input[type="${
        element.type
      }"]:nth-of-type(${index})`;
    }

    return `input[type="${element.type}"]:nth-of-type(${index})`;
  };

  return {
    sitePattern: window.location.host,
    usernameSelector: buildSelector(usernameField),
    passwordSelector: buildSelector(passwordField),
  };
}
