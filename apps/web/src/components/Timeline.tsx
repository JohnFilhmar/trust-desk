import { event_type_schema } from "@trust-desk/shared";
import type { EventType } from "@trust-desk/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PayloadList } from "@/components/PayloadList";
import { Timestamp } from "@/components/Timestamp";
import { Button } from "@/components/ui/Button";
import { accountEventsKey } from "@/lib/api/detailQueryKeys";
import { eventTypeLabels } from "@/lib/format/investigationLabels";
import { useApiClient } from "@/providers/ApiClientProvider";

/** Props of `Timeline`. */
export type TimelineProps = {
  /** The account on the page. */
  accountId: number;
};

// The first page has no cursor. An empty string stands for it, so the page
// parameter stays a plain string.
const firstPage = "";

/**
 * Lists the events of an account, newest first, one page at a time, with a
 * filter by event type.
 *
 * @param props - See `TimelineProps`.
 */
export function Timeline({ accountId }: TimelineProps): ReactElement {
  const apiClient = useApiClient();
  const filterId = useId();
  const [eventType, setEventType] = useState<EventType | undefined>(undefined);

  const eventsQuery = useInfiniteQuery({
    queryKey: accountEventsKey(accountId, eventType),
    queryFn: ({ pageParam }) =>
      apiClient.fetchAccountEvents(accountId, {
        event_type: eventType,
        cursor: pageParam === firstPage ? undefined : pageParam,
      }),
    initialPageParam: firstPage,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });

  const events = eventsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-6">
        <h2 id="timeline-heading" className="text-lg font-semibold">
          Timeline
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor={filterId} className="text-sm font-medium">
            Event type
          </label>
          <select
            id={filterId}
            value={eventType ?? ""}
            onChange={(event) => {
              const chosen = event_type_schema.safeParse(event.target.value);
              setEventType(chosen.success ? chosen.data : undefined);
            }}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">All types</option>
            {event_type_schema.options.map((option) => (
              <option key={option} value={option}>
                {eventTypeLabels[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {eventsQuery.isPending && <LoadingState label="Loading the timeline" />}
      {eventsQuery.isSuccess && events.length === 0 && (
        <EmptyState
          heading="No events"
          message="Nothing of this type happened on this account. Pick another type to see more."
        />
      )}
      {events.length > 0 && (
        <ol className="flex flex-col rounded-lg border border-line bg-surface">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0"
            >
              <p className="text-sm font-medium">
                {eventTypeLabels[event.event_type]}
                <span className="font-normal text-ink-muted">
                  , <Timestamp value={event.occurred_at} />
                </span>
              </p>
              <PayloadList payload={event.payload} />
            </li>
          ))}
        </ol>
      )}
      {eventsQuery.isError && (
        <ErrorState error={eventsQuery.error} heading="The timeline could not be loaded" />
      )}
      {eventsQuery.hasNextPage && (
        <div>
          <Button
            disabled={eventsQuery.isFetchingNextPage}
            onClick={() => {
              void eventsQuery.fetchNextPage();
            }}
          >
            {eventsQuery.isFetchingNextPage ? "Loading more events" : "Load more events"}
          </Button>
        </div>
      )}
    </section>
  );
}
