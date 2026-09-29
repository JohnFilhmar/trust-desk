# Software Developer, Trust & Safety Tooling (Full Stack)

**Work setup:** Work from home (remote)
**Schedule:** Monday to Friday, US business hours (PST), with a 30-minute unpaid lunch and two paid 15-minute breaks
**Expected hours:** 40 per week

## About the Role

You will own the fraud and security surfaces of our internal operations platform: abuse investigation dashboards, account risk views, enforcement workflows and the backend services that feed them. You will work across the React front end, the TypeScript serverless layer and the Ruby on Rails core API, partnering closely with Trust & Safety and Support.

## Responsibilities

- Build and maintain investigation UI: account search, detail views, event timelines, risk scoring, decision workflows, bulk actions and exports.
- Own the data endpoints behind those screens: query interpretation, search, stats and event aggregation, read paths over pre-aggregated tables with a log-platform fallback.
- Extend the abuse control registry and its coverage and effectiveness models.
- Add and modify Rails API endpoints that power enforcement actions such as suspension, spam marking and operational mode changes.
- Ship with tests every time: Jest unit and component tests, handler tests with mocked DB and auth, and a regression test for every bug fix.
- Handle customer PII (emails, IPs, device fingerprints, decisions) with care: group-based access gating, input validation at boundaries, sanitized errors, signed service-to-service calls.

## Must-have Requirements

- 3+ years shipping production web software.
- Strong TypeScript in strict mode and React 18 with hooks, React Query for server state, Tailwind and Radix primitives.
- Ruby and Rails: comfortable reading and changing API controllers, serializers and model methods in a large codebase.
- Serverless functions (Request/Response style handlers) and SQL (MySQL, including JSON column querying).
- Log query languages (LogScale, Datadog or similar) for signal investigation.
- Security fundamentals: authn/authz, least privilege, secret handling, input sanitization, replay protection.
- Testing discipline with Jest and a bias toward writing the test before declaring done.
- **Working with AI:** Uses AI coding agents (Claude Code, Cursor or equivalent) daily as a core part of the workflow, not as occasional autocomplete.
- **Working with AI:** Knows how to direct an agent well: writes clear specs, breaks work into verifiable steps, reviews every generated diff critically and keeps tests as the gate. Never merges what they cannot explain.
- **Working with AI:** Maintains and improves agent context (rules files, skills, design gates) so the whole team gets faster, not just themselves.
- **Working with AI:** Can point to concrete examples of features shipped substantially faster with AI while keeping quality and security intact.
- Proactive: picks up gaps in coverage, flaky flows or unclear docs without waiting to be assigned.
- Executes independently from a one-line problem statement to a reviewed, tested PR, and asks only when different readings would lead to materially different work.
- Communicates concisely in PRs and chat, leads with the outcome, flags risks early.
- Treats bugs found along the way as things to fix or report, never things to walk past.

## Nice-to-have Requirements

- Fraud, abuse or trust and safety domain experience (signup abuse, payment fraud, crypto mining, phishing hosting).
- AWS RDS Data API, Aurora.
- Data visualization (time series, maps, funnels) in React.
- Experience running or tuning LLM-backed features safely in production.
