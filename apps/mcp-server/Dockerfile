# MCP server image for Amazon Bedrock AgentCore Runtime (arm64, 0.0.0.0:8000/mcp).
# Build from the repository root:
#   pnpm --filter @asg/infra bundle:container
#   docker buildx build --platform linux/arm64 -f apps/mcp-server/Dockerfile -t scam-guardian-mcp .
# The bundle is self contained; the image only needs Node.js.
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8000
COPY infra/build/container/ ./
USER node
EXPOSE 8000
CMD ["node", "--enable-source-maps", "index.mjs"]
