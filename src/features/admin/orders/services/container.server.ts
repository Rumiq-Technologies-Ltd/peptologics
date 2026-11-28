import "server-only";

import { createDynamoOrderAdminRepository } from "./orderAdmin.repository.dynamodb";
import { createOrderAdminService, type OrderAdminService } from "./orderAdmin.service";

let service: OrderAdminService | undefined;

/** Wires the admin order service once per server instance. The admin runs on DynamoDB only (D35). */
export function getOrderAdmin(): OrderAdminService {
  service ??= createOrderAdminService({ repository: createDynamoOrderAdminRepository() });
  return service;
}
