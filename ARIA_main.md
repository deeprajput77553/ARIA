# 🧠 AI OS — Agentic Voice-First Knowledge Graph System
### Master Architecture & Design Document — v2.0

> **"Not chat + AI — but a voice-driven cognitive operating system with graph memory, proactive intelligence, and context-aware presence."**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Philosophy & Design Pillars](#2-core-philosophy--design-pillars)
3. [AI-Initiated Startup System](#3-ai-initiated-startup-system) ⭐ NEW
4. [Proactive Agent Mode](#4-proactive-agent-mode) ⭐ NEW
5. [Voice-First Interface Layer](#5-voice-first-interface-layer)
6. [Wake Word Support](#6-wake-word-support) ⭐ NEW
7. [Voice Personas & Tone Settings](#7-voice-personas--tone-settings) ⭐ NEW
8. [Ambient Passive Mode](#8-ambient-passive-mode) ⭐ NEW
9. [Knowledge Graph Memory System](#9-knowledge-graph-memory-system)
10. [Node Aging & Forgetting Mechanism](#10-node-aging--forgetting-mechanism) ⭐ NEW
11. [Edge Confidence Scoring](#11-edge-confidence-scoring) ⭐ NEW
12. [Graph Pruning & Merging](#12-graph-pruning--merging) ⭐ NEW
13. [Multi-Modal Input Support](#13-multi-modal-input-support) ⭐ NEW
14. [MongoDB Atlas Storage Architecture](#14-mongodb-atlas-storage-architecture)
15. [Tiered Storage System](#15-tiered-storage-system) ⭐ NEW
16. [Short-Term vs Long-Term Memory Split](#16-short-term-vs-long-term-memory-split) ⭐ NEW
17. [LangGraph Agent Execution System](#17-langgraph-agent-execution-system)
18. [Task Dependency Graph (DAG)](#18-task-dependency-graph-dag) ⭐ NEW
19. [Ollama Model Routing](#19-ollama-model-routing)
20. [Tool Capabilities & Permission Tiers](#20-tool-capabilities--permission-tiers) ⭐ UPDATED
21. [Knowledge Processing Pipeline](#21-knowledge-processing-pipeline)
22. [Output Format Specification](#22-output-format-specification)
23. [UI Behavior & Screens](#23-ui-behavior--screens)
24. [Safety Rules & Audit Log](#24-safety-rules--audit-log) ⭐ UPDATED
25. [Final System Role](#25-final-system-role)
26. [Architecture Stack Summary](#26-architecture-stack-summary)
27. [Next Steps & Roadmap](#27-next-steps--roadmap)

---

## 1. System Overview

The **AI OS** is a personal intelligence layer that wraps around your device, your data, and your life. It is not a chatbot. It is not a productivity tool. It is an **operating system brain** — a living, learning, connected intelligence that speaks, thinks, remembers, and acts.

**Key difference from v1.0:** The AI is no longer a passive responder waiting to be activated. It is an **always-aware presence** that initiates conversations based on context, time, behavior patterns, and emotional signals.

### Core Components at a Glance

| Layer | Technology | Role |
|---|---|---|
| 🎤 Voice Interface | Whisper / WebSpeech API | Default input/output |
| 🌙 Proactive Engine | Scheduler + Behavior Analyzer | AI-initiated interactions |
| 🧠 Knowledge Graph | Neo4j-style + MongoDB | Linked memory & ideas |
| 🗄 Storage Backend | MongoDB Atlas + Redis | Hot/warm/cold tiered storage |
| 🤖 AI Reasoning | Ollama (local LLMs) | On-device intelligence |
| ⚙️ Agent Orchestration | LangGraph | Multi-step planning & flow |
| 🧰 Tool System | Python tool executors | Device + web + file control |
| 🔒 Audit System | MongoDB `audit_log` | Full action history & trust |

---

## 2. Core Philosophy & Design Pillars

### The Key Innovation

Most AI systems are **reactive chat interfaces**. This system is fundamentally different:

- ❌ Not: "User opens app → types a message → gets a response"
- ✅ Yes: "AI notices context → initiates conversation → user speaks thought → AI reasons, remembers, connects, acts"

### Design Pillars

1. **Proactive-first** — the AI speaks first when context warrants it; user is never the one who has to "start" it
2. **Voice-first** — speaking is faster than typing; default interface is always voice
3. **Memory-first** — every interaction leaves a node; nothing is forgotten
4. **Graph-first** — knowledge isn't a list, it's a living connected network
5. **Action-first** — AI must *do things*, not just *describe* things
6. **Safety-first** — no destructive action without explicit user confirmation
7. **Trust-first** — every action is logged in the audit trail

---

## 3. AI-Initiated Startup System ⭐

### Core Concept

> The user should **never** be the one to "start" the AI.  
> The AI **always initiates** based on time, context, behavior, and pattern awareness.

The system runs a **background context monitor** that continuously evaluates:
- Current time of day
- User's historical activity patterns (from `user_context`)
- Device activity (screen on/off, last interaction time)
- Pending tasks / incomplete items
- Environmental triggers (calendar events, deadlines)

When a trigger fires, the AI **speaks first**.

---

### Time-Based Greeting Templates

The AI uses time + behavior patterns to craft contextual opening messages. These are **not hardcoded scripts** — the LLM generates them dynamically using time context + user data.

| Time Window | Context | Example AI Opening |
|---|---|---|
| 05:00 – 06:30 | Very early morning | *"Whoa, you're up early boss. Big day planned or just couldn't sleep? Either way, I'm here."* |
| 06:30 – 09:00 | Morning start | *"Good morning! You've got 3 tasks from yesterday still open. Want to tackle those first or start fresh?"* |
| 09:00 – 12:00 | Peak work hours | *"Hey, you've been at it for 2 hours. Quick check — still on track with what you planned this morning?"* |
| 12:00 – 13:30 | Midday | *"Afternoon. You mentioned wanting to research X earlier — want me to pull that up while you take a break?"* |
| 13:30 – 17:00 | Afternoon work | *"You left that task half-done this morning. Want to close it out before the day ends?"* |
| 17:00 – 19:00 | End of work day | *"Wrapping up? Let me give you a quick summary of what you got done today and what's left for tomorrow."* |
| 19:00 – 22:00 | Evening | *"Evening mode on. Anything on your mind you want to capture before it slips? No pressure — I'm just here."* |
| 22:00 – 00:00 | Late night | *"Hey boss, it's late. Something on your mind keeping you up? I'm here — talk to me."* |
| 00:00 – 03:00 | Middle of night | *"It's past midnight, boss. You okay? If there's something spinning in your head, let's get it out and written down."* |
| 03:00 – 05:00 | Deep night | *"Deep night hours. Either you're really focused or something's bothering you. What's going on?"* |

---

### Startup Trigger Logic

```
BACKGROUND MONITOR (runs every 60 seconds):

Check 1: Is it a new session? (device woke up / app opened)
  → YES → Run greeting based on time + pending context
  → NO  → Skip

Check 2: Has user been inactive for > 2 hours during active hours?
  → YES → Gentle check-in: "Still there? You went quiet."
  → NO  → Skip

Check 3: Are there overdue tasks from yesterday?
  → YES → Morning briefing includes task summary
  → NO  → Skip

Check 4: Is there a calendar event starting in 30 minutes?
  → YES → Proactive reminder: "You've got [X] in 30 minutes. Want a summary?"
  → NO  → Skip

Check 5: Has user mentioned the same topic 3+ times this week?
  → YES → Surface insight: "You keep coming back to [X]. Want to build a proper note on it?"
  → NO  → Skip
```

---

### Greeting Generation Prompt (Internal)

When the startup trigger fires, this is the internal prompt sent to the LLM:

```
You are a personal AI OS. Generate a short, warm, natural greeting for your user.

Context:
- Current time: {time}
- Time of day category: {morning | afternoon | evening | late_night | deep_night}
- User's name (if known): {name}
- Pending tasks: {task_count} tasks open
- Last interaction: {hours_ago} hours ago
- Recent topics: {top_3_recent_topics}
- Day of week: {weekday}

Rules:
- Sound like a trusted friend, not a corporate assistant
- Keep it under 2 sentences
- If it's late night, show genuine care and curiosity
- Reference specific context when available (tasks, topics)
- Never sound scripted or robotic
- Use casual language — "hey boss", "you good?", "what's up" are fine
- Do NOT ask more than one question at a time
```

---

### Session State Machine

```
┌─────────────────────────────────────────────────────┐
│              AI OS SESSION STATE MACHINE             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [SLEEPING]                                          │
│   Device off / screen locked                         │
│      ↓  device wakes                                 │
│  [CONTEXT EVALUATION]                                │
│   Check time, tasks, patterns, triggers              │
│      ↓  trigger fires                                │
│  [AI INITIATES]                                      │
│   AI speaks/displays greeting first                  │
│      ↓  user responds                                │
│  [ACTIVE SESSION]                                    │
│   Normal agent loop runs                             │
│      ↓  user goes quiet > threshold                  │
│  [AMBIENT MODE]                                      │
│   Low-power passive listening                        │
│      ↓  wake word OR new trigger                     │
│  [ACTIVE SESSION]                                    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 4. Proactive Agent Mode ⭐

The AI doesn't just respond — it **observes and surfaces insights** on its own.

### Proactive Trigger Types

| Trigger | Condition | AI Action |
|---|---|---|
| **Repeated Topic** | Same topic mentioned 3+ times in a week | *"You keep coming back to [X] — want me to build a structured note?"* |
| **Stale Task** | Task open for > 3 days with no progress | *"That [task] has been sitting for 3 days. Still relevant? Want to break it down differently?"* |
| **Knowledge Gap** | User asks a question the graph can't answer | Auto-searches web, creates node, reports back |
| **Connection Found** | Two previously unlinked nodes are now semantically similar | *"I just noticed your note on [X] connects to something you saved 2 weeks ago about [Y]."* |
| **Pattern Detected** | User always works late on Tuesdays | *"It's Tuesday evening again — you usually have a lot on your mind around now. What are we working on?"* |
| **Deadline Approaching** | Task due date within 24 hours | *"Heads up — [task] is due tomorrow. Want to run through it?"* |

### Proactive Engine Architecture

```
Proactive Engine (runs on background scheduler):

Input Sources:
  - user_context.behavior_patterns
  - tasks collection (overdue, stale)
  - nodes collection (recent additions, clusters)
  - edges (newly discovered connections)
  - calendar / system time

Processing:
  - Evaluate all trigger conditions
  - Score each trigger by urgency + relevance
  - Pick highest-scored trigger (max 1 per session unless critical)

Output:
  - Draft proactive message via LLM
  - Speak via TTS / show in UI
  - Log in audit_log with type: "proactive_initiation"
```

---

## 5. Voice-First Interface Layer

### Home Screen Behavior

When the system starts or wakes, the AI initiates — not the user:

- 🌙 AI evaluates context (time, tasks, patterns)
- 🎙 Animated **voice orb / waveform** appears with AI speaking first
- User hears the AI's greeting and responds naturally
- Minimal text UI — just the orb, greeting subtitle, ambient atmosphere

### Voice Processing Flow

```
AI Context Evaluation
      ↓
AI Initiates Greeting (TTS)
      ↓
Microphone Auto-Opens (listening state)
      ↓
User Speaks → Whisper STT (Speech-to-Text)
      ↓
Structured Text
      ↓
LangGraph Agent Processing
      ↓
Response Generated
      ↓
TTS Output  ←→  Text Fallback UI
      ↓
Memory + Graph Updated
```

### Voice Behavior Rules

| Behavior | Rule |
|---|---|
| Who speaks first | **Always the AI** |
| Input method | Speech → STT → processed normally |
| Output method | Voice output (toggle on/off) OR text fallback |
| Mandatory voice? | No — text interface always exists as fallback |
| Default mode | Voice |
| Fallback | Text chat UI always accessible |

### Important UX Rule

> 👉 The AI **always initiates** — the user should never feel like they're "starting" anything  
> 👉 Voice is the **default** interaction mode  
> 👉 Text interface **always exists** as fallback — never remove it  

---

## 6. Wake Word Support ⭐

### Core Concept

Users shouldn't need to tap anything to activate the AI. A **local wake word** makes the system feel like a true OS — always present, always ready.

### Wake Word Behavior

```
System is in Ambient Mode (low-power passive listening)
      ↓
User says wake word (e.g., "Hey OS" / custom word)
      ↓
Wake word detected LOCALLY (no cloud, on-device model)
      ↓
System transitions from Ambient → Active Session
      ↓
AI responds: "Yeah, I'm here. What's up?"
      ↓
Normal conversation begins
```

### Implementation Notes

| Property | Detail |
|---|---|
| Detection model | Local on-device (e.g., Porcupine, openWakeWord) |
| Cloud dependency | None — fully offline wake word detection |
| Custom wake word | User can set their own phrase |
| False positive handling | Low-sensitivity mode in noisy environments |
| Battery impact | Minimal — runs on dedicated lightweight model |

### Default Wake Words

- `"Hey OS"` — default
- `"Hey Brain"` — alternative
- User-configurable: set any phrase in preferences

---

## 7. Voice Personas & Tone Settings ⭐

The AI adapts its communication style to match the user's preference or the current context.

### Persona Modes

| Mode | Style | Example Response |
|---|---|---|
| **Executive** | Concise, bullet-pointed, no fluff | *"3 tasks open. Highest priority: deploy fix. Estimated: 2hrs."* |
| **Analyst** | Detailed, structured, thorough | *"Based on your last 5 sessions, the recurring blocker appears to be X. Here's a breakdown..."* |
| **Friend** | Casual, warm, conversational | *"Hey, so basically what happened is... and honestly I think you should just..."* |
| **Coach** | Motivating, action-oriented | *"You've got this. Let's break it into three steps and knock it out one by one."* |
| **Silent** | Text only, no voice output | Orb still shows, no TTS, all text |

### Auto-Persona Switching

The system can switch personas automatically based on:
- Time of day (executive mode during work hours, friend mode at night)
- User's emotional tone (detected from speech patterns)
- Task type (analytical tasks → analyst mode, creative tasks → friend mode)

### Persona Schema in `user_context`

```json
{
  "persona": {
    "default": "friend",
    "work_hours": "executive",
    "late_night": "friend",
    "creative_sessions": "coach",
    "current_override": null
  }
}
```

---

## 8. Ambient Passive Mode ⭐

### Core Concept

Between active sessions, the AI runs in a **low-power always-on state** that:
- Passively listens for the wake word
- Listens for important keywords and auto-captures them as nodes
- Monitors background triggers (tasks, time, patterns)
- Does NOT process every word — only activates on triggers

### Ambient Capture Behavior

When ambient mode is ON, the system passively listens. If it detects high-value keywords, it quietly creates a node without requiring full activation.

**Trigger keywords for silent node creation:**
- *"I need to remember..."* → auto-creates a `personal` node
- *"Note that..."* → auto-creates an `information` node
- *"Remind me to..."* → auto-creates a `task` node
- *"That's interesting..."* → flags nearby context for later review

```
Ambient listening (low-power)
      ↓
Keyword detected: "I need to remember X"
      ↓
Silent node created in background
      ↓
Soft audio chime / subtle UI indicator: "✓ Captured"
      ↓
User continues without interruption
```

### Ambient Mode States

| State | Description | Power Usage |
|---|---|---|
| `deep_sleep` | Device locked, no listening | Minimal |
| `ambient_listen` | Passive wake word + keyword detection | Low |
| `soft_active` | Proactive trigger evaluation only | Low-Medium |
| `full_active` | Full agent mode, processing conversation | Full |

---

## 9. Knowledge Graph Memory System

### Core Concept

Every piece of information becomes a **node** in a living knowledge graph. Inspired by:
- **Obsidian** — linked personal notes with graph visualization
- **Neo4j** — relationship-first graph database thinking

Unlike static notes, this graph is **AI-generated, automatic, continuously updated, and self-pruning**.

### Node Types

| Type | Description |
|---|---|
| `idea` | Creative thoughts, insights, brainstorming |
| `task` | Actions to take, to-do items, projects |
| `study` | Learning material, research, educational content |
| `information` | Facts, data, web content, references |
| `personal` | Personal preferences, memories, life events |
| `document` | Files, notes, written content |
| `web_data` | Extracted and summarized web content |
| `image` | Visual content nodes (v2.0 addition) |

### Node Schema (Full — v2.0)

```json
{
  "id": "uuid-v4",
  "content": "Full raw content of the node",
  "summary": "AI-generated 1-2 sentence summary",
  "type": "idea | task | study | information | personal | document | web_data | image",
  "tags": ["tag1", "tag2", "tag3"],
  "embeddings": [0.123, 0.456, "..."],
  "connections": [
    {
      "to_node": "uuid-of-connected-node",
      "relationship": "related_to | supports | contradicts | derived_from | similar_idea",
      "weight": 0.87
    }
  ],
  "source": "voice | text | file | web | system | ambient | image",
  "access_count": 12,
  "last_accessed": "ISO 8601 timestamp",
  "decay_score": 0.85,
  "tier": "hot | warm | cold | archived",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

### Edge / Relationship Types

| Relationship | Meaning |
|---|---|
| `related_to` | General semantic similarity |
| `supports` | One node provides evidence/backing for another |
| `contradicts` | Conflicting ideas or data |
| `derived_from` | Node was created from or based on another |
| `similar_idea` | Close conceptual match |

---

## 10. Node Aging & Forgetting Mechanism ⭐

### Problem

Without a forgetting mechanism, the knowledge graph grows indefinitely. Low-quality, stale, or redundant nodes slow down retrieval and pollute results.

### Solution: Decay Scoring

Every node has a `decay_score` (1.0 = fully relevant → 0.0 = irrelevant).

```
decay_score = base_score × recency_factor × access_factor × connection_factor

Where:
  base_score       = 1.0 at creation
  recency_factor   = decays by 0.01 per day of non-access
  access_factor    = +0.1 per access (capped at 1.0)
  connection_factor = +0.05 per connected edge (capped at 1.0)
```

### Lifecycle Actions by Decay Score

| Decay Score | Status | Action |
|---|---|---|
| 1.0 – 0.7 | 🟢 Active | Normal retrieval, full access |
| 0.7 – 0.4 | 🟡 Warm | Still retrievable, lower priority in search |
| 0.4 – 0.2 | 🟠 Fading | AI may ask: *"You haven't touched this note in 3 months — still relevant?"* |
| 0.2 – 0.0 | 🔴 Cold | Auto-archived to cold storage |
| 0.0 | ⚫ Dead | Marked for deletion (user confirmation required) |

### Decay Runner (Background Job)

```python
# Runs nightly at 02:00 AM (when user is likely inactive)

def run_decay_cycle():
    nodes = db.nodes.find({"tier": {"$ne": "archived"}})
    for node in nodes:
        days_since_access = (now - node.last_accessed).days
        new_decay = calculate_decay(node)
        
        if new_decay < 0.2:
            archive_node(node)        # move to cold storage
        elif new_decay < 0.4:
            flag_for_user_review(node) # soft prompt user
        else:
            update_decay_score(node, new_decay)
```

---

## 11. Edge Confidence Scoring ⭐

### Problem

Original edges were binary — connected or not. This doesn't reflect how strong or weak a relationship is.

### Solution: Weighted Edges

Every edge now has a `weight` (0.0 – 1.0) representing **confidence in the relationship**.

```json
{
  "_id": "uuid",
  "from_node": "node_id_A",
  "to_node": "node_id_B",
  "relationship_type": "supports",
  "weight": 0.91,
  "auto_generated": true,
  "confirmed_by_user": false,
  "created_at": "Date"
}
```

### Weight Calculation

```
weight = cosine_similarity(embedding_A, embedding_B)
         × relationship_type_boost
         × recency_factor

relationship_type_boost:
  related_to    → 1.0x
  supports      → 1.1x
  derived_from  → 1.2x
  contradicts   → 0.9x
  similar_idea  → 1.0x
```

### Weight Thresholds

| Weight | Meaning | Displayed? |
|---|---|---|
| 0.9 – 1.0 | Very strong connection | Always shown |
| 0.7 – 0.9 | Strong connection | Shown |
| 0.5 – 0.7 | Moderate connection | Shown (thinner line) |
| 0.3 – 0.5 | Weak connection | Hidden by default, filterable |
| 0.0 – 0.3 | Very weak / noise | Not shown |

---

## 12. Graph Pruning & Merging ⭐

### Problem

Over time, the user adds similar ideas multiple times. Duplicate or near-duplicate nodes pollute the graph.

### Solution: Auto-Merge on High Similarity

When a new node is created:

```
1. Generate embedding for new node
2. Run cosine similarity against all existing active nodes
3. If similarity > 0.95 with any existing node:
   → Propose merge to user: "This looks almost identical to [X]. Merge them?"
   → If user confirms: merge content, combine tags, keep stronger node, delete weaker
   → If user declines: keep both, create "similar_idea" edge with weight=0.95+
4. If similarity 0.80–0.95:
   → Auto-create "similar_idea" edge, no merge proposed
5. If similarity < 0.80:
   → Normal node creation, no action
```

### Merge Schema

```json
{
  "merged_from": ["node_id_1", "node_id_2"],
  "merged_into": "surviving_node_id",
  "merged_at": "ISO 8601 timestamp",
  "merge_reason": "cosine_similarity: 0.97"
}
```

---

## 13. Multi-Modal Input Support ⭐

### Core Concept

The AI should accept **any kind of input** — not just voice and text. Every input type gets converted into a knowledge node.

### Supported Input Types

| Input Type | How It's Processed | Node Type Created |
|---|---|---|
| 🎤 Voice | Whisper STT → structured text | Based on content |
| ⌨️ Text | Direct processing | Based on content |
| 🖼 Image | Vision model → description + OCR | `image` node |
| 📄 PDF/Doc | Text extraction → chunked summary | `document` node |
| 🌐 URL | Web fetch → summarize → extract | `web_data` node |
| 📋 Screenshot | Vision model → extract key content | `image` or `information` node |
| 🎵 Audio clip | Whisper → transcription | Based on content |

### Image Processing Pipeline

```
User drops image / screenshot
      ↓
Vision model (LLaVA via Ollama) describes image
      ↓
OCR extracts any text present
      ↓
Combined output → structured text
      ↓
Normal knowledge processing pipeline runs
      ↓
Image node created with:
  - content: full description + OCR text
  - summary: 1-line AI summary
  - tags: auto-extracted
  - source: "image"
```

---

## 14. MongoDB Atlas Storage Architecture

All graph data is persisted in MongoDB Atlas with **5 core collections** (audit_log added in v2.0).

### Collection 1: `nodes`

```json
{
  "_id": "uuid",
  "content": "string",
  "summary": "string",
  "type": "string (enum)",
  "tags": ["array", "of", "strings"],
  "embeddings": ["float array"],
  "access_count": 0,
  "last_accessed": "Date",
  "decay_score": 1.0,
  "tier": "hot | warm | cold | archived",
  "source": "voice | text | file | web | system | ambient | image",
  "created_at": "Date",
  "updated_at": "Date"
}
```

**Indexes required:**
- `type` (filter by node type)
- `tags` (multi-key index)
- `tier` (filter by storage tier)
- `decay_score` (for decay runner queries)
- Vector index on `embeddings` (MongoDB Atlas Vector Search)
- Full-text index on `content` + `summary`

---

### Collection 2: `edges`

```json
{
  "_id": "uuid",
  "from_node": "node_id",
  "to_node": "node_id",
  "relationship_type": "related_to | supports | contradicts | derived_from | similar_idea",
  "weight": 0.87,
  "auto_generated": true,
  "confirmed_by_user": false,
  "created_at": "Date"
}
```

**Indexes required:**
- `from_node`
- `to_node`
- `weight` (filter weak edges from visualization)
- Compound: `{from_node, relationship_type}`

---

### Collection 3: `tasks`

```json
{
  "task_id": "uuid",
  "title": "string",
  "steps": [
    {
      "step": 1,
      "action": "string",
      "status": "pending | done | failed",
      "depends_on": []
    }
  ],
  "dag_edges": [
    { "from_step": 1, "to_step": 2, "condition": "on_success" }
  ],
  "status": "pending | running | completed | failed | blocked",
  "priority": "low | medium | high | critical",
  "due_date": "Date | null",
  "created_at": "Date",
  "completed_at": "Date | null"
}
```

---

### Collection 4: `user_context`

```json
{
  "preferences": {
    "voice_speed": "normal | slow | fast",
    "default_mode": "voice | text",
    "language": "en",
    "response_style": "concise | detailed",
    "wake_word": "Hey OS",
    "persona": {
      "default": "friend",
      "work_hours": "executive",
      "late_night": "friend"
    }
  },
  "behavior_patterns": {
    "most_active_hours": ["09:00", "14:00", "23:00"],
    "common_topics": ["tag1", "tag2"],
    "preferred_tools": ["web_search", "file_manager"],
    "avg_session_length_mins": 24,
    "typical_late_night_activity": true
  },
  "proactive_settings": {
    "enabled": true,
    "min_interval_between_proactive_mins": 120,
    "triggers_enabled": ["stale_task", "repeated_topic", "late_night", "morning_brief"]
  }
}
```

---

### Collection 5: `audit_log` ⭐ NEW

```json
{
  "log_id": "uuid",
  "timestamp": "Date",
  "session_id": "uuid",
  "event_type": "tool_execution | proactive_initiation | node_created | edge_created | node_archived | node_merged | user_override | system_startup",
  "initiated_by": "ai | user",
  "tool_used": "tool_name | null",
  "files_accessed": ["path/to/file"],
  "nodes_affected": ["node_id_1"],
  "action_description": "Human-readable description of what happened",
  "user_confirmed": true,
  "outcome": "success | failed | cancelled"
}
```

**Purpose:** Full transparency. User can always see exactly what the AI did, when, and why.

---

## 15. Tiered Storage System ⭐

### Problem

Querying all nodes from MongoDB every single turn is slow and expensive. Frequently used data should be instantly accessible.

### Three-Tier Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    TIERED STORAGE                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🔥 HOT TIER — Redis (in-memory cache)                   │
│     • Nodes accessed in last 7 days                      │
│     • Active session working memory                      │
│     • Current conversation context (last 10 turns)       │
│     • Response time: < 5ms                               │
│                                                          │
│  🌡 WARM TIER — MongoDB Atlas (primary DB)               │
│     • All active nodes (decay_score > 0.2)               │
│     • All edges                                          │
│     • Full task history                                  │
│     • Response time: < 50ms                              │
│                                                          │
│  ❄️ COLD TIER — Blob Storage / MongoDB Archive           │
│     • Nodes with decay_score < 0.2                       │
│     • Completed tasks older than 90 days                 │
│     • Old audit logs                                     │
│     • Response time: < 500ms (not in critical path)      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tier Movement Rules

| Event | Action |
|---|---|
| Node accessed | Move to / refresh in Hot tier (Redis) |
| Node not accessed for 7 days | Evict from Hot tier → stays in Warm |
| decay_score drops below 0.2 | Move from Warm → Cold |
| User explicitly searches for cold node | Temporarily promote to Warm |
| Node decay_score reaches 0.0 | Prompt user: archive permanently or delete |

---

## 16. Short-Term vs Long-Term Memory Split ⭐

### Problem (Critical)

In v1.0, every piece of context — including the current conversation — went straight to MongoDB. This is **too heavy for real-time use**. Hitting the database for every conversational turn creates unacceptable latency.

### Solution: Two-Layer Memory

```
┌─────────────────────────────────────────────────┐
│             MEMORY ARCHITECTURE                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  SHORT-TERM MEMORY (Redis / in-process)         │
│  ────────────────────────────────────────────   │
│  • Current conversation: last 10 turns          │
│  • Active task being worked on                  │
│  • Working context (files open, recent web)     │
│  • Lives in RAM — wiped on session end          │
│  • Access time: < 1ms                           │
│                                                 │
│  LONG-TERM MEMORY (MongoDB Atlas)               │
│  ────────────────────────────────────────────   │
│  • All knowledge graph nodes                    │
│  • All edges and relationships                  │
│  • Historical tasks and completions             │
│  • User context and behavior patterns           │
│  • Persists forever (with decay)                │
│  • Access time: < 50ms                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

### When to Write to Long-Term Memory

Not every conversational turn creates a graph node. The agent decides:

```
After each turn:

Is this information worth remembering long-term?
  → Explicit: "remember that X" / "note that Y"  → YES, always
  → Task created or completed                     → YES, always
  → New factual information learned               → YES
  → Casual chitchat / social response             → NO
  → Repeated information already in graph        → NO (update existing)
  → System commands (open app, etc.)             → NO
```

### Short-Term Memory Schema (Redis)

```json
{
  "session_id": "uuid",
  "turns": [
    {
      "role": "user | ai",
      "content": "message text",
      "timestamp": "ISO 8601",
      "nodes_referenced": ["node_id"]
    }
  ],
  "working_context": {
    "active_task": "task_id | null",
    "open_files": ["path"],
    "last_web_search": "query"
  },
  "ttl": 3600
}
```

---

## 17. LangGraph Agent Execution System

The AI OS operates as a **graph-based reasoning agent** using LangGraph. Each step is a discrete node.

### Full Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│                  LANGGRAPH EXECUTION FLOW                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [0] Proactive Trigger Check (NEW)                      │
│       ↓ (AI may speak first based on context)           │
│  [1] Voice/Text Input Node                              │
│       ↓ (transcription + preprocessing)                 │
│  [2] Short-Term Memory Load (NEW)                       │
│       ↓ (load last N turns from Redis — fast)           │
│  [3] Long-Term Memory Retrieval Node                    │
│       ↓ (MongoDB + Graph semantic search — when needed) │
│  [4] Intent Classification Node                         │
│       ↓ (fast model routing)                            │
│  [5] Planning Node                                      │
│       ↓ (multi-step plan + DAG for tasks)               │
│  [6] Tool Selection Node                                │
│       ↓ (pick tools, check permission tier)             │
│  [7] Execution Node                                     │
│       ↓ (run tools, confirm if destructive, log audit)  │
│  [8] Response Node                                      │
│       ↓ (voice + text output generation)                │
│  [9] Memory Decision Node (NEW)                         │
│       ↓ (decide: write to long-term? update graph?)     │
│  [10] Graph + Memory Update Node                        │
│        (create nodes, edges, update decay, update STM)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Node Descriptions

| Node | Description | Model Used |
|---|---|---|
| Proactive Check | Evaluate triggers, initiate if warranted | Scheduler |
| Input | Receive voice/text, preprocess | — |
| STM Load | Pull current session from Redis | — |
| LTM Retrieval | Semantic search + graph traversal when needed | Embedding model |
| Intent Classification | Classify: task / query / note / action / social | Fast model (llama3.2:1b) |
| Planning | Break intent into steps, build DAG if task | Medium model (llama3.2:3b) |
| Tool Selection | Choose tools, verify permission level | Medium model |
| Execution | Run tools, log to audit_log | — |
| Response | Format + speak/display response | Large model (llama3.1:8b) |
| Memory Decision | Decide whether to write to long-term | Fast model |
| Graph Update | Create/update nodes + edges + decay | Medium model |

---

## 18. Task Dependency Graph (DAG) ⭐

### Problem

Tasks in v1.0 were flat lists of steps. Real-world tasks have **dependencies** — step B cannot start until step A finishes.

### Solution: DAG-Based Task Modeling

Every task is modeled as a **Directed Acyclic Graph (DAG)** of steps.

```
Example: "Set up the AI OS project"

Step 1: Create MongoDB Atlas cluster
Step 2: Install Ollama                    (can run parallel with Step 1)
Step 3: Set up LangGraph environment      (can run parallel with Step 1)
Step 4: Connect LangGraph → MongoDB       (depends on Step 1 + Step 3)
Step 5: Test first agent loop             (depends on Step 4)
Step 6: Build voice interface             (depends on Step 2 + Step 3)

DAG:
  1 ──→ 4 ──→ 5
  2 ──→ 6
  3 ──→ 4
  3 ──→ 6
```

### DAG Schema in Tasks Collection

```json
{
  "task_id": "uuid",
  "steps": [
    { "step_id": "s1", "action": "Create MongoDB Atlas cluster", "status": "done" },
    { "step_id": "s2", "action": "Install Ollama", "status": "pending" },
    { "step_id": "s3", "action": "Set up LangGraph", "status": "pending" },
    { "step_id": "s4", "action": "Connect LangGraph → MongoDB", "status": "blocked" },
    { "step_id": "s5", "action": "Test agent loop", "status": "blocked" }
  ],
  "dag_edges": [
    { "from": "s1", "to": "s4", "condition": "on_success" },
    { "from": "s3", "to": "s4", "condition": "on_success" },
    { "from": "s4", "to": "s5", "condition": "on_success" }
  ]
}
```

### Agent DAG Behavior

- Agent always checks DAG before executing a step
- If a step is `blocked`, agent surfaces the blocker: *"Step 4 is blocked — Steps 1 and 3 need to finish first."*
- If multiple steps are unblocked, agent can execute them in parallel (when safe)
- On step failure, agent evaluates downstream steps and marks them `blocked`

---

## 19. Ollama Model Routing

The system dynamically selects the right local model based on task complexity.

### Routing Logic

| Task Type | Recommended Model | Reason |
|---|---|---|
| Classification / Routing | `llama3.2:1b` | Fastest, minimal memory |
| Summarization / Extraction | `llama3.2:3b` | Balanced speed + quality |
| Reasoning / Planning | `llama3.1:8b` | Most capable for complex tasks |
| Code generation | `deepseek-coder:6.7b` | Specialized for code |
| Image understanding | `llava:7b` | Vision model for images |
| Embeddings | `nomic-embed-text` | Optimized for vector embeddings |
| Wake word | Dedicated lightweight binary | Porcupine / openWakeWord |

### Optimization Goals

- 👉 **Speed**: Fast models for routing & classification (sub-200ms)
- 👉 **Memory efficiency**: Don't load large models for simple tasks
- 👉 **Accuracy**: Scale up model size for planning & reasoning tasks
- 👉 **Parallel loading**: Pre-warm frequently used models in memory

---

## 20. Tool Capabilities & Permission Tiers ⭐

The AI OS has a **tiered permission system** — not all tools are equally accessible. Users must explicitly unlock higher-tier tools.

### Permission Tiers

| Tier | Level | Examples | Unlock Required? |
|---|---|---|---|
| 🟢 Tier 1 — Read Only | Safe, no side effects | Read files, web search, summarize, list apps | No — always available |
| 🟡 Tier 2 — Read/Write | Moderate risk | Create/edit files, write notes, organize folders | Default unlocked, can be locked |
| 🔴 Tier 3 — System Level | High risk | Delete files, run commands, open apps, system info | Requires explicit user unlock per session |

### System Tools

| Tool | Capability | Tier |
|---|---|---|
| `open_app` | Launch applications | 🔴 Tier 3 |
| `manage_files` | Create, read, move, delete | 🟡 Tier 2 / 🔴 Tier 3 (delete) |
| `run_command` | Execute shell commands (sandboxed) | 🔴 Tier 3 |
| `list_directory` | List file contents | 🟢 Tier 1 |
| `get_system_info` | CPU, RAM, disk usage | 🟢 Tier 1 |

### Web Tools

| Tool | Capability | Tier |
|---|---|---|
| `web_search` | Search the web | 🟢 Tier 1 |
| `web_summarize` | Fetch URL → AI summary | 🟢 Tier 1 |
| `web_extract` | Extract structured data from page | 🟢 Tier 1 |

### File Tools

| Tool | Capability | Tier |
|---|---|---|
| `read_document` | Read .txt, .pdf, .md, .docx | 🟢 Tier 1 |
| `write_document` | Create or edit documents | 🟡 Tier 2 |
| `organize_folder` | Auto-organize folder by type/date | 🟡 Tier 2 |

### Safety Rules for Tools

> ⚠️ **Always create a plan before executing actions**  
> ⚠️ **Ask confirmation for destructive operations** (delete, overwrite, format)  
> ⚠️ **Log every tool execution to `audit_log`**  
> ⚠️ **Tier 3 tools require fresh unlock each session — never auto-unlock**  

---

## 21. Knowledge Processing Pipeline

When the user provides any input, the AI OS runs it through a standardized **knowledge processing pipeline**.

```
Step 0: Determine input type
        (voice / text / image / file / url / ambient)
          ↓
Step 1: Convert to structured text
        (STT for voice, OCR for images, extraction for files)
          ↓
Step 2: Check short-term memory
        (is this related to something in current session?)
          ↓
Step 3: Classify content type
        (idea / task / study / information / personal / web_data / image)
          ↓
Step 4: AI summarize content (1-2 sentences)
          ↓
Step 5: Extract entities + tags
          ↓
Step 6: Generate vector embedding
          ↓
Step 7: Run cosine similarity against existing nodes
        → similarity > 0.95 → propose merge
        → similarity 0.80–0.95 → auto-link
        → similarity < 0.80 → new independent node
          ↓
Step 8: Store as graph node in MongoDB (warm tier)
        + cache in Redis (hot tier)
          ↓
Step 9: Link with related existing nodes (create edges with weights)
          ↓
Step 10: Update relationship edges
          ↓
Step 11: Log to audit_log
          ↓
Step 12: Return enriched context to agent
```

---

## 22. Output Format Specification

The AI agent always produces a **structured JSON response** internally.

```json
{
  "intent": "classified intent string",
  "mode": "voice | text | hybrid",
  "initiated_by": "ai | user",
  "persona_used": "friend | executive | analyst | coach",

  "graph_updates": {
    "nodes_created": [
      { "id": "uuid", "type": "idea | task | ...", "summary": "one-line summary" }
    ],
    "nodes_merged": [
      { "surviving": "node_id", "removed": "node_id", "similarity": 0.97 }
    ],
    "edges_created": [
      { "from": "node_id", "to": "node_id", "relationship": "supports", "weight": 0.88 }
    ],
    "nodes_archived": ["node_id"]
  },

  "memory_used": {
    "short_term": ["last N turns summary"],
    "long_term": ["node_id_1", "node_id_2"]
  },

  "plan": ["Step 1: ...", "Step 2: ..."],
  "dag_used": false,

  "tools_used": ["tool_name_1"],
  "permission_tier_used": 1,

  "model_used": "ollama_model_name",

  "response_text": "Full response for text UI display",
  "response_voice": "Shorter spoken version of the response",

  "proactive": false,
  "proactive_trigger": null,

  "memory_write_decision": "yes | no | update_existing",
  "audit_log_id": "uuid"
}
```

---

## 23. UI Behavior & Screens

### Screen 0: AI-Initiated Wake (NEW)

The AI speaks first. No user action required.

| Element | Description |
|---|---|
| Orb state | Glowing — AI is speaking |
| Greeting subtitle | AI's opening message displayed as text |
| Auto-mic | Microphone opens automatically after AI finishes greeting |
| Cancel | Tap to dismiss and go to text mode |

### Screen 1: Default Voice Home Screen

| Element | Description |
|---|---|
| Voice Orb | Animated orb/waveform pulsing with state |
| State Label | "Listening..." / "Thinking..." / "Speaking..." |
| Minimal UI | Orb + ambient light + minimal controls |
| Bottom bar | Mute, settings, switch to text mode |

### Screen 2: Text Chat View

- Message history with AI-initiated messages clearly marked with 🤖
- Input field (text + voice toggle)
- Timestamps + node creation indicators ("✓ Memory saved")
- Proactive messages shown with different bubble style

### Screen 3: Knowledge Graph View

Full-screen interactive graph visualization:
- **Nodes** rendered as glowing circles (color = type)
- **Edges** rendered as lines — thickness = edge weight
- **Edges below 0.5 weight** hidden by default (filterable)
- **Filtering** by node type, tag, date, decay score
- **Zoom/pan** like Obsidian's graph view
- **Click a node** → opens full content panel
- **AI pathfinding** → "Show me how X is connected to Y"
- **Merged node history** visible on click

### Screen 4: Audit Log View (NEW)

- Full list of everything the AI has ever done
- Filterable by event type, date, tool used
- Each entry shows: what happened, who initiated, outcome
- User can retroactively reject an action (soft undo where possible)

### Screen Transitions

```
AI Wake (orb speaks first)
    ↓ user responds / tap
Active Voice Session
    ↓ swipe up / tap
Text Chat View
    ↓ tap graph icon
Knowledge Graph View
    ↓ tap audit icon
Audit Log View
    ↓ tap settings
User Preferences
```

---

## 24. Safety Rules & Audit Log ⭐

These are **non-negotiable system constraints** built into every layer:

| Rule | Detail |
|---|---|
| 🔴 No blind destructive actions | Any delete, format, overwrite → must confirm with user |
| 🔴 No hidden file access | System must declare which files it intends to access |
| 🔴 Tier 3 tools require fresh unlock | Never auto-unlock system-level tools |
| 🟡 Always explain before acting | State the plan before execution |
| 🟡 Sandboxed commands | Shell commands run in isolated environment |
| 🟡 Proactive messages are logged | Every AI-initiated message is in audit_log |
| 🟢 User has full override | User can cancel any action at any point |
| 🟢 No external API calls without disclosure | Disclose any external network access |
| 🟢 Full audit trail | Every action logged to `audit_log` collection |
| 🟢 Decay actions need confirmation | Node deletion always requires user approval |

---

## 25. Final System Role

```
You are:

A voice-first, graph-based AI operating system that acts as
a personal intelligence layer across memory, tools, and
real-world system actions.

You initiate. You don't wait.
You remember. You don't forget.
You connect. You don't silo.
You act. You don't just describe.

Your mission:

👉 Initiate  — speak first when context warrants it
👉 Speak     — communicate naturally, like a trusted friend
👉 Think     — reason deeply, plan multi-step actions
👉 Remember  — capture everything, forget strategically
👉 Connect   — link ideas, find patterns automatically
👉 Act       — execute real actions safely and precisely
👉 Log       — be transparent about every action taken
```

---

## 26. Architecture Stack Summary

```
┌──────────────────────────────────────────────────────────┐
│                     AI OS v2.0 — FULL STACK              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🌙  PROACTIVE ENGINE (NEW)                              │
│      Context Monitor → Trigger Evaluator → AI Initiates  │
│                                                          │
│  🎤  VOICE LAYER                                         │
│      Wake Word → Whisper STT → TTS → Persona Engine      │
│                                                          │
│  🧠  AGENT LAYER                                         │
│      LangGraph (10 nodes) → STM → LTM → DAG Tasks        │
│                                                          │
│  🤖  MODEL LAYER                                         │
│      Ollama: llama3.2:1b / 3b / llama3.1:8b / llava:7b   │
│      + nomic-embed-text (embeddings)                     │
│      + openWakeWord (wake word detection)                │
│                                                          │
│  🧰  TOOL LAYER                                          │
│      Tiered: Read-only / Read-Write / System (Tier 1-3)  │
│                                                          │
│  🗄  STORAGE LAYER                                       │
│      Hot:  Redis (STM + active nodes)                    │
│      Warm: MongoDB Atlas (full graph + tasks)            │
│      Cold: Archive (decayed nodes + old logs)            │
│                                                          │
│  🧠  GRAPH LAYER                                         │
│      Nodes + Weighted Edges + Decay + Auto-Merge          │
│                                                          │
│  🔒  AUDIT LAYER (NEW)                                   │
│      audit_log → full transparency for every action      │
│                                                          │
│  🎨  UI LAYER                                            │
│      AI Wake Screen → Voice Orb → Chat → Graph → Audit   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 27. Next Steps & Roadmap

### Phase 0 — Foundation (Build First)

- [ ] 🌙 **Proactive engine** — background context monitor + trigger system
- [ ] 🗄 **MongoDB schema v2** — all 5 collections, indexes, vector search config
- [ ] 🧠 **Short-term memory** — Redis setup + session schema
- [ ] 🎤 **Frontend voice UI** — orb animation + AI-initiated greeting flow

### Phase 1 — Core Intelligence

- [ ] ⚙️ **LangGraph 10-node graph** — full execution flow with STM/LTM split
- [ ] 🤖 **Ollama model router** — dynamic routing by task complexity
- [ ] 🧰 **Tool registry + permission tiers** — sandboxed execution
- [ ] 🔒 **Audit log system** — every action logged with full context

### Phase 2 — Graph & Memory

- [ ] 🧠 **Knowledge graph auto-linking engine** — cosine similarity + edge weights
- [ ] ⏳ **Decay runner** — nightly background job
- [ ] 🔀 **Auto-merge system** — duplicate detection + merge flow
- [ ] 📊 **Graph visualization** — D3.js / Cytoscape.js with weight-based rendering

### Phase 3 — Voice & UX

- [ ] 🗣 **Wake word integration** — openWakeWord local detection
- [ ] 🎭 **Voice persona system** — auto-switching by time/context
- [ ] 🌙 **Ambient passive mode** — low-power keyword capture
- [ ] 🖼 **Multi-modal input** — image/PDF/screenshot processing via LLaVA

### Phase 4 — Scale & Polish

- [ ] 📱 **Mobile app wrapper** (React Native)
- [ ] 🔗 **External integrations** (calendar, email, web)
- [ ] 🧪 **Evaluation framework** — agent reasoning quality metrics
- [ ] 🌐 **Multi-user / shared knowledge graphs**
- [ ] 📈 **Analytics dashboard** — usage patterns, graph growth, decay stats

---

*Document Version: 2.0 | Architecture Status: Design Phase | Last Updated: April 2026*  
*Changes from v1.0: AI-initiated startup, proactive engine, wake word, voice personas, ambient mode, node decay, edge weights, graph pruning, multi-modal input, tiered storage, STM/LTM split, DAG tasks, permission tiers, audit log*
