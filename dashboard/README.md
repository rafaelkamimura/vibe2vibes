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
      MessageStream.tsx
      Header.tsx
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

Each component renders interactive placeholder data. The dashboard periodically generates mock messages, session progress, and agent health changes so the interface feels live even before the Communication Bus APIs are wired up.

## Notes

- Configure `VITE_AGENT_BUS_WS_URL` and `VITE_AGENT_BUS_HTTP_URL` to point at the bus once WebSocket/REST endpoints are ready.
- Replace the mock generators in `src/App.tsx` with API calls or real-time subscriptions when integrating for production.
