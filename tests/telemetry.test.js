import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  CONSENT_UNSET,
  TELEMETRY_EVENT_FIELDS,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_TRANSPORT_ENABLED,
  buildTelemetryEvent,
  readTelemetryConsent,
  resolveTelemetryStatus,
  setTelemetryConsent,
  shouldPromptForTelemetryConsent,
  telemetryIsActive,
} from "../src/telemetry.js";

let dir;
let statePath;
const opts = () => ({ statePath, env: {}, stream: { isTTY: true } });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "geo-telemetry-"));
  statePath = join(dir, "state.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("telemetry consent state", () => {
  it("defaults to unset when no state exists", () => {
    assert.equal(readTelemetryConsent(opts()), CONSENT_UNSET);
  });

  it("persists and reads back granted/denied", () => {
    assert.equal(setTelemetryConsent("granted", opts()), true);
    assert.equal(readTelemetryConsent(opts()), CONSENT_GRANTED);
    assert.equal(setTelemetryConsent("denied", opts()), true);
    assert.equal(readTelemetryConsent(opts()), CONSENT_DENIED);
  });

  it("normalizes unknown decisions to unset", () => {
    setTelemetryConsent("garbage", opts());
    assert.equal(readTelemetryConsent(opts()), CONSENT_UNSET);
  });

  it("preserves unrelated state fields (e.g. reminders)", () => {
    writeFileSync(statePath, JSON.stringify({ remindersEnabled: false, foo: 7 }));
    setTelemetryConsent("granted", opts());
    const raw = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(raw.remindersEnabled, false);
    assert.equal(raw.foo, 7);
    assert.equal(raw.telemetryConsent, "granted");
  });
});

describe("telemetry resolution precedence", () => {
  it("DO_NOT_TRACK forces denied over persisted grant", () => {
    setTelemetryConsent("granted", opts());
    const status = resolveTelemetryStatus({ statePath, env: { DO_NOT_TRACK: "1" } });
    assert.equal(status.decision, CONSENT_DENIED);
    assert.equal(status.source, "DO_NOT_TRACK");
  });

  it("GEO_OPT_TELEMETRY override beats default but not state file", () => {
    const granted = resolveTelemetryStatus({ statePath, env: { GEO_OPT_TELEMETRY: "1" } });
    assert.equal(granted.decision, CONSENT_GRANTED);
    const denied = resolveTelemetryStatus({ statePath, env: { GEO_OPT_TELEMETRY: "off" } });
    assert.equal(denied.decision, CONSENT_DENIED);
  });

  it("env overrides never write state", () => {
    resolveTelemetryStatus({ statePath, env: { GEO_OPT_TELEMETRY: "1" } });
    assert.equal(readTelemetryConsent(opts()), CONSENT_UNSET);
  });
});

describe("dormant gate", () => {
  it("never prompts while the transport is disabled", () => {
    assert.equal(TELEMETRY_TRANSPORT_ENABLED, false);
    assert.equal(shouldPromptForTelemetryConsent(opts()), false);
  });

  it("is never active even when granted while transport is disabled", () => {
    setTelemetryConsent("granted", opts());
    assert.equal(telemetryIsActive(opts()), false);
  });
});

describe("frozen event schema", () => {
  it("emits exactly the allowlisted fields and nothing else", () => {
    const event = buildTelemetryEvent(
      { command: "audit", model: "v2", durationMs: 12.7, status: "ok" },
      { cliVersion: "9.9.9", sessionId: "abc" }
    );
    assert.deepEqual(Object.keys(event).sort(), [...TELEMETRY_EVENT_FIELDS].sort());
    assert.equal(event.schemaVersion, TELEMETRY_SCHEMA_VERSION);
    assert.equal(event.command, "audit");
    assert.equal(event.durationMs, 13);
  });

  it("drops non-allowlisted input such as paths and content", () => {
    const event = buildTelemetryEvent(
      { command: "audit", filePath: "/secret/file.md", content: "private" },
      { cliVersion: "9.9.9" }
    );
    assert.equal("filePath" in event, false);
    assert.equal("content" in event, false);
  });

  it("rejects invalid model values", () => {
    const event = buildTelemetryEvent({ command: "audit", model: "v3" }, { cliVersion: "1" });
    assert.equal(event.model, null);
  });

  it("sanitizes findingsBySeverity to non-negative integer counts", () => {
    const event = buildTelemetryEvent(
      { command: "audit", findingsBySeverity: { high: 2.9, low: -1, bad: "x" } },
      { cliVersion: "1" }
    );
    assert.deepEqual(event.findingsBySeverity, { high: 2, low: 0 });
  });

  it("returns a frozen object", () => {
    const event = buildTelemetryEvent({ command: "audit" }, { cliVersion: "1" });
    assert.equal(Object.isFrozen(event), true);
  });
});
