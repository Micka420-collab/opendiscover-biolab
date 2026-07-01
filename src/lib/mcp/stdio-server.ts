#!/usr/bin/env node
/**
 * Stdio MCP transport — for local development against Claude Code, Cursor, etc.
 * Register with your client by pointing it at: `pnpm mcp:dev`
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from './server';

const server = buildMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
