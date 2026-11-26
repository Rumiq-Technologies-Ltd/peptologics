/**
 * A `ProjectionExpression` for an explicit attribute list, with every name behind a
 * placeholder. Several attribute names (`status`, `name`) are DynamoDB reserved words, so
 * naming them directly would be a runtime error.
 *
 * There is no `SELECT *` equivalent in this codebase: a read asks for what it renders.
 */
export function projectionOf(attributes: readonly string[]): {
  ProjectionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
} {
  return {
    ProjectionExpression: attributes.map((_, index) => `#a${index}`).join(", "),
    ExpressionAttributeNames: Object.fromEntries(
      attributes.map((attribute, index) => [`#a${index}`, attribute]),
    ),
  };
}
