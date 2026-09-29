/** The parts of a failed request that the app shows or acts on. */
export type ApiErrorDetails = {
  /** The HTTP status, or 0 when no response arrived. */
  status: number;
  /** The stable code from the error envelope, such as `already_suspended`. */
  code: string;
  /** Text that is safe to show to the person using the app. */
  message: string;
  /** The id to quote when asking someone to find the request in the logs. */
  correlationId: string;
};

/** Describes a request that the API refused, or that failed on the way. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;

  /**
   * Builds the error from the parts of an error envelope.
   *
   * @param details - When the server sent no envelope, `code` is one this app made up and `correlationId` is the id the request carried.
   */
  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = "ApiError";
    this.status = details.status;
    this.code = details.code;
    this.correlationId = details.correlationId;
  }
}
