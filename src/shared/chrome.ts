import { AutofillPayload, AutofillResult, DetectedSelectors } from '../types';
import { autofillActivePage, detectLoginSelectors } from './autofill';

export function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(tabs[0] ?? null);
      }
    );
  });
}

export function openOptionsPage() {
  return new Promise<void>((resolve, reject) => {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

export function executeAutofill(
  tabId: number,
  payload: AutofillPayload
): Promise<AutofillResult> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: autofillActivePage,
        args: [payload],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(
          results?.[0]?.result ?? {
            success: false,
            message: '自动填充没有返回结果。',
          }
        );
      }
    );
  });
}

export function detectSelectors(tabId: number): Promise<DetectedSelectors> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: detectLoginSelectors,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(
          results?.[0]?.result ?? {
            sitePattern: '',
            usernameSelector: '',
            passwordSelector: '',
          }
        );
      }
    );
  });
}
