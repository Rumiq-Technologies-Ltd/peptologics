import "server-only";

/**
 * Shared AWS client defaults (ADR-037).
 *
 * Region is a constant, not an env var: Amplify rejects variable names starting with
 * `AWS_`, and every AWS resource this project uses lives in one region, so there is no
 * second value to configure wrongly.
 *
 * Credentials are deliberately absent. On Amplify they come from the app's compute IAM
 * role; locally, from `AWS_PROFILE`. The SDK's default provider chain handles both.
 */
export const AWS_REGION = "us-east-1" as const;

/**
 * Request timeout for the SDK's HTTP handler, in milliseconds. Slightly above the
 * application-level deadline so our own `withTimeout` fires first and classifies it.
 */
export const AWS_REQUEST_TIMEOUT_MS = 10_000 as const;

/**
 * Defaults every AWS client in this project is built with.
 *
 * `maxAttempts: 1` because `withRetry` already owns retrying: stacking the SDK's retries
 * under ours would multiply attempts (3 x 3) and blur which layer gave up.
 */
export const awsClientDefaults = {
  region: AWS_REGION,
  maxAttempts: 1,
  requestHandler: { requestTimeout: AWS_REQUEST_TIMEOUT_MS },
} as const;
