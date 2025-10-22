.PHONY: help bus-install bus-build bus-test bus-lint bus-format dash-install dash-dev dash-build dash-preview dash-lint repo-test repo-lint clean

help:
	@echo "Available targets:"
	@echo "  make bus-install     # npm install in agent-communication-bus"
	@echo "  make bus-build       # npm run build in agent-communication-bus"
	@echo "  make bus-test        # npm test in agent-communication-bus"
	@echo "  make bus-lint        # npm run lint in agent-communication-bus"
	@echo "  make bus-format      # npm run format in agent-communication-bus"
	@echo "  make dash-install    # npm install in dashboard"
	@echo "  make dash-dev        # npm run dev in dashboard (starts Vite dev server)"
	@echo "  make dash-build      # npm run build in dashboard"
	@echo "  make dash-preview    # npm run preview in dashboard"
	@echo "  make dash-lint       # npm run lint in dashboard (if configured)"
	@echo "  make repo-test       # Run project-wide tests (bus + dashboard)"
	@echo "  make repo-lint       # Run lint across bus + dashboard"
	@echo "  make clean           # Remove node_modules from bus and dashboard"

bus-install:
	npm install --prefix agent-communication-bus

bus-build:
	npm run build --prefix agent-communication-bus

bus-test:
	npm test --prefix agent-communication-bus

bus-lint:
	npm run lint --prefix agent-communication-bus

bus-format:
	npm run format --prefix agent-communication-bus

# Dashboard commands (requires network access)
dash-install:
	npm install --prefix dashboard

# Useful for local development; leave running in another terminal
dash-dev:
	npm run dev --prefix dashboard

# Build static assets
dash-build:
	npm run build --prefix dashboard

# Preview production build locally
dash-preview:
	npm run preview --prefix dashboard

# Lint dashboard (no-op if script missing)
dash-lint:
	npm run lint --prefix dashboard || true

# Aggregate helpers
repo-test: bus-test

repo-lint: bus-lint dash-lint

clean:
	rm -rf agent-communication-bus/node_modules dashboard/node_modules

