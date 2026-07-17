# AGENTS.md

## Cursor Cloud specific instructions

This repo is a Model Context Protocol (MCP) stdio server that bridges AI assistants to the hosted CloudGlue API. It is the runnable "application" here.

- Package manager: **npm** (`package-lock.json` committed). `.npmrc` sets `ignore-scripts=true`. Dependencies are installed automatically by the environment update script.
- Build/run commands are in `README.md` and `CLAUDE.md`. `npm run build` runs `tsc` then `mcpb pack` (outputs `build/` and a `.mcpb` bundle). There are **no test or lint scripts** — only `npm run format` (prettier).
- Run the server over stdio with `node build/index.js --api-key <key>` (or set `CLOUDGLUE_API_KEY`). It prints `Cloudglue MCP Server running on stdio` on stderr.
- The server **starts without a valid API key** and will answer MCP `initialize` / `tools/list` (10 tools registered), but any tool that actually calls CloudGlue needs a valid `CLOUDGLUE_API_KEY` and network access to `api.cloudglue.dev`.
- It depends on `@cloudglue/cloudglue-js` from **npm** (the published package), not the local sibling `cloudglue-js` checkout.
