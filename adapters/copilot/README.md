# Copilot integration adapter

Canonical skills are in `skills/`. Use `node packages/cli/index.mjs skills install --host copilot --project <project-root>` for supported project-local skill copies. The installer copies files; actual auto-discovery, subagent behavior, model capabilities and permissions vary across host versions and require independent validation.

Servers: use only the authenticated localhost report endpoint in the starter. Production remote telemetry and distributed hosting are not implemented. Never reuse or extract IDE session credentials.
