# Troubleshooting Guide

Common issues and quick fixes for the Agent Communication Bus.

## Quick Reference

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `npm run build` fails | TypeScript errors | Run `npm run lint`, review error lines (strict mode enabled) |
| REST call returns 401/403 | Missing API key header | Include `x-agent-api-key` with the value set in `.env` |
| `Agent not available` errors | Adapter not registered or socket dropped | Check adapter logs; ensure CLI/SDK launched successfully |
| Messages stuck in queue | Recipient offline or exceeded concurrency | Verify adapter status; adjust `maxConcurrentTasks` |
| Docker container unhealthy | Env vars missing or dependencies failing health checks | Inspect `docker compose logs`, run `npm run validate:env` |
| CLI process exits immediately | Wrong binary path or permissions | Update config (`OPENCODE_BINARY_PATH`, etc.), ensure executable bit |

## Diagnosis Checklist

1. **Health Endpoint** – `curl http://localhost:8080/health`
2. **Metrics** – `curl http://localhost:8080/metrics`
3. **Adapter Logs** – Each adapter logs to stdout with agent ID prefixes.
4. **Environment** – Run `npm run validate:env` (export required vars inline if needed).
5. **Build Status** – `npm run build` should succeed before deploying.

## Adapter-Specific Issues

### OpenCode Adapter
- **Problem:** “OpenCode binary not available”  
  **Fix:** Ensure CLI installed; update `OPENCODE_BINARY_PATH`; confirm `chmod +x`.  
- **Problem:** Output parsing failures  
  **Fix:** Inspect stdout/stderr; update `parseOpenCodeOutput` logic.

### Codex Adapter
- **Problem:** Authentication errors  
  **Fix:** Set `CODEX_API_KEY`; verify base URL.  
- **Problem:** CLI not found  
  **Fix:** Update `CODEX_CLI_PATH`; run `which codex`.

### Claude Code Adapter
- **Problem:** CLI waits for user input  
  **Fix:** Use non-interactive flags or SDK integration; check `permissionMode`.  
- **Problem:** Rate limits  
  **Fix:** Increase timeout, reduce concurrency, or rotate API keys.

## Common REST Errors

- `400 Bad Request` – Message schema invalid. Compare payload with `docs/api/message-format.md`.
- `404 Not Found` – Endpoint typo or agent unregistered.
- `500 Internal Server Error` – Check bus logs for stack traces; often indicates runtime exception in routing logic.

## Debugging Tips

- Enable verbose logging by wrapping custom logs or integrating with a logging library.
- Use Node’s inspector: `node --inspect dist/index.js`.
- For WebSocket traffic, connect with tools like `wscat` to observe raw frames.
- Add `console.log` inside adapter `handleMessage` and `sendMessage` calls to trace flows.

## FAQ

**Q: Can I run only one adapter?**  
Yes. Disable others in `config/default.json` and `.env` by setting `<ADAPTER>_ENABLED=false`.

**Q: How do I persist sessions/messages?**  
Currently in-memory; plan for Postgres/Redis persistence. Stub hooks in `SessionManager` and `CommunicationBus` are ready for extension.

**Q: Is authentication secure?**  
API key header is basic. For production add an auth middleware or reverse proxy (JWT, mTLS, etc.).

**Q: How do I scale horizontally?**  
Externalize state (database/cache), run multiple bus instances behind a load balancer, and ensure adapters reconnect to the correct instance or shared message broker.

**Q: My Docker build hangs during `npm ci`.**  
Ensure network access to npm registry; try `npm config set registry https://registry.npmjs.org/`.

## Still Stuck?

- Review `tasks/ARCHITECTURE_INPUT_FOR_CODEX.md` for detailed architecture notes.
- Open an issue with logs and reproduction steps.
- Coordinate with Claude Code or the maintainer team if you suspect a deeper architectural flaw.
