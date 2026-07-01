# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in OpenDiscover, please report it by emailing:

**security@opendiscover.science**

Include as much detail as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code, screenshots, or request/response pairs)
- The affected component (web app, API endpoint, data pipeline)
- Your name or alias if you would like credit in the disclosure notice

### Response timeline

| Milestone | Target |
|---|---|
| Acknowledgement | 48 hours after receipt |
| Initial assessment | 7 days |
| Patch or mitigation | 30 days (critical issues may be expedited) |
| Public disclosure | Coordinated with the reporter after the patch ships |

We will keep you informed throughout the process. If you do not receive an acknowledgement within 48 hours, please follow up to confirm receipt.

---

## Dual-Use Policy

OpenDiscover is a citizen-science platform for in-silico biology. Some biological research workflows have dual-use potential — they could be misused to design harmful agents. The platform includes a dual-use screen that evaluates protocol requests before they are dispatched.

**If you discover a way to bypass the dual-use screen** — for example, by crafting inputs that cause the screen to approve a request it should block, or by accessing restricted protocol endpoints directly — treat this as a security vulnerability and report it to security@opendiscover.science rather than opening a public issue. Bypass attempts that are reported in good faith will be treated under this responsible disclosure policy.

---

## Scope

The following are in scope for security reports:

- **Web application** — authentication flows, session management, authorization checks, input validation, XSS, CSRF
- **API endpoints** — REST and GraphQL endpoints, rate limiting, access control, injection vulnerabilities
- **Data pipeline** — protocol execution sandbox, agent tool calls, database access, file handling
- **Infrastructure configuration** — secrets exposure, misconfigured permissions

### Out of scope

- **Third-party dependencies** — vulnerabilities in npm packages, Docker base images, or upstream services (PostgreSQL, Redis, Vercel, Upstash). Please report those directly to the upstream maintainers.
- **Denial-of-service via resource exhaustion** without a demonstrated security impact beyond availability
- **Social engineering attacks** targeting contributors or maintainers
- **Physical attacks** against infrastructure

---

## Preferred Languages

We accept reports in English and French.

---

## Safe Harbor

OpenDiscover commits to not pursue legal action against researchers who:

- Report vulnerabilities through this responsible disclosure process
- Do not access, modify, or destroy data belonging to other users
- Do not disrupt production services
- Do not publicly disclose the vulnerability before a patch is available

We appreciate the security research community's efforts to keep OpenDiscover safe.
