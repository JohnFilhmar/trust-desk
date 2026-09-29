import type { OperationalMode } from "@trust-desk/shared";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { operationalModeKey } from "@/lib/api/detailQueryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";
import { useSession } from "@/providers/SessionProvider";

const refetchEveryMs = 30_000;

/**
 * Reads the operational mode and reads it again every 30 seconds, so a
 * change made by someone else shows up without a reload.
 *
 * @returns The query. It stays idle while nobody is signed in.
 */
export function useOperationalMode(): UseQueryResult<OperationalMode> {
  const apiClient = useApiClient();
  const { user } = useSession();
  return useQuery({
    queryKey: operationalModeKey(),
    queryFn: () => apiClient.fetchOperationalMode(),
    enabled: user !== null,
    refetchInterval: refetchEveryMs,
  });
}
