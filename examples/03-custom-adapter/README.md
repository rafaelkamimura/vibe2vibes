# Example 03 – Custom Adapter Template

Starter kit for building and testing a bespoke adapter. This example scaffolds a `JenkinsAdapter` that triggers CI pipelines.

## Contents

- `jenkins-adapter.ts` – Minimal adapter extending `BaseAdapter`.
- `register-and-delegate.ts` – Demonstrates registering the adapter and sending a task.
- `README.md` – This file.

## Usage

1. Customize adapter config in `register-and-delegate.ts` (base URL, credentials, job name).
2. Ensure the Communication Bus is running (`node dist/index.js`).
3. Run the script:

```bash
TS_NODE_TRANSPILE_ONLY=true ts-node examples/03-custom-adapter/register-and-delegate.ts
```

This example uses in-memory registration for demonstration. In production you would register via REST and keep the adapter running as a separate process/service.

## Next Steps

- Add proper queueing/backoff logic in the adapter.
- Persist adapter configuration in `config/default.json`.
- Write unit tests mocking HTTP calls to Jenkins.
