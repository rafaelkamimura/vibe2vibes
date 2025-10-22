# Example 04 – Natural Language Interface

Conceptual example of mapping user instructions into structured bus messages. This prototype parses a plain-English request and dispatches tasks to the appropriate agents.

## Overview

- Parse user input (very naive intent detection).
- Map intents to agent IDs and payload templates.
- Send `task_request` messages to the bus.

## Files

- `natural-language.ts` – Simple parser + dispatcher.
- `utterances.ts` – Sample natural language prompts.

## Run

```bash
TS_NODE_TRANSPILE_ONLY=true ts-node examples/04-natural-language/natural-language.ts
```

Review the console output to see how utterances translate into structured messages. Extend the parser with a real NLP pipeline or call out to external services for better accuracy.
