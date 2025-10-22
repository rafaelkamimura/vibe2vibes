# Agent Communication Bus Dashboard (WIP)

This directory contains an initial React + TypeScript dashboard scaffold for visualizing agents, sessions, and message flow in real time. The project uses Vite for bundling and TailwindCSS for styling. The current implementation renders **mock data** that simulates WebSocket updates so the UI can be exercised before real APIs are connected.

## Getting Started

1. Install dependencies (requires network access):
   ```bash
   cd dashboard
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The app runs on `http://localhost:5173` by default. Update the `VITE_AGENT_BUS_WS_URL` and `VITE_AGENT_BUS_HTTP_URL` environment variables to point to your running bus.

## Available Scripts

- `npm run dev` – Start Vite dev server
- `npm run build` – Production build
- `npm run preview` – Preview the production build locally

## Structure

```
dashboard/
  src/
    components/
      AgentStatus.tsx
      AgentDetailDrawer.tsx
      ControlPanel.tsx
      Header.tsx
      MessageInspector.tsx
      MessageStream.tsx
      MetricsStrip.tsx
      Notifications.tsx
      SessionMonitor.tsx
      SessionTimeline.tsx
      Sidebar.tsx
    hooks/
      useWebSocket.ts
    App.tsx
    main.tsx
    index.css
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  package.json
```

Each component renders interactive placeholder data. The dashboard periodically generates mock messages, session progress, and agent health changes so the interface feels live even before the Communication Bus APIs are wired up. The control panel lets you tweak the simulation in real time (message cadence, failure/recovery, reset), while the notification overlay surfaces mock alerts for quick feedback.

## Notes

- Configure `VITE_AGENT_BUS_WS_URL` and `VITE_AGENT_BUS_HTTP_URL` to point at the bus once WebSocket/REST endpoints are ready.
- Replace the mock generators in `src/App.tsx` with API calls or real-time subscriptions when integrating for production.
- Notifications auto-dismiss after a few seconds; swap the mock triggers with real error/monitoring events when wiring up the backend.

## Integration Roadmap
1. **Wire REST Metrics** – Replace mock metrics in `App.tsx` with data from `/metrics` (poll or stream) and keep the UI resilient to load failures.
2. **Live Agent Registry** – Fetch the active agent list (new endpoint or reuse registration calls) to populate sidebar/drawer with real capabilities & connection health.
3. **WebSocket Message Stream** – Subscribe to the bus socket and push real messages into `MessageStream`; render full payload/routing metadata in the inspector.
4. **Session Data** – Expose session lifecycle APIs and feed the monitor/timeline with actual workflow steps, participants, and timestamps.
5. **Control Actions** – Map the control panel buttons to admin endpoints (reset stats, pause/resume agents) while keeping mock mode behind a feature flag.
6. **Theme & Persistence** – Persist theme preference (e.g., local storage) and finalize responsive/a11y polish before shipping.
7. **Packaging** – Integrate dashboard build into the main deployment (Dockerfile or CI workflow) and secure it with the project’s auth strategy once available.
