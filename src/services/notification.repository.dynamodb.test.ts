import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseError } from "@/lib/errors";
import { createDynamoNotificationRepository } from "@/services/notification.repository.dynamodb";

vi.mock("@/lib/dynamodb/client.server", async () => {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient: Doc } = await import("@aws-sdk/lib-dynamodb");
  const client = Doc.from(new DynamoDBClient({ region: "us-east-1" }));
  return { getDocumentClient: () => client, getTableName: () => "test-table" };
});

/** `pending` and `failed` stay on the dead-letter index; settled outcomes leave it. */

let dynamo: ReturnType<typeof mockClient>;

beforeEach(() => {
  dynamo = mockClient(DynamoDBDocumentClient);
  dynamo.on(UpdateCommand).resolves({});
});

afterEach(() => {
  dynamo.restore();
});

function lastUpdate() {
  return dynamo.commandCalls(UpdateCommand)[0]!.args[0].input;
}

describe("createDynamoNotificationRepository.recordOutcome", () => {
  it("removes the dead-letter keys and stamps sent_at when an email is sent", async () => {
    await createDynamoNotificationRepository().recordOutcome("order-1", {
      channel: "email",
      status: "sent",
      providerMessageId: "msg-1",
      attempts: 1,
    });

    const input = lastUpdate();
    expect(input.Key).toEqual({ PK: "ORDER#order-1", SK: "NOTIF#email" });
    expect(input.UpdateExpression).toMatch(/REMOVE .*GSI3PK, GSI3SK/);
    expect(input.UpdateExpression).toContain("sent_at = :sentAt");
    expect(input.ExpressionAttributeValues).toMatchObject({
      ":status": "sent",
      ":messageId": "msg-1",
    });
    expect(input.ConditionExpression).toBe("attribute_exists(PK)");
  });

  it("keeps a failed notification on the dead-letter list and truncates the error", async () => {
    await createDynamoNotificationRepository().recordOutcome("order-1", {
      channel: "customer_email",
      status: "failed",
      errorMessage: "x".repeat(5000),
      attempts: 3,
    });

    const input = lastUpdate();
    expect(input.UpdateExpression).not.toContain("GSI3PK");
    expect(String(input.ExpressionAttributeValues?.[":error"])).toHaveLength(1000);
    expect(input.UpdateExpression).not.toContain("sent_at = ");
  });

  it("raises a DatabaseError when the notification item does not exist", async () => {
    dynamo
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: "no item", $metadata: {} }));

    await expect(
      createDynamoNotificationRepository().recordOutcome("missing", {
        channel: "email",
        status: "sent",
        attempts: 1,
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
