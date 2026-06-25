# Tooltician paid offering

This document separates current paid functionality from candidate benefits.
It is a product roadmap, not a promise that every proposed feature is already
available.

## Product principle

The Community edition should remain genuinely useful. Paid plans should fund
maintenance and provide convenience, validation, collaboration, and scale—not
make basic auditing intentionally frustrating.

Free users receive an occasional, non-blocking support reminder after
successful interactive use. It has no countdown, performs no telemetry, does
not appear in CI or piped output, and can be disabled permanently.

## Available now

| Capability | Community | Pro |
|---|---|---|
| GEO content audit | Included | Included |
| Schema generation and injection | Included | Included |
| Node and Python implementations | Included | Included |
| Visible `Optimized with Tooltician` credit in injected output | Required | Optional |
| `--no-branding` | Not available | Included with valid entitlement |
| Local support reminders | Infrequent; user can disable | Suppressed automatically |
| Source access | Community License | Commercial terms during license period |

The current entitlement check is local and intentionally described as a
convenience gate, not strong DRM.

## Recommended Pro benefits

These are the strongest next paid capabilities because they are useful,
verifiable, and aligned with the current architecture:

1. **Structured-data validation**
   - Validate generated JSON-LD against Schema.org shapes and major search
     provider requirements.
   - Explain errors and warnings before injection.
   - Offer strict CI exit codes.

2. **Professional reports**
   - Aggregate batch results into valid JSON, Markdown, and HTML reports.
   - Include before/after comparisons, prioritized recommendations, and
     downloadable client-ready summaries.

3. **Versioned scoring profiles**
   - Profiles by domain such as technology, legal, healthcare, ecommerce, and
     editorial content.
   - Publish profile versions and changelogs so scores remain reproducible.

4. **CI and repository integrations**
   - GitHub Actions annotations, pull-request summaries, configurable quality
     gates, and changed-file-only audits.
   - SARIF or another machine-readable diagnostics format where appropriate.

5. **Bulk and workspace workflows**
   - Directory/glob input, ignore rules, incremental caching, consolidated
     reports, and organization-wide configuration.

6. **Priority maintenance**
   - Priority support, migration help, release notifications, and access to
     supported long-term versions.

7. **Team governance**
   - Shared policies, centrally managed profiles, approved publisher/author
     metadata, audit history, and role-based access if a hosted service is
     introduced.

## Suggested plans

### Community

- Complete core audit and injection workflow.
- Required Tooltician attribution in injected output.
- Local opt-out for support reminders.
- Community support and public documentation.

### Pro

- Branding-free injection.
- Validation, professional reports, domain profiles, and CI integrations.
- Individual commercial license and priority updates.

### Team

- Everything in Pro.
- Shared configuration and policies.
- Multiple seats, centralized license management, audit history, and priority
  support.

### OEM / Enterprise

- Embedding, redistribution, white-labeling, or hosted-service rights.
- Custom limits, security review, support commitments, and negotiated terms.

OEM and redistribution rights should remain separate from ordinary Pro access;
they create a materially different support and competitive-use obligation.

## Reminder policy

The implemented Community reminder follows these rules:

- eligible after 10 successful free injections;
- shown at most once every 7 days;
- shown only when `stderr` is an interactive terminal;
- suppressed in CI, pipes, dry runs, and for Pro users;
- written to `stderr`, never machine-readable `stdout`;
- no delay, countdown, modal interaction, analytics, or network request;
- disabled with `geo-opt config set reminders false`;
- re-enabled with `geo-opt config set reminders true`.

The local state is stored under the operating system's configuration
directory. `GEO_OPT_STATE_DIR` can override the location for testing or managed
environments.
