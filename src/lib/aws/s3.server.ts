import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { awsClientDefaults } from "@/lib/aws/config";

let client: S3Client | undefined;

/** The S3 client, built once per server instance. Credentials come from the default chain. */
export function getS3Client(): S3Client {
  client ??= new S3Client({ ...awsClientDefaults });
  return client;
}
