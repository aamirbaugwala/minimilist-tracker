# NutriTrack — Product & Engineering Documentation

> **Purpose:** A single document to understand every feature, every AI component, and every production optimisation made to this product. Read this to remember everything. Kept up to date after every engineering session.

---

## Table of Contents

1. [What This Product Does](#1-what-this-product-does)
2. [Tech Stack](#2-tech-stack)
3. [Application Pages & Features](#3-application-pages--features)
4. [AI Architecture — Full Breakdown](#4-ai-architecture--full-breakdown)
5. [AI Agent — Deep Dive](#5-ai-agent--deep-dive)
6. [Production Optimisations](#6-production-optimisations)
7. [Architecture Decisions & Tradeoffs](#7-architecture-decisions--tradeoffs)
8. [Cost Analysis & Token Economics](#8-cost-analysis--token-economics)
9. [File Map](#9-file-map)
10. [Environment Variables](#10-environment-variables)
11. [Supabase Tables Reference](#11-supabase-tables-reference)

---

## 1. What This Product Does

NutriTrack is an **AI-powered personal nutrition tracker** with a clinical admin panel. It allows users to:

- Log daily food intake and track calories, protein, carbs, fats, fibre, and water
- Chat with an AI nutrition agent (NutriCoach) that reads their real data and gives grounded advice
- Upload blood test / medical reports (PDFs) which the AI reads and uses to personalise meal suggestions
- View weekly AI-generated insights and adherence scores
- Track weight over time
- Generate personalised meal plans based on their macro gap for the day
- Manage fitness goals (lose / gain / maintain / recomp / custom)

Clinical admin side (for doctors/dietitians):
- View all users (patients) with full adherence stats
- Generate AI clinical briefs (structured dietitian-grade reports)
- View per-patient food logs, trends, medical history, and AI-generated notes

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | JavaScript (JSX) |
| **Styling** | Inline styles + Tailwind CSS v4 |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **AI Model** | Google `gemini-3-flash-preview` (`@google/generative-ai`) |
| **Deployment** | Vercel / Cloudflare (opennextjs-cloudflare) |
| **Supabase proxy** | Cloudflare Worker (routes around ISP blocks in India) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **PWA** | next-pwa (manifest + service worker) |

---

## 3. Application Pages & Features

### `/` — Dashboard (Home)
- Daily macro rings (calories, protein, carbs, fats, fibre, water)
- Food timeline (today's logs in chronological order)
- Quick-add food from the built-in food database (`food-data.js`)
- Weight log entry
- Smart recommendations panel (`SmartRecsPanel`) — rule-based suggestions based on macro gaps
- Edit / delete individual log entries
- Manual entry modal for custom foods

### `/agent` — NutriCoach (AI Chat)
- Full-screen chat interface with the AI agent
- Real-time tool badge display as the agent calls tools
- Streaming text response (word-by-word)
- Voice input (Web Speech API, `en-IN` locale)
- Weekly report card (AI-generated adherence insight)
- Starter prompt chips for new users
- Copy message button
- Clear history button (wipes server-side DB history)
- Chat history persisted in Supabase `chat_sessions` table

### `/medical` — Medical Reports
- Upload blood test PDFs
- AI reads the PDF (Gemini multimodal), extracts blood markers, flags abnormal values
- Dietary recommendations: foods to include / avoid based on the report
- Longitudinal trend analysis across multiple reports (e.g. HbA1c improving over 3 reports)
- Report history list with expandable details

### `/medical/trends` — Health Trends
- Visual charts of key blood markers over time
- Powered by data stored in the `medical_reports` table

### `/recipes` — Recipes
- AI-generated recipe suggestions
- Save recipes to personal library

### `/social` — Social / Community
- Social feed feature (in development)

### `/dashboard` — Performance Dashboard
- **Daily Score Card** — 0–100 score with grade (S/A/B/C/D) computed from 4 pillars:
  - Calorie accuracy (30 pts): ±10% of target = full marks, linearly drops off
  - Protein hit (30 pts): ratio of eaten vs target protein
  - Hydration (20 pts): ratio of water consumed vs target
  - Streak/Consistency (20 pts): how many of last 7 days had any logs
  - Expandable breakdown showing per-pillar score bars
- **NutriCoach Daily Briefing** — calls the AI agent on page load with a fixed 3-line briefing prompt; auto-streams and assembles the chunked response
- **Goal Pace Indicator** — uses linear regression over last 14 weight logs to predict weeks-to-goal; falls back to calorie deficit estimate (7700 kcal ≈ 1 kg) if <2 weight points
- **History Trends chart** — line chart over 7D / 30D for calories, weight, protein, carbs, fats, fibre with goal reference line
- **30-Day Consistency heatmap** — clickable calendar grid; clicking a day loads that day's logs
- **Hydration tracker** — current vs target water with animated progress bar
- **Macro Targets card** — per-macro progress bars for the selected date
- **Intake log** — scrollable list of everything eaten on the selected date
- **Inline AI Chat drawer** — floating chat panel (fixed bottom) without leaving the dashboard

### `/admin` — Clinical Admin Panel (role-gated)
- Patient list with search
- Per-patient tabs: Overview, Logs, Trends, Medical, Adherence, Clinical Brief, Patient Advocate, Notes
- AI Clinical Brief: generates a structured clinical nutrition report for the selected patient
- AI Patient Advocate: generates a patient-friendly explanation of their data
- Admin stats utilities (`adminStats.js`)

---

## 4. AI Architecture — Full Breakdown

The product uses **Google Gemini 2.0 Flash** as its AI brain. It is used in four distinct ways:

### 4.1 AI Agent (Agentic AI) — `/api/agent/route.js`
The most sophisticated AI feature. This is a **full AI Agent with agentic behaviour**.
- See Section 5 for the deep dive.

### 4.2 AI Coach — `/api/ai-coach/route.js`
**Type:** Plain Generative AI (one-shot, no tools)
- Fetches the user's last 30 days of food logs from Supabase **server-side**
- Pre-aggregates into daily calorie/protein pattern + top 6 most-eaten foods
- Sends a compact structured prompt to Gemini
- Returns: Trend Analysis, Biggest Blocker, Action Plan (max 200 words)
- Used by the dashboard "Analyse" button

### 4.3 Medical Report Analysis — `/api/medical/analyze/route.js`
**Type:** Multimodal Generative AI (PDF reading)
- Accepts a PDF upload (max 10MB)
- Converts to base64, sends to Gemini as inline data
- Gemini reads the actual document, extracts: blood markers + status (high/low/normal), dietary include/exclude foods, trends vs past reports
- Returns structured JSON (report date, flags, trends, include_foods, exclude_foods, analysis summary)
- Saves to Supabase `medical_reports` table
- Invalidates the agent's `get_medical_context` cache so the agent picks up the new report immediately

### 4.4 Clinical Brief & Patient Advocate — `/api/admin/clinical-brief/route.js`, `/api/admin/patient-advocate/route.js`
**Type:** Generative AI (structured output)
- Receives pre-computed patient stats (avgCals, avgProtein, adherence score, top foods)
- Clinical Brief: generates a 3-section structured report following AMDR/DRI clinical guidelines, intended for a physician or dietitian
- Patient Advocate: generates a patient-friendly plain-English explanation of the same data
- Used only in the admin panel

### 4.5 Weekly Report — `/api/weekly-report/route.js`
**Type:** Generative AI with server-side aggregation
- Fetches current week's logs from Supabase, computes: avg calories, avg protein, days logged, on-target days, adherence score (0–100), weight change
- Sends only the computed numbers to Gemini (no raw logs)
- Generates a 3–4 sentence motivating weekly insight
- Cached in `weekly_insights` table (one per user per week — won't regenerate if already exists)

---

## 5. AI Agent — Deep Dive

### What Makes It an AI Agent
The agent is a full **Agentic AI system** — it decides which tools to call, calls them, gets real data, and may call more tools based on what it learned. This multi-step autonomous loop is what distinguishes it from plain GenAI.

### The Agentic Loop
```
User message
    ↓
Gemini decides → calls tools (Round 1)
    ↓
Server executes tools in parallel → returns results
    ↓
Gemini decides → may call more tools (Round 2)
    ↓
... up to 5 rounds ...
    ↓
Gemini produces final text → streamed word-by-word to user
```

### Tools Available to the Agent

| Tool | What It Does | Cached? |
|---|---|---|
| `get_todays_logs` | Reads today's food diary from Supabase | No |
| `get_logs_for_days` | Reads up to 30 days of food history (pre-aggregated) | No |
| `get_macro_gap` | Calculates remaining calories/protein/carbs for today | No |
| `search_food_database` | Looks up nutrition data from in-memory `FLATTENED_DB` | No (already O(1)) |
| `get_weight_trend` | Reads weight history, returns trend summary | No |
| `get_user_profile` | Reads user's weight, height, goal, activity level | ✅ 5 min TTL |
| `log_food_item` | Writes a food entry to the database | No (write) |
| `generate_meal_plan` | Algorithmically builds a meal plan from macro gap | No |
| `update_goal` | Updates user's fitness goal in DB + invalidates profile cache | No (write) |
| `get_streak` | Counts consecutive logging days | No |
| `save_food_to_database` | Saves a new custom food item to `custom_foods` | No (write) |
| `get_medical_context` | Loads all medical reports + dietary rules | ✅ 60 min TTL |

### Streaming Response Flow (SSE)
```
Server opens ReadableStream immediately
→ SSE: {"type":"tool","name":"get_macro_gap"}      → client shows badge
→ SSE: {"type":"tool","name":"generate_meal_plan"}  → client shows badge
→ SSE: {"type":"chunk","text":"You "}               → text appears
→ SSE: {"type":"chunk","text":"still "}
→ ... 18ms per word ...
→ SSE: {"type":"done","toolsUsed":[...]}            → cursor disappears
```

---

## 6. Production Optimisations

These were all implemented after the initial build. Listed in implementation order.

---

### ✅ Opt-1 — Persistent Rate Limiter
**File:** `app/lib/rateLimit.js`

**Problem:** The original rate limiter used a module-level `Map()`. On Vercel (serverless), every request can spin up a fresh Lambda instance — the Map resets constantly, making rate limiting completely ineffective.

**Fix:** Rate limit counters are now stored in a Supabase `rate_limits` table. Works correctly across all server instances.

**Behaviour:**
- Max 20 requests per user per 60-second sliding window
- Returns HTTP 429 with `Retry-After` header and exact seconds until retry
- Fails open (allows request) if Supabase is unreachable — users are never blocked by our own infra issues
- Requires `SUPABASE_SERVICE_ROLE_KEY` env var (service role bypasses RLS for this internal table)

**SQL to run once:**
```sql
create table if not exists rate_limits (
  user_id      uuid primary key,
  count        integer not null default 1,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;
create policy "service role only" on rate_limits using (false);
```

---

### ✅ Opt-2 — Server-Side Chat History (Security)
**Files:** `app/api/agent/history/route.js`, `app/api/agent/route.js`, `app/agent/page.js`

**Problem:** The entire chat history was stored in `localStorage` and sent in the POST body on every request. The server trusted it blindly. A user could inject fake `model` messages to manipulate the AI's behaviour (prompt injection via history).

**Fix:** Chat history is now stored in a Supabase `chat_sessions` table. The server loads history itself — nothing history-related comes from the client. Client only sends the current `message`.

**New API endpoints:**
- `GET /api/agent/history?userId=&accessToken=` — load last 40 messages for page load
- `DELETE /api/agent/history` — wipe all history (called by "Clear" button)

**Additional benefit:** History is now synced across all devices (not just one browser).

**SQL to run once:**
```sql
create table if not exists chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  role       text not null check (role in ('user', 'model')),
  content    text not null,
  tools_used text[] default '{}',
  created_at timestamptz default now()
);
alter table chat_sessions enable row level security;
create policy "Users manage own chat" on chat_sessions
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index chat_sessions_user_created on chat_sessions (user_id, created_at desc);
```

---

### ✅ Opt-3 — Token Reduction (Cost)
**Files:** `app/api/agent/route.js` (`get_logs_for_days` tool), `app/api/ai-coach/route.js`

**Problem A — `get_logs_for_days` tool:**
The tool returned a `dailySummary` object where each day contained an `items: []` array of every food name logged. For a 30-day query, this produced hundreds of repeated strings sent to Gemini as tool results.

**Fix:** The tool now returns:
- `dailySummary` with compact keys (`cal/pro/carb/fat/fib/water`) and integer values
- `topFoods` — top 8 most-logged foods across the period (replaces per-day item lists)
- `avgDailyCalories` and `avgDailyProtein` pre-computed
- **Result:** ~60–75% fewer tokens on trend analysis queries

**Problem B — `ai-coach/route.js`:**
The route accepted raw `logs` / `profile` / `weightLogs` arrays from the client (security issue) and sent `JSON.stringify(logs.slice(0, 30))` directly into the prompt.

**Fix:** The route now:
1. Accepts only `userId` + `accessToken` — fetches all data from Supabase itself
2. Pre-aggregates into a daily calorie pattern (text format) + top 6 foods string
3. Sends ~70% fewer tokens to Gemini
4. Uses the correct model name (`gemini-3-flash-preview`)

---

### ✅ Opt-4 — Structured Observability
**File:** `app/api/agent/route.js`

**Problem:** No visibility into what the AI was doing in production — no way to know which queries were slow, which tools were called most, or what things cost.

**Fix:** Every agent request emits one structured JSON log line:
```json
{
  "event": "agent_request",
  "userId": "...",
  "latencyMs": 3241,
  "rounds": 2,
  "toolsUsed": ["get_macro_gap", "generate_meal_plan"],
  "toolCount": 2,
  "inputTokens": 1842,
  "outputTokens": 312,
  "totalTokens": 2154,
  "estimatedCostUsd": 0.000231,
  "messageLength": 38
}
```
Errors emit `agent_error` events with message + stack trace.

**How to use:** In Vercel dashboard → Logs tab → search `agent_request`. Connect Axiom (free Vercel integration) for dashboards, cost summaries, and alerting.

---

### ✅ Opt-5 — In-Memory Tool Result Cache
**Files:** `app/lib/agentCache.js`, `app/api/agent/route.js`, `app/api/medical/analyze/route.js`

**Problem:** The two most expensive tool calls — `get_user_profile` and `get_medical_context` — were hitting Supabase on every single agent request, even when the data hadn't changed at all.

**`get_medical_context`** is particularly expensive: it loads all of the user's medical reports (potentially thousands of tokens of structured data) and sends them to Gemini as a tool result, on every health-related query.

**Fix:** A module-level TTL cache (`agentCache.js`) with 4 operations:

| Function | Purpose |
|---|---|
| `cacheGet(userId, toolName)` | Return cached result or null if missing/expired |
| `cacheSet(userId, toolName, value)` | Store result with TTL |
| `cacheInvalidate(userId, ...toolNames)` | Bust cache immediately |
| `cacheStats()` | Debug: count alive vs expired entries |

**TTLs:**
- `get_user_profile` → **5 minutes** (profile rarely changes mid-session)
- `get_medical_context` → **60 minutes** (only changes on new report upload)

**Automatic invalidation:**
- `update_goal` tool → immediately invalidates `get_user_profile`
- `/api/medical/analyze` (new report uploaded) → immediately invalidates `get_medical_context`

**Why module-level Map works on Vercel:** Vercel reuses warm Lambda containers across multiple requests. The cache is per-user (keyed `userId:toolName`), so there is no cross-user data leakage.

---

### ✅ Opt-6 — Streaming Responses (SSE)
**Files:** `app/api/agent/route.js`, `app/agent/page.js`, `app/globals.css`

**Problem:** Users waited 4–8 seconds staring at a spinner before seeing any response. All tool rounds had to complete AND the full text had to be generated before anything appeared.

**Fix:** The agent API now returns a `ReadableStream` using **Server-Sent Events (SSE)**. The client reads it as it arrives.

**SSE event types:**

| Event | When emitted | Client action |
|---|---|---|
| `{"type":"tool","name":"..."}` | Immediately when tool starts executing | Adds badge to streaming bubble |
| `{"type":"chunk","text":"..."}` | Word by word, 18ms apart | Appends to bubble content |
| `{"type":"done","toolsUsed":[...]}` | After last word streamed | Removes cursor, shows copy button |
| `{"type":"error","message":"..."}` | On any exception | Shows error, removes bubble |

**Architecture change:** POST handler is now two phases:
- **Phase 1** (validation + rate limit): Fast, returns plain `NextResponse.json()` errors
- **Phase 2** (agent execution): Returns `new Response(ReadableStream, { "Content-Type": "text/event-stream" })`

**UI changes in `page.js`:**
- Streaming placeholder message added to state immediately on send
- Inline "Thinking…" → "Processing…" state while tools execute (no content yet)
- `RenderMessage` accepts a `streaming` prop that shows a blinking `▋` cursor
- Copy button hidden until `streaming: false`
- Standalone typing indicator only shown before placeholder exists

**Response headers set:**
```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no   ← disables Nginx buffering on Vercel edge
```

---

### ✅ Opt-7 — Streaming Response Parser (Dashboard Fix)
**File:** `app/dashboard/page.js` (`fetchBriefing`)

**Problem:** The dashboard `fetchBriefing` function used `await res.json()` — expecting a single complete JSON object. But the `/api/agent` route returns a **Server-Sent Events stream** (chunked). The raw chunk objects (`{"type":"chunk","text":"1."}`, `{"type":"tool",...}` etc.) were being rendered directly in the UI as plaintext, visible to users.

**Fix:** `fetchBriefing` was rewritten to:
1. Get a `ReadableStream` reader from `res.body`
2. Decode each chunk with `TextDecoder`
3. Split by newline, try to parse each line as JSON
4. **Only extract** lines where `obj.type === "chunk"` and concatenate their `obj.text` fields
5. Ignore `tool`, `done`, `error` events — those are internal agent signals, not display content
6. Call `setBriefing(reply)` only after the full stream is consumed

**Key lesson:** Any UI that consumes a streaming API must parse the SSE protocol explicitly — `res.json()` only works for one-shot responses.

---

### ✅ Opt-8 — Gemini Context Caching (Cost Reduction)
**File:** `app/api/agent/route.js`

**Problem:** Every agent request re-sent the full system prompt (~850 tokens) + all 13 tool schemas (~1,800 tokens) to Gemini, billed at full input token price. These are **identical on every request** — pure waste.

**Gemini `gemini-3-flash-preview` pricing:**
- Input: $0.50 / 1M tokens
- Output: $3.00 / 1M tokens
- **Cached input: $0.05 / 1M tokens** (90% cheaper)

**Fix:** Implemented `getOrCreateCachedModel(apiKey)` — a module-level async function:

```
First request in a serverless instance:
  → GoogleAICacheManager.create({ systemInstruction, tools, ttlSeconds: 3600 })
  → genAI.getGenerativeModelFromCachedContent(cache)
  → stores model + expiry in module-level vars

Requests 2–N (within 55 min):
  → returns the same model from memory (no API call)
  → cached tokens billed at $0.05/1M instead of $0.50/1M

After 55 min:
  → deletes old cache, creates a new one automatically

If cache creation fails (e.g. token count below 4,096 minimum):
  → silently falls back to a plain model (no downtime)
  → logs { event: "gemini_cache_fallback", reason: "..." }
```

**Cache state (module-level, lives for lifetime of serverless instance):**
```js
let _cachedModel   = null;   // the model bound to cached content
let _cacheExpireAt = 0;      // epoch ms when cache becomes stale
let _cacheName     = null;   // Gemini resource name (for deletion)
```

**Updated observability log includes:**
```json
{
  "cachedTokens": 2650,
  "cacheHitRate": "50%",
  "estimatedCostUsd": 0.000207   // accounts for 90% discount on cached tokens
}
```

**Important:** Requires a **GA model version** (e.g. `gemini-3-flash-preview-001`) for the cache; preview model strings may not support it. The fallback path handles this transparently.

---

## 7. Architecture Decisions & Tradeoffs

This section documents the "why" behind key design choices — useful for technical interviews.

---

### Why Next.js API routes instead of a separate backend?

**Current:** All backend logic lives in `app/api/` as Next.js route handlers.

**Pros:**
- Zero extra deployment infrastructure — one `vercel deploy` ships everything
- Shared TypeScript types between frontend and API (if migrating to TS)
- Same environment variables across frontend and backend
- Fast to iterate — one repo, one build

**Cons (and why we're aware of them):**
- Serverless cold starts can delay the first agent response
- Module-level caches (like `agentCache.js` and `_cachedModel`) reset on cold starts — cache misses are expected after scale-to-zero
- Hard to test API routes without booting Next.js
- Can't independently scale the AI-heavy backend from the lightweight frontend

**Future path:** Migrate `app/api/agent/` to a **FastAPI (Python) backend** for better LangGraph/LangChain support, independent scaling, and richer observability.

---

### Why stream the agent response (SSE) instead of waiting for the full reply?

**Perceived latency vs actual latency:**
- Actual latency for a 2-tool agent call: ~3–5 seconds
- Without streaming: user sees spinner for 3–5 seconds, then text appears
- With streaming: user sees tool badges at ~300ms, first word at ~1.5s, text builds live

**Implementation tradeoff:** SSE adds parsing complexity on the client (the bug we fixed in Opt-7 is a direct consequence). But the UX improvement is significant enough that it's worth it at any scale.

---

### Why store chat history in Supabase instead of client-side?

Three reasons:
1. **Security:** Client-sent history could be manipulated (inject fake `model` messages to gaslight the AI)
2. **Cross-device sync:** User opens app on phone and continues conversation started on desktop
3. **Prompt injection via history:** A user could craft a `model` message in localStorage containing injection patterns. Server-side loading + `sanitizeHistoryContent()` scrubs these before they reach Gemini

---

### Why use an in-memory cache (`agentCache.js`) for tool results?

The two most expensive tools — `get_user_profile` and `get_medical_context` — return data that almost never changes mid-session:
- A user's height/weight/goal doesn't change between chat messages
- Medical reports only update when a new PDF is uploaded

Hitting Supabase + sending potentially 2,000+ tokens of medical report data to Gemini on every single message is wasteful. The TTL cache eliminates these repeated fetches.

**Why it's safe on serverless:** Vercel reuses warm container instances. The cache is keyed `userId:toolName` — no user's data bleeds into another's cache entry.

---

### LangChain / LangGraph — Why not yet?

We evaluated this thoroughly. Summary:

| What we hand-rolled | LangGraph equivalent |
|---|---|
| `while (functionCalls)` loop in route.js | `create_react_agent` handles it |
| `if tool === "X" { ... }` dispatch | `@tool` decorated functions |
| History size management | `trim_messages` + `MemorySaver` |
| SSE streaming assembly | `agent.astream()` native output |
| System prompt string | `ChatPromptTemplate` |

**Estimated savings from migration:** ~800 lines of hand-rolled agent code → ~50 lines.

**Why not done yet:** LangGraph Python is the production-grade version. Migrating to it requires:
1. Splitting the backend into a separate FastAPI service
2. Moving all tools to Python
3. Updating the frontend to point to new URLs

This is planned as the next major architectural step.

---

### Model choice — `gemini-3-flash-preview`

| Model | Input price | Output price | Notes |
|---|---|---|---|
| `gemini-3-flash-preview` | $0.50/1M | $3.00/1M | Current — best quality |
| `gemini-2.5-flash` | $0.30/1M | $2.50/1M | 40% cheaper, similar quality |
| `gemini-2.5-flash-lite` | $0.10/1M | $0.40/1M | 80% cheaper, good for simple queries |
| `gemini-3-flash-preview` | $0.10/1M | $0.40/1M | **Deprecated as of June 1 2026** |

**Current bill:** ~₹106/month at ~342 requests/month (11/day)
**With cache:** ~₹67/month (Opt-8)
**With model routing to flash-lite for simple queries:** ~₹25–35/month

---

## 8. Cost Analysis & Token Economics

### Token breakdown per agent request

| Component | Tokens | % of input |
|---|---|---|
| System prompt | ~850 | 16% |
| 13 tool schemas | ~1,800 | 34% ← largest single waste |
| Chat history (20 msgs) | ~2,000 | 38% |
| User message | ~80 | 1.5% |
| Tool call results | ~600 | 11% |
| **Total input** | **~5,330** | |
| Output (reply) | ~200 | — |

### Cost per request — before and after optimisations

| State | Input cost | Output cost | Total | Monthly (342 req) |
|---|---|---|---|---|
| **Before Opt-8 (no cache)** | $0.002665 | $0.000600 | $0.003265 | $1.117 = **₹106** |
| **After Opt-8 (with cache)** | $0.001473 | $0.000600 | $0.002073 | $0.709 = **₹67** |
| **+ Trim history to 8 msgs** | $0.001223 | $0.000600 | $0.001823 | $0.624 = **₹59** |
| **+ Dynamic tool selection** | $0.000773 | $0.000600 | $0.001373 | $0.470 = **₹45** |

### How the ₹106 bill was reverse-engineered

```
₹106 ÷ ₹95/dollar = $1.116 total spend
$1.116 ÷ $0.003265 per request = ~342 requests in May
342 ÷ 31 days = ~11 requests/day

This includes:
- User chat messages
- Auto-fired fetchBriefing() on every dashboard page load
  (this was the silent cost — each page open = 1 full agent call)
```

### Biggest levers to reduce cost (in order of impact)

1. **Add a 30-min cooldown to `fetchBriefing`** — prevents silent agent calls on every dashboard open (estimated ₹15-20/month saving)
2. **Trim history from 20 → 8 messages** — 1 line change, saves ~1,200 tokens per request
3. **Dynamic tool selection** — route simple queries ("what's my streak?") to send only 3-4 relevant tools instead of all 13
4. **Model routing** — use `gemini-2.5-flash-lite` for simple/fast queries, `gemini-3-flash-preview` only for complex analysis

---

## 9. File Map

```
app/
├── page.js                          Main dashboard (home)
├── globals.css                      Global styles + keyframes
├── food-data.js                     Built-in food database (FLATTENED_DB)
├── supabase.js                      Supabase client (browser)
├── layout.js                        Root layout + PWA meta
│
├── lib/
│   ├── nutrition.js                 calculateTargets() — TDEE, macros, water
│   ├── rateLimit.js                 ✅ Supabase-backed rate limiter (Opt-1)
│   └── agentCache.js               ✅ In-memory TTL cache for agent tools (Opt-5)
│
├── agent/
│   └── page.js                      NutriCoach chat UI
│
├── api/
│   ├── agent/
│   │   ├── route.js                 ✅ AI Agent — SSE streaming, agentic loop
│   │   └── history/
│   │       └── route.js             ✅ GET/DELETE chat history (Opt-2)
│   ├── ai-coach/
│   │   └── route.js                 ✅ One-shot AI analysis (Opt-3)
│   ├── weekly-report/
│   │   └── route.js                 Weekly AI insight (already optimised)
│   ├── medical/
│   │   ├── analyze/
│   │   │   └── route.js             PDF medical report analysis (multimodal)
│   │   └── history/
│   │       └── route.js             Fetch past reports
│   ├── admin/
│   │   ├── clinical-brief/
│   │   │   └── route.js             AI clinical brief for admin panel
│   │   └── patient-advocate/
│   │       └── route.js             AI patient advocate summary
│   └── recipes/
│       ├── generate/ list/ save/    Recipe AI endpoints
│
├── admin/
│   └── page.js                      Clinical admin panel
│
├── medical/
│   ├── page.js                      Medical reports UI
│   └── trends/page.js               Health trend charts
│
├── components/
│   ├── BottomNav.js                 App navigation bar
│   ├── FoodTimeline.js             Today's log list
│   ├── SmartRecsPanel.js           Rule-based macro recommendations
│   ├── StatsBoard.js               Macro ring stats
│   └── modals/                      EditLog, ManualEntry, MealBuilder, etc.
│
└── hooks/
    ├── useAuth.js                   Auth state hook
    └── useNutrition.js              Food log state + CRUD hook
```

---

## 10. Environment Variables

| Variable | Where used | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everywhere (points to Cloudflare proxy) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everywhere | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `rateLimit.js` only (bypasses RLS) | ✅ |
| `GEMINI_API_KEY` | All AI routes | ✅ |

> **Note:** `NEXT_PUBLIC_SUPABASE_URL` points to your Cloudflare Worker proxy URL, not `supabase.co` directly. The proxy forwards requests to Supabase, transparent to all app code.

---

## 11. Supabase Tables Reference

| Table | Purpose | RLS |
|---|---|---|
| `auth.users` | Built-in Supabase auth | Built-in |
| `user_profiles` | Weight, height, goal, activity, targets | User owns own row |
| `food_logs` | Daily food entries | User owns own rows |
| `weight_logs` | Daily weight entries | User owns own rows |
| `custom_foods` | User-saved custom food items | User owns own rows |
| `medical_reports` | Uploaded blood test analyses | User owns own rows |
| `weekly_insights` | AI weekly report cache (one per user/week) | User owns own rows |
| `goal_history` | Snapshot of goal on each change date | User owns own rows |
| `rate_limits` | ✅ Request rate counters (Opt-1) | Service role only |
| `chat_sessions` | ✅ Agent conversation history (Opt-2) | User owns own rows |

---

*Last updated: June 2026 — after streaming parser fix, Gemini context caching, cost analysis, and architecture review session.*
