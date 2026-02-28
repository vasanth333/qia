# QIA — Quality Intelligence Agent

> **World-class AI-powered QA Automation**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?logo=playwright&logoColor=white)](https://playwright.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white)](https://openai.com)
[![Jira](https://img.shields.io/badge/Jira-REST%20API%20v3-0052CC?logo=jira&logoColor=white)](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)

---

## What is QIA?

QIA is an autonomous AI agent that reads your Jira tickets, understands acceptance criteria, and generates production-grade Playwright tests — then executes them, heals broken locators, classifies failures by root cause, and posts structured results back to the same Jira ticket.

You give it a ticket. It does the rest.

---

## Demo

![QIA Demo](docs/demo.gif)

---

## How It Works

```
 Jira Ticket / URL / Extra Context
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  1. READ        ReaderAgent   → Fetch ticket + merge AC  │
│  2. SCAN        ScannerAgent  → Analyse framework DNA    │
│  3. STRATEGY    Strategist    → AI-reason test plan      │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ✋ GATE 1 — Strategy Review             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  4. GENERATE    EngineerAgent → Write Playwright tests   │
│  5. EXECUTE     ExecutorAgent → npx playwright test      │
│  6. RCA         RCAAgent      → Classify every failure   │
│  7. HEAL        HealerAgent   → Fix broken locators      │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ✋ GATE 2 — Test Review                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  8. PUSH        GitAgent      → Branch + PR on GitHub    │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ✋ GATE 3 — Push Approval               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  9. REPORT      ReporterAgent → Allure + Jira + Slack    │
└──────────────────────────────────────────────────────────┘
        │
        ▼
  Jira ticket → Done ✅ or In Review ❌
```

---

## Features

| Feature | Description |
|---|---|
| **Universal Input** | Ticket key, Jira URL, extra text, PDF, or XLSX — all accepted |
| **AI Test Generation** | GPT-4o reads your AC and writes complete Playwright tests |
| **Framework DNA** | Scans your codebase and matches your exact coding style |
| **Self-Healing Locators** | 3-tier healing: testid → semantic → AI — up to 3 retries |
| **Root Cause Analysis** | Auto-classifies every failure: UI / Frontend / Backend / Data / Environment |
| **Screenshots on Failure** | Full-page screenshot per failing test, named after the test title |
| **Evidence Capture** | Console errors, network requests, DOM snapshot per failure |
| **Allure Reports** | Report title = `SCRUM-13 — Test Results`, embedded screenshots |
| **Jira Auto-Update** | Structured RCA comment + screenshot attachments → ticket to Done or In Review |
| **Human Gates** | 3 approval checkpoints before any irreversible action |
| **Auto PR** | Branch + Pull Request created on GitHub after Gate 3 |
| **Slack Notifications** | Pass/fail summary with PR link sent to your channel |
| **CI Mode** | `--auto-approve` flag skips all gates for fully automated pipelines |

---

## Quick Start

```bash
git clone https://github.com/vasanth333/qia
cd qia
npm install
cp .env.example .env
# Fill in .env with your API keys (see Configuration below)
npm run build
node dist/index.js run SCRUM-13
```

---

## Usage Examples

```bash
# Run with a ticket key
node dist/index.js run SCRUM-13

# Run with a full Jira URL (ticket ID extracted automatically)
node dist/index.js run https://vasanthpaypal03.atlassian.net/browse/SCRUM-13

# Add extra context — merged into ticket AC for richer tests
node dist/index.js run SCRUM-13 "add negative test cases for login"

# Pass an Excel file with additional test cases
node dist/index.js run SCRUM-13 ./TestCases.xlsx

# CI mode — skip all human gates
node dist/index.js run SCRUM-13 --auto-approve

# Scan framework DNA only
node dist/index.js scan

# Self-heal locators in an existing test file
node dist/index.js heal src/framework/tests/ui/login.spec.ts
```

---

## Configuration

Create a `.env` file from `.env.example` and fill in:

```env
# ── OpenAI ──────────────────────────────────────────────
OPENAI_API_KEY=sk-...                  # OpenAI API key (GPT-4o)
OPENAI_MODEL=gpt-4o                    # Model to use (default: gpt-4o)

# ── Jira ────────────────────────────────────────────────
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=SCRUM                 # Default project key
JIRA_AC_FIELD=customfield_10014        # Custom field ID for Acceptance Criteria
JIRA_DONE_STATUS=Done                  # Status name when all tests pass
JIRA_IN_PROGRESS_STATUS=In Progress

# ── GitHub ──────────────────────────────────────────────
GITHUB_TOKEN=ghp_...                   # Personal access token with repo scope
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name

# ── Playwright ──────────────────────────────────────────
BASE_URL=https://www.saucedemo.com     # Application under test
PLAYWRIGHT_TIMEOUT=30000               # Test timeout in ms

# ── QIA Pipeline ────────────────────────────────────────
QIA_AUTO_APPROVE_GATES=false          # Set to true for CI/CD pipelines
QIA_GATE_TIMEOUT_MINUTES=30           # How long to wait at each gate
QIA_MAX_HEAL_ATTEMPTS=3               # Max self-healing retry loops

# ── Slack (optional) ────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123456789
```

---

## Agent Architecture

QIA is built as a multi-agent system. Each agent has a single responsibility:

```
src/agents/
├── orchestrator.ts      Master conductor — wires all agents together
├── reader-agent.ts      Fetches Jira ticket, extracts AC, merges extra context
├── scanner-agent.ts     Scans codebase DNA — style, locators, patterns (cached 24h)
├── strategist-agent.ts  AI reasoning engine — plans which tests to write and why
├── engineer-agent.ts    Writes Playwright TypeScript tests matching your DNA
├── executor-agent.ts    Runs tests via npx playwright test, reads evidence files
├── rca-agent.ts         Root cause analysis — classifies failures using AI
├── healer-agent.ts      3-tier locator healing: testid → semantic → AI
├── reporter-agent.ts    Allure report, Jira comment + screenshots, Slack
└── git-agent.ts         Creates branch, commits tests, pushes PR via GitHub API
```

### Self-Healing Tiers

| Tier | Strategy | Confidence |
|---|---|---|
| Tier 1 | `data-testid` / `data-test` attribute | 95% |
| Tier 2 | Semantic: `getByRole`, `getByLabel`, `getByText` | 80% |
| Tier 3 | AI healing with GPT-4o and surrounding code context | 65% |

### RCA Categories

| Category | Triggered by |
|---|---|
| **UI Issue** | Element not found, wrong text, layout broken |
| **Frontend Issue** | JS console errors (TypeError, uncaught, ReferenceError) |
| **Backend Issue** | API 4xx/5xx responses or response time > 3s |
| **Data Issue** | Value mismatch — `expected X received Y` |
| **Environment Issue** | Timeout, net::ERR, SSL error, ECONNREFUSED |

---

## Generated Test Structure

Every generated test file includes:

- Inline page object class (self-contained, no external imports)
- `beforeEach`: captures browser console errors + network requests
- `afterEach` on failure: full-page screenshot + evidence JSON written to disk
- Allure JSDoc annotations: `@feature`, `@story`, `@severity`
- Self-healing locator comments: `// [TIER1: testid] [TIER2: role] [TIER3: fallback]`

**File naming**: descriptive only — `login-negative.spec.ts` ✅ not `scrum-13-login.spec.ts` ❌

**Output directory**: `src/framework/tests/ui/`

---

## Allure Report

```bash
# Generate and open the report
npm run allure:generate
npm run allure:open
```

Report title is automatically set to `TICKET-ID — Test Results` (e.g., `SCRUM-13 — Test Results`).

The Environment tab shows:
```
Ticket    = SCRUM-13
Summary   = SauceDemo Login — error messages for invalid credentials
Passed    = 8
Failed    = 0
Duration  = 12s
```

---

## Jira Comment Format

On every run, QIA posts a structured comment to the Jira ticket:

```
✅ QIA — SCRUM-13 Test Results

• 📊 Total: 8 tests
• ✅ Passed: 8
• ⏱ Duration: 12s
• 📈 Allure Report: allure-report/index.html
• 🔗 PR: https://github.com/vasanth333/qia/pull/12

✅ Passed (8)
  login-negative.spec.ts: 8 passed
```

On failure, each test gets a full RCA block:

```
❌ Test: Show error for incorrect username
📸 Screenshot: show-error-for-incorrect-username.png [attached]
🔍 Root Cause: UI Issue
📋 Reason: Element [data-test="error"] not visible within 15s timeout
🌐 Console Errors: [ERROR] Failed to load resource: 404
🔗 API Log: POST /api/login → 200 (312ms)
💡 Suggested Fix: Verify the error element selector matches current DOM
👤 Assign to: QA Engineer
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x (strict mode, CommonJS output) |
| Runtime | Node.js 18+ |
| Test framework | Playwright 1.49 |
| AI / LLM | OpenAI GPT-4o |
| Ticket management | Jira REST API v3 (Atlassian Cloud) |
| Version control | GitHub REST API via Octokit |
| Reporting | Allure 2 with allure-playwright reporter |
| Notifications | Slack Web API |
| Config validation | Zod |
| HTTP client | Axios |

---

## Project Structure

```
qia/
├── src/
│   ├── agents/          All AI agents
│   ├── config/          Config loaders (agent, jira, playwright)
│   ├── framework/
│   │   ├── tests/ui/    Generated Playwright tests live here
│   │   ├── pages/       BasePage class
│   │   ├── fixtures/    Extended Playwright fixtures
│   │   ├── helpers/     SmartLocator helper
│   │   └── clients/     BaseApiClient
│   └── types/           All TypeScript interfaces + Zod schemas
├── dist/                Compiled JavaScript (git-ignored)
├── allure-results/      Raw Allure test results
├── allure-report/       Generated Allure HTML report
├── test-results/
│   ├── screenshots/     Full-page screenshots on failure
│   └── evidence/        JSON evidence per failing test
├── .qia/
│   └── dna-profile.json Cached framework DNA (24h TTL)
├── playwright.config.ts Root Playwright configuration
└── .env                 Your API keys (never commit this)
```

---

## Author

**Vasanthakumar P**
Senior Playwright Automation Engineer & SDET

[![GitHub](https://img.shields.io/badge/GitHub-vasanth333-181717?logo=github&logoColor=white)](https://github.com/vasanth333)
[![Email](https://img.shields.io/badge/Email-p.vasanth3%40gmail.com-D14836?logo=gmail&logoColor=white)](mailto:p.vasanth3@gmail.com)

---

*Built with precision. Powered by AI. Trusted by QA.*
