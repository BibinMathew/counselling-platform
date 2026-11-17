# Audit event conventions

Phase 0 establishes conventions only; it does not add an audit table or event-writing feature.

- Record privileged actions and appointment lifecycle changes from trusted server-side code.
- Use structured events with an actor ID, stable action name, object type and ID, and occurrence timestamp. Include a request or correlation ID when available.
- Keep events append-only. Clients must not submit arbitrary audit records.
- Store only the minimum operational metadata needed to explain the action. Never include session-note content, message bodies, OTPs, credentials, or payment secrets.
- Define retention, access, and export policies before production use. Audit events do not replace application security logs or a clinical-record audit process.
