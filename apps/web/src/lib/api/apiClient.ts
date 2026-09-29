import { fetchAccount, fetchAccountRisk, searchAccounts } from "@/lib/api/accountsApi";
import { fetchAuditLogs } from "@/lib/api/auditApi";
import { markAccountAsSpam, suspendAccount, unsuspendAccount } from "@/lib/api/enforcementApi";
import { fetchAccountEvents, revealAccountPii } from "@/lib/api/investigationApi";
import { changeOperationalMode, fetchOperationalMode } from "@/lib/api/operationalModeApi";
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
  fetchAccountRisk,
  fetchAccountEvents,
  revealAccountPii,
  suspendAccount,
  unsuspendAccount,
  markAccountAsSpam,
  fetchAuditLogs,
  fetchOperationalMode,
  changeOperationalMode,
};

/** The shape of `apiClient`. A test double has the same shape. */
export type ApiClient = typeof apiClient;
