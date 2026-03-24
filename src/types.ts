export interface PasswordRecord {
  id: string;
  name: string;
  sitePattern: string;
  reference: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  notes: string;
  updatedAt: string;
}

export interface PasswordDraft {
  id?: string;
  name: string;
  sitePattern: string;
  reference: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  notes: string;
}

export interface AutofillPayload {
  username: string;
  password: string;
  usernameSelector?: string;
  passwordSelector?: string;
}

export interface AutofillResult {
  success: boolean;
  message: string;
}

export interface DetectedSelectors {
  sitePattern: string;
  usernameSelector: string;
  passwordSelector: string;
}
