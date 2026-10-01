/** RFC 9728 protected resource metadata, so OAuth clients (and Alexa+ later) can discover auth. */
export const METADATA_PATH = "/.well-known/oauth-protected-resource";

export function protectedResourceMetadata(baseUrl: string, authorizationServer: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["household"],
    resource_name: "Scam Guardian MCP server",
  };
}
