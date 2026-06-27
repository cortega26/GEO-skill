# Telemetry design (dormant)

`geo-opt` ships **no telemetry by default** and performs **no network activity**
during audits. This document defines the consent model and the frozen event
schema so that, if optional usage telemetry is ever enabled, it is anonymous,
opt-in, and matches a contract that was fixed before the first user existed.

> Status: **dormant**. The transport is disabled
> (`TELEMETRY_TRANSPORT_ENABLED = false` in `src/telemetry.js`). No prompt is
> shown and nothing is sent. The README's "no telemetry" claim is therefore
> literally true today.

## Principles

1. **Opt-in only.** Telemetry is never opt-out. It activates only after explicit
   consent. Source-available code makes any silent collection auditable, so the
   only defensible default is off.
2. **Anonymous and content-free.** Events are built from a strict allowlist
   (`TELEMETRY_EVENT_FIELDS`). It is structurally impossible to attach audited
   content, file paths, URLs, file names, or user configuration.
3. **No persistent identifiers.** No machine fingerprint and no stable ID. At
   most an ephemeral per-process `sessionId`, never written to disk.
4. **Automation-safe.** Suppressed in CI and non-interactive environments, and
   it honors the `DO_NOT_TRACK` standard.
5. **Frozen contract.** The schema is versioned. Growing it requires a new
   `schemaVersion` and fresh consent — existing consent never silently widens.

## Frozen event schema — `schemaVersion: 1`

The only fields that may ever leave the machine:

| Field                | Meaning                                                     |
| -------------------- | ----------------------------------------------------------- |
| `schemaVersion`      | Event contract version (currently `1`).                     |
| `cliVersion`         | `geo-opt` package version.                                  |
| `nodeMajor`          | Node.js major version (e.g. `22`).                          |
| `platform`           | OS family from `process.platform` (e.g. `linux`). No host.  |
| `command`            | CLI command name (e.g. `audit`). No arguments.              |
| `model`              | `v1` or `v2`, when applicable; otherwise `null`.            |
| `durationMs`         | Command duration in milliseconds.                           |
| `status`             | `ok` or `error`. No messages or stack traces.               |
| `findingsBySeverity` | Aggregate counts per severity. No finding content.          |
| `sessionId`          | Ephemeral per-process id, not persisted.                    |

**Never collected:** audited content, file paths, URLs, file names, config
values, hostnames, usernames, IP addresses (the transport, when built, must not
add any).

## Consent precedence

Resolved per invocation by `resolveTelemetryStatus()`:

1. `DO_NOT_TRACK` truthy → **denied** (does not modify stored state).
2. `GEO_OPT_TELEMETRY=0|off|false` → **denied**; `=1|on|true` → **granted**
   (per-invocation override, does not modify stored state).
3. Persisted decision from `config set telemetry true|false`.
4. Default → **unset** (treated as denied; eligible for a first-use prompt only
   once the transport is enabled).

User controls:

```bash
geo-opt config get telemetry          # prints true|false
geo-opt config set telemetry true     # grant
geo-opt config set telemetry false    # deny
```

The preference lives in the shared local state file
(`$XDG_CONFIG_HOME/geo-opt/state.json`), alongside reminder preferences.

## Enabling the transport later (checklist)

Do **not** flip the kill switch casually. Before setting
`TELEMETRY_TRANSPORT_ENABLED = true`:

- [ ] A real, documented endpoint exists and receives only the frozen schema.
- [ ] A published privacy policy describes exactly these fields.
- [ ] The first-use consent prompt is implemented in
      `maybePromptForTelemetryConsent()` (the reserved wiring point) and shown
      only when `shouldPromptForTelemetryConsent()` is true.
- [ ] README is updated from "no telemetry" to "no telemetry by default;
      optional, opt-in, anonymous".
- [ ] Sending failures are non-blocking and never delay or fail a command.
