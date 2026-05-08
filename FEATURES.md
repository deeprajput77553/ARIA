# 🤖 Autonomous AI Agent — Feature Documentation

> A complete reference for every feature in the system, what it does, how it works, and why it exists.

**Version:** 1.0.0  
**Last Updated:** 2026-05-04  
**Project:** Self-improving Autonomous Coding + System-Control AI

---

## Table of Contents

- [F-01 · Self-Generating Code](#f-01--self-generating-code)
- [F-02 · Sandbox Testing](#f-02--sandbox-testing)
- [F-03 · Code Validation](#f-03--code-validation)
- [F-04 · Safe Code Integration](#f-04--safe-code-integration)
- [F-05 · React / UI Component Generation](#f-05--react--ui-component-generation)
- [F-06 · Memory System (RAG)](#f-06--memory-system-rag)
- [F-07 · Short-Term Memory](#f-07--short-term-memory)
- [F-08 · Long-Term Memory](#f-08--long-term-memory)
- [F-09 · Parallel Session Handling](#f-09--parallel-session-handling)
- [F-10 · Task Queue](#f-10--task-queue)
- [F-11 · Mouse & Keyboard Control](#f-11--mouse--keyboard-control)
- [F-12 · Screen Vision](#f-12--screen-vision)
- [F-13 · Accessibility Tree Reading](#f-13--accessibility-tree-reading)
- [F-14 · AI Agent Loop](#f-14--ai-agent-loop)
- [F-15 · LLM Worker](#f-15--llm-worker)
- [F-16 · Session Manager](#f-16--session-manager)
- [F-17 · Audit Logging](#f-17--audit-logging)
- [F-18 · Retry & Recovery](#f-18--retry--recovery)
- [F-19 · Git Snapshot & Rollback](#f-19--git-snapshot--rollback)
- [F-20 · Action Whitelist & Safety Gate](#f-20--action-whitelist--safety-gate)

---

## F-01 · Self-Generating Code

**Category:** Core Engine  
**Status:** Required — Phase 1

### What it does
The system can write brand-new functions, modules, or files from scratch when a task requires something that doesn't already exist in the codebase. Rather than relying on hardcoded logic, the AI generates purpose-built code on demand.

### How it works
1. The LLM Worker receives a task description (e.g., *"create a function that debounces API calls"*)
2. It first checks the codebase and memory for an existing solution
3. If none exists, it builds a structured prompt with: the task, project conventions, allowed imports, and output format constraints
4. The LLM returns a JSON object — never raw text — containing the code and test cases
5. The output is passed to the Sandbox Tester before anything else happens

### Why it matters
Without this feature the system is a static tool. With it, the AI can extend itself to solve new problems as they arise.

### Key constraint
> The AI **never** saves generated code directly to disk. All output must pass through the Sandbox Tester and Validator first.

### Example
```
Input:  "I need a function to validate email addresses"
Output: { code: "function validateEmail(email) { ... }", tests: [...], filename: "validateEmail.js" }
```

---

## F-02 · Sandbox Testing

**Category:** Quality & Safety  
**Status:** Required — Phase 1

### What it does
Every piece of AI-generated code is executed inside a completely isolated temporary environment before it touches the real project. If the code fails or crashes, nothing in your actual codebase is affected.

### How it works
1. A unique temporary directory is created: `/tmp/sandbox-<uuid>`
2. Only the minimum required dependencies are copied in (no access to the real `src/`)
3. The generated code file and its test file are written into the sandbox
4. Tests are executed: `jest --testPathPattern=sandbox-<uuid>`
5. stdout, stderr, and exit code are captured
6. The result object `{ passed, output, errors }` is returned
7. The sandbox directory is deleted immediately after — pass or fail

### Why it matters
Generated code can contain bugs, infinite loops, or side effects. Running it in isolation means the worst case is a failed test, not a broken application.

### Sandbox rules
- No network access inside sandbox
- No access to real project files
- No persistent state between sandbox runs
- Maximum execution time: 30 seconds (then force-killed)

---

## F-03 · Code Validation

**Category:** Quality & Safety  
**Status:** Required — Phase 1

### What it does
After sandbox testing, the Validator applies a deterministic checklist to the code before it can be integrated into the real project. This is a second, independent gate that doesn't rely on the AI's judgment.

### How it works
The Validator runs the following checks in order:

| Check | Description | On Fail |
|-------|-------------|---------|
| **Syntax** | No parse errors in the generated file | Retry |
| **Tests passed** | All unit tests returned green | Retry |
| **No `eval()`** | Blocks dynamic code execution | Reject |
| **No `exec()`** | Blocks shell command injection | Reject |
| **No `process.exit()`** | Prevents silent crashes | Reject |
| **No unsafe `fs` ops** | Blocks deletes outside `/tmp` | Reject |
| **No `child_process`** | Unless explicitly whitelisted | Reject |
| **File size** | Under 500 lines (configurable) | Warn |
| **Name match** | Generated name matches requested target | Retry |

### Output
```json
{
  "valid": true,
  "passed_checks": ["syntax", "tests", "no_eval"],
  "failed_checks": [],
  "recommendation": "accept | retry | reject"
}
```

### Why it matters
LLMs can produce plausible-looking code that is subtly dangerous. The Validator catches patterns that tests won't find — like code that works but also deletes files as a side effect.

---

## F-04 · Safe Code Integration

**Category:** Codebase Management  
**Status:** Required — Phase 2

### What it does
After a piece of code passes both the Sandbox Tester and Validator, the Safe Integrator places it into the real codebase using controlled, reversible methods. The AI is never allowed to freely overwrite or edit files.

### How it works
Three integration methods are available, in order of preference:

#### Method A — Marker Slots *(simplest)*
You place designated slots in your source files where AI is permitted to insert code:
```jsx
{/* AI_SLOT: UserCard */}
```
The integrator scans for the matching slot name and inserts only within that boundary. Nothing outside the slot is touched.

#### Method B — AST Patching *(precise)*
Uses Babel (for JavaScript) or `libcst` (for Python) to parse the file into an Abstract Syntax Tree and surgically insert a new node — a function, class, or import — at a specific location, without affecting any surrounding code.

#### Method C — JSON Patch Instructions *(auditable)*
The LLM returns a structured diff object instead of a code string:
```json
{
  "op": "insert_after",
  "target": "function handleLogin",
  "content": "function handleLogout() { ... }"
}
```
The integrator applies the patch mechanically, making the change fully traceable and reversible.

### Why it matters
Allowing an AI to freely edit source files is a direct path to a corrupted codebase. Controlled integration means every change is bounded, logged, and undoable.

### Non-negotiable rules
- A git snapshot is created **before** every integration
- All changes are written to the audit log
- The integrator only operates within the project's `src/` directory
- Entire-file overwrites are not permitted

---

## F-05 · React / UI Component Generation

**Category:** Frontend  
**Status:** Required — Phase 1

### What it does
The system can generate complete React components, including their JSX structure, props interface, styling (Tailwind / CSS modules), and a corresponding test file — all in one generation step.

### How it works
1. The task specifies component name, purpose, expected props, and any interaction requirements
2. The Code Generator uses a React-specific prompt template that enforces:
   - Functional component syntax
   - Default export
   - PropTypes or TypeScript interface (based on project config)
   - No hardcoded data — props only
3. Two files are generated together: `ComponentName.jsx` and `ComponentName.test.jsx`
4. The test file includes at minimum:
   - A render-without-crash test
   - A snapshot test
   - Interaction tests if the component has event handlers
5. Both files run through Sandbox Tester using React Testing Library

### Why UI is harder than pure functions
UI components don't return simple values — they render virtual DOM trees and respond to user interactions. Standard function testing doesn't apply. The sandbox must include a DOM environment (jsdom) to render and test them properly.

### Example generated test
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import LogoutButton from './LogoutButton';

test('renders without crashing', () => {
  render(<LogoutButton onLogout={() => {}} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('calls onLogout when clicked', () => {
  const mockLogout = jest.fn();
  render(<LogoutButton onLogout={mockLogout} />);
  fireEvent.click(screen.getByRole('button'));
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
```

---

## F-06 · Memory System (RAG)

**Category:** Intelligence  
**Status:** Required — Phase 3

### What it does
Retrieval-Augmented Generation (RAG) gives the AI access to relevant past context — decisions made, code written, user preferences, project structure — without cramming everything into the prompt at once.

### How it works
```
New Input Text
      │
      ▼
  Embedding Model          ← Converts text to a numerical vector
      │
      ▼
  Vector Store             ← Stores vector alongside the original text + metadata
      │
      ▼
  Similarity Search        ← On new input, finds the top-K most similar stored vectors
      │
      ▼
  Retrieved Snippets       ← Injected into the LLM prompt as context
```

### What gets stored
- Function signatures and their purpose
- File locations and what they contain
- Past decisions ("User prefers Tailwind over styled-components")
- Error resolutions ("This error was caused by missing key prop — fixed by X")
- Project conventions and patterns

### Why it matters
Without memory, the AI starts from zero on every task. With RAG, it knows your project's structure, your preferences, and what's already been done — making its output progressively more accurate over time.

### Storage tool
**ChromaDB** — runs locally, no external server required, supports similarity search out of the box.

---

## F-07 · Short-Term Memory

**Category:** Intelligence  
**Status:** Part of F-06

### What it does
Holds context that is relevant only for the current session — the current task, recent messages, intermediate results. It is discarded when the session ends.

### How it works
Stored as an in-memory array within the active session object. Each entry has a type (`user_input`, `ai_response`, `tool_result`) and a timestamp. The most recent N entries are prepended to every LLM prompt within the session.

### Example
```
Session: "Build a login form"
  [0] user: "Add a forgot password link"
  [1] ai:   "Added anchor tag below submit button"
  [2] user: "Make it open a modal instead"
  ← All 3 entries injected into next prompt
```

---

## F-08 · Long-Term Memory

**Category:** Intelligence  
**Status:** Part of F-06

### What it does
Stores facts, decisions, and outcomes that should persist across all future sessions — not just the current one. This is the AI's "knowledge base" about your specific project.

### How it works
After each completed task, the system extracts key facts using a summarization prompt and saves them as vector embeddings in ChromaDB with metadata tags. On the next task, relevant entries are retrieved by similarity search and injected into the prompt.

### Retention policy
Long-term memory entries are kept indefinitely by default. You can configure expiry rules (e.g., "delete entries older than 90 days that haven't been retrieved").

---

## F-09 · Parallel Session Handling

**Category:** Performance  
**Status:** Required — Phase 4

### What it does
Allows multiple tasks to run at the same time without any one task blocking another. A user can submit five different code generation requests and all five will be processed concurrently.

### How it works
- Each incoming request is assigned a unique `sessionId` and pushed onto the task queue immediately
- Multiple worker processes pull tasks from the queue independently
- Sessions are completely isolated — they share no in-memory state
- Results are stored per-session and retrieved when complete

### Concurrency safety
- File-write locks prevent two workers from writing to the same file simultaneously
- Each worker uses its own isolated sandbox directory
- The task queue handles retry logic and dead-letter queuing for failed tasks

### Why it matters
Without parallelism, a slow code generation task (10–30 seconds) would block all other requests. With a queue, the system remains responsive regardless of how many tasks are in flight.

---

## F-10 · Task Queue

**Category:** Infrastructure  
**Status:** Required — Phase 4

### What it does
A persistent, async queue that decouples incoming requests from task processing. Requests are accepted instantly and processed as workers become available.

### How it works
- Built on **BullMQ** (Node.js) backed by Redis
- Incoming tasks are serialized and pushed to the queue
- Worker processes subscribe to the queue and pull tasks one at a time
- Failed tasks are automatically retried up to 3 times with exponential backoff
- Tasks that exhaust retries are moved to a dead-letter queue for inspection

### Task lifecycle
```
submitted → queued → picked_up → processing → done
                                     └──► failed → retrying → dead_letter
```

### Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| Max retries | 3 | Per task before dead-lettering |
| Retry delay | 2s, 4s, 8s | Exponential backoff |
| Worker concurrency | 3 | Simultaneous workers |
| Job timeout | 120s | Max time per task |

---

## F-11 · Mouse & Keyboard Control

**Category:** System Control  
**Status:** Optional — Phase 5

### What it does
Enables the AI to interact with the desktop — clicking buttons, typing text, pressing keyboard shortcuts — as if a human were operating the computer.

### How it works
The AI never issues raw mouse/keyboard commands directly. Instead it outputs a structured action JSON, which the Action Layer validates and executes:

```json
{ "action": "click",     "x": 740, "y": 420 }
{ "action": "type",      "text": "hello@example.com" }
{ "action": "press_key", "key": "Enter" }
{ "action": "shortcut",  "keys": ["ctrl", "s"] }
```

### Tools
- **robotjs** — Node.js, cross-platform
- **pyautogui** — Python, cross-platform

### Preferred alternative
Before using mouse/keyboard, the system always checks if a direct method exists:
- Open a website? → `open_url` instead of clicking a browser icon
- Launch an app? → `open_app` instead of finding its taskbar icon
- Fill a form? → Use the browser's URL/automation API

Direct methods are faster, more reliable, and don't break when the UI changes.

---

## F-12 · Screen Vision

**Category:** System Control  
**Status:** Optional — Phase 5

### What it does
Provides the AI with a visual or structural representation of the current screen state so it can make informed decisions about what to do next.

### Three approaches

#### 1. Screenshot + AI Vision
- Takes a screenshot and sends it to a vision-capable LLM
- Asks: *"What element should I click to do X?"*
- **Reliability:** Low — coordinates from vision models are often imprecise
- **Cost:** High — vision API calls are expensive
- **Best for:** Fallback when nothing else works

#### 2. Image Template Matching
- Stores reference images of known UI elements (buttons, icons, dialogs)
- Compares them against the current screenshot using pixel similarity
- **Reliability:** Good when the UI is stable
- **Weakness:** Breaks if the UI changes (resize, theme change, update)
- **Best for:** Known, static interfaces

#### 3. Accessibility APIs *(recommended)*
- Queries the OS accessibility tree for structured UI element data
- Returns element type, label, position, and state — no image processing needed
- **Reliability:** Excellent — works regardless of visual appearance
- **Tools:** AT-SPI (Linux), UIAutomation (Windows), AXUIElement (macOS)
- **Best for:** All production use cases

---

## F-13 · Accessibility Tree Reading

**Category:** System Control  
**Status:** Optional — Phase 5

### What it does
Reads the operating system's accessibility API to get a structured tree of all visible UI elements — buttons, text fields, menus, checkboxes — without taking a screenshot. This gives the AI reliable, machine-readable UI state.

### How it works
```
OS Accessibility API
        │
        ▼
  Element Tree Query      ← "Give me all clickable elements on screen"
        │
        ▼
  Structured Response:
  [
    { type: "button",    label: "Submit",   x: 400, y: 300, enabled: true },
    { type: "textfield", label: "Email",    x: 200, y: 180, value: "" },
    { type: "checkbox",  label: "Remember", x: 200, y: 350, checked: false }
  ]
        │
        ▼
  Injected into LLM prompt as context for next action decision
```

### Why this beats screenshots
Screenshots require vision model inference, cost API tokens, return imprecise coordinates, and fail when the screen DPI changes. Accessibility trees are free, instant, deterministic, and return exact element positions.

---

## F-14 · AI Agent Loop

**Category:** Autonomy  
**Status:** Optional — Phase 5

### What it does
Enables the AI to complete multi-step tasks autonomously by repeatedly observing the current state, deciding on the next action, executing it, and observing again — until the task is complete.

### How it works
```
┌─────────────────────────────────────┐
│  1. OBSERVE                         │
│     Screenshot or accessibility     │
│     tree of current screen state    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. THINK                           │
│     Send state + task to LLM        │
│     "Given this screen, what        │
│      should I do next?"             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. ACT                             │
│     Execute returned action via     │
│     the Action Layer (validated)    │
└──────────────┬──────────────────────┘
               │
               ▼
         Is task done?
          /         \
        YES          NO (loop back to step 1)
          │
          ▼
     Log result + end session
```

### Safety limits
| Limit | Value | Reason |
|-------|-------|--------|
| Max iterations | 20 | Prevents infinite loops |
| Max execution time | 5 minutes | Hard timeout per agent run |
| Human confirmation | Required for destructive actions | Prevents data loss |

---

## F-15 · LLM Worker

**Category:** Core Engine  
**Status:** Required — Phase 1

### What it does
The LLM Worker is the AI's "brain." It takes a task, gathers relevant context from memory, constructs a precise prompt, calls the language model, and parses the response into a structured action object.

### How it works
1. Receives a task from the queue
2. Queries the Memory System for relevant context (top-3 to top-5 results)
3. Builds the prompt using a template:
   ```
   [System instructions]
   [Project conventions from memory]
   [Relevant past decisions from memory]
   [Current task description]
   [Required output format: JSON only]
   ```
4. Calls the LLM (Ollama locally, or OpenAI/Anthropic API remotely)
5. Strips markdown fences from the response
6. Parses JSON safely — catches malformed responses
7. Validates that the parsed object has all required fields
8. Routes to the correct module based on `action` type

### Supported LLMs
| Model | Type | Best for |
|-------|------|---------|
| `codellama` | Local (Ollama) | Code generation, offline use |
| `deepseek-coder` | Local (Ollama) | Code generation, strong performance |
| `llama3` | Local (Ollama) | General reasoning, planning |
| `gpt-4o` | Remote (OpenAI) | Highest quality, complex tasks |
| `claude-sonnet` | Remote (Anthropic) | Reasoning + code, nuanced tasks |

---

## F-16 · Session Manager

**Category:** Infrastructure  
**Status:** Required — Phase 1

### What it does
Creates, tracks, and cleans up isolated sessions for every incoming request. Sessions ensure that parallel tasks don't share state and that the full context of each task is preserved for logging and debugging.

### Session lifecycle
```
Request arrives → Session created (status: pending)
                      │
                      ▼
               Task queued (status: queued)
                      │
                      ▼
               Worker picks up (status: running)
                      │
                      ▼
               Task completes → (status: done)
               Task fails     → (status: failed)
```

### Session data shape
```json
{
  "sessionId":  "a3f2b1c4-...",
  "status":     "done",
  "input":      "Add a logout button to the header",
  "output":     { "file": "LogoutButton.jsx", "integrated": true },
  "createdAt":  "2026-05-04T10:22:00Z",
  "completedAt":"2026-05-04T10:22:18Z",
  "logs":       ["Sandbox passed", "Validator passed", "Integrated to AI_SLOT:HeaderActions"]
}
```

---

## F-17 · Audit Logging

**Category:** Safety & Transparency  
**Status:** Required — Phase 2

### What it does
Records every significant action the AI takes — what it generated, what was validated, what was integrated, what system actions were executed — with a full timestamp and the input that triggered it.

### What gets logged
| Event | Logged data |
|-------|-------------|
| Code generated | Task, filename, line count, model used |
| Sandbox run | Pass/fail, test output, execution time |
| Validation result | Which checks passed/failed |
| Code integrated | File path, method used (slot/AST/patch), git hash before |
| System action | Action type, parameters, result |
| Task failed | Error message, retry count, final status |

### Log format
```json
{
  "timestamp": "2026-05-04T10:22:15Z",
  "sessionId": "a3f2b1c4",
  "event":     "code_integrated",
  "details": {
    "file":    "src/components/LogoutButton.jsx",
    "method":  "marker_slot",
    "slot":    "AI_SLOT:HeaderActions",
    "gitHash": "d4e5f6a"
  }
}
```

### Why it matters
When something goes wrong — and it will — the audit log tells you exactly what the AI did, when, and why. Without it, debugging AI-driven changes is nearly impossible.

---

## F-18 · Retry & Recovery

**Category:** Reliability  
**Status:** Required — Phase 1

### What it does
When a code generation attempt fails validation or sandbox tests, the system automatically retries with enriched context — including the error message — rather than immediately giving up or silently producing bad output.

### How it works
1. First attempt fails (e.g., test throws `TypeError: X is not a function`)
2. The error message is appended to the next generation prompt:
   ```
   Previous attempt failed with: TypeError: X is not a function
   The issue was likely: missing function export or incorrect parameter name.
   Please fix this in your next attempt.
   ```
3. The LLM generates a new version with this context
4. The new version goes through the full Sandbox → Validate cycle again

### Retry limits
| Scenario | Max retries | After limit |
|----------|-------------|-------------|
| Sandbox test failure | 3 | Task marked FAILED |
| Validator rejection | 3 | Task marked FAILED |
| LLM JSON parse error | 2 | Task marked FAILED |
| Network/API error | 5 | Task marked FAILED |

### Why a cap is essential
Without a retry cap, a persistently failing task could consume unlimited API tokens, run indefinitely, and block the queue. Three retries is enough for the LLM to self-correct; beyond that, human review is needed.

---

## F-19 · Git Snapshot & Rollback

**Category:** Safety  
**Status:** Required — Phase 2

### What it does
Before every code integration, the system automatically creates a git commit that captures the current state of the codebase. If the integrated code causes problems, you can restore to the pre-integration state with a single command.

### How it works
```bash
# Before integration
git add -A
git commit -m "AI_SNAPSHOT: before integrating LogoutButton [session: a3f2b1c4]"

# Integration happens here

# If something goes wrong
git revert HEAD     # Undo the AI's commit
# or
git reset --hard HEAD~1   # Hard reset to snapshot
```

### What the commit message contains
- Prefix: `AI_SNAPSHOT:`
- Description of what is about to be integrated
- Session ID for cross-referencing the audit log
- Timestamp

### Why it matters
AI-generated code that passes all tests can still cause issues at runtime or introduce unexpected behavior. A git snapshot means every AI integration is reversible, giving you a safety net with zero extra effort.

---

## F-20 · Action Whitelist & Safety Gate

**Category:** Safety  
**Status:** Required — Phase 5

### What it does
Before any system control action (mouse click, keyboard input, file open, URL launch) is executed, it is checked against a hardcoded whitelist. Actions not on the list are silently blocked and logged.

### Allowed actions (whitelist)
| Action | Description |
|--------|-------------|
| `click` | Click at X, Y coordinates |
| `type` | Type a string of text |
| `press_key` | Press a named key (Enter, Tab, Escape, etc.) |
| `shortcut` | Execute a key combination (Ctrl+S, Cmd+Z, etc.) |
| `open_url` | Open a URL in the default browser |
| `open_app` | Launch a named application |
| `screenshot` | Capture the current screen |
| `scroll` | Scroll up/down at a position |

### Permanently blocked actions
These cannot be whitelisted or overridden, ever:

- ❌ Delete any file or directory
- ❌ Format or wipe a drive
- ❌ Send an email or message without explicit user confirmation
- ❌ Access files outside the designated workspace directory
- ❌ Execute arbitrary shell commands
- ❌ Modify system settings or registry
- ❌ Install or uninstall software

### Why this matters
The most dangerous failure mode for an AI system-control agent is executing a destructive action that can't be undone. The whitelist ensures that no matter what the LLM outputs, the worst possible outcome is a blocked action and a log entry — not data loss.

---

## Summary Table

| ID | Feature | Phase | Category | Risk if Missing |
|----|---------|-------|----------|-----------------|
| F-01 | Self-Generating Code | 1 | Core | System can't extend itself |
| F-02 | Sandbox Testing | 1 | Safety | Bad code runs in production |
| F-03 | Code Validation | 1 | Safety | Unsafe code gets integrated |
| F-04 | Safe Code Integration | 2 | Codebase | AI can corrupt source files |
| F-05 | React / UI Generation | 1 | Frontend | Can't generate UI components |
| F-06 | Memory System (RAG) | 3 | Intelligence | AI forgets everything |
| F-07 | Short-Term Memory | 3 | Intelligence | No within-session context |
| F-08 | Long-Term Memory | 3 | Intelligence | No cross-session learning |
| F-09 | Parallel Sessions | 4 | Performance | Tasks block each other |
| F-10 | Task Queue | 4 | Infrastructure | No async processing |
| F-11 | Mouse & Keyboard Control | 5 | System Control | Can't interact with desktop |
| F-12 | Screen Vision | 5 | System Control | AI is blind to screen state |
| F-13 | Accessibility Tree | 5 | System Control | Unreliable screen reading |
| F-14 | AI Agent Loop | 5 | Autonomy | Can't do multi-step tasks |
| F-15 | LLM Worker | 1 | Core | No AI reasoning capability |
| F-16 | Session Manager | 1 | Infrastructure | No task isolation |
| F-17 | Audit Logging | 2 | Transparency | Can't debug AI actions |
| F-18 | Retry & Recovery | 1 | Reliability | Single failure kills task |
| F-19 | Git Snapshot & Rollback | 2 | Safety | AI changes are irreversible |
| F-20 | Action Whitelist | 5 | Safety | Destructive actions possible |

---

*This document describes every feature in the system. For architecture diagrams and data flow, see `AUTONOMOUS_AI_SYSTEM_REQUIREMENTS.md`.*
