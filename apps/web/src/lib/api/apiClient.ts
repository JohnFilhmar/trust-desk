import { fetchAccount, searchAccounts, suspendAccount } from "@/lib/api/accountsApi";
import { fetchAuditLogs } from "@/lib/api/auditApi";
import { fetchSession, login, logout } from "@/lib/api/sessionApi";

/**
 * Every call the app makes to the API, one function per endpoint. Components
 * reach it through `useApiClient`, so a test can pass its own.
 */
export const apiClient = {
  login,
  logout,
  fetchSession,
  searchAccounts,
  fetchAccount,
  suspendAccount,
  fetchAuditLogs,
};

/** The shape of `apiClient`. A test double has the same shape. */
export type ApiClient = typeof apiClient;
