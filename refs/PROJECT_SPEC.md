# DeepNote - Project Specification

A minimalist macOS knowledge bank with ambient AI assistance for deep learning and goal tracking.

---

## Core Philosophy

The AI operates as invisible infrastructure. It never interrupts, never feels like a separate feature you invoke. It quietly organizes, connects, and surfaces insights while you stay in flow. All suggestions are queued and surfaced at natural pause points.

---

## Data Model

```
Notes (raw captures, fleeting thoughts)
    ↓ clusters into
Concepts (extracted topics, auto-tagged)
    ↓ links to
Goals (what you're trying to learn/achieve)
    ↓ generates
Suggestions (gaps, expansions, review prompts)
    ↓ feeds back into
Notes
```

---

## Preamble / Learning Intention

A free-form blurb that defines your overarching direction. Not a goal, but the why behind all goals.

### Example
> "I want to become as cracked as possible, very good understanding on math concepts and be able to read and understand ML research papers"

### How It Influences the System

- **Suggestion prioritization**: When surfacing tensions, ghost definitions, or serendipity notes, weight toward what moves you closer to the preamble
- **Dump processor scoring**: "Goal relevance" factor considers both specific goals AND alignment with preamble
- **Gap detection**: If your notes and goals don't touch core preamble areas, surface it: "Your intention mentions math foundations but you haven't engaged with linear algebra in 3 weeks"
- **Concept recommendations**: Proactively suggest concepts to explore based on preamble ("To read ML papers, you might want to define: eigenvalues, gradient, loss function, backprop...")
- **Pomodoro suggestions**: "You have 25 min. Want to work toward [preamble-aligned suggestion]?"

### Properties
- Single preamble, editable anytime
- Changes are versioned (track how your intention evolves)
- Optional, system works without it but suggestions become more generic

---

## Session Intentions

When you sit down to work, optionally declare a session intention:

### Example
> "I want to deeply understand the attention mechanism"

### Session Flow
1. **Start session** - Write your intention (or skip for open-ended exploration)
2. **Work** - Notes, dumps, pomodoros all get tagged to this session
3. **End session** - Brief reflection: "Did you achieve your intention? What's still unclear?"

### How Sessions Shape the Experience

- **Focused suggestions**: During a session, AI behaviors prioritize the session intention over general preamble
- **Dump processor context**: Relevance scoring weights heavily toward session intention
- **Ghost definitions scoped**: "You're trying to understand attention but haven't defined 'query', 'key', 'value'"
- **Distraction detection**: If your notes drift away from session intention, gentle nudge: "You started with attention but you're now in CNN territory. Intentional fork?"
- **Session summary**: At end, auto-generate: concepts touched, definitions added, tensions found, time spent

### Session vs Preamble

| Preamble | Session Intention |
|----------|-------------------|
| Long-term direction | Right now focus |
| "Become great at ML" | "Understand attention" |
| Influences everything | Overrides during session |
| Evolves over months | Lasts hours |

### Session History
- All sessions logged with: intention, duration, notes created, concepts engaged, reflection
- Patterns emerge: "You have 12 sessions on transformers, 0 on the math foundations you said you wanted"

---

## Core Features

### 1. Note Capture
- Minimal markdown editor
- Quick capture without friction
- Notes are atomic thoughts, not documents

### 2. Goal Tracking
- Simple learning objectives ("understand transformer architectures")
- Goals influence which suggestions surface
- Progress inferred from note depth and concept maturity

### 3. Personal Glossary
- Define terms in your own words
- Definitions extracted naturally from notes ("X is basically Y", "by X I mean")
- Tracks definition evolution over time (your understanding changes)
- Conflict detection when you define something differently in two places

---

## AI Behaviors (Background)

### Ghost Definitions
For terms you use frequently but never defined, prompt at natural pause points:

> "You've mentioned 'gradient descent' 8 times. Want to define it in your own words?"

This forces the Feynman technique. If you can't define it simply, you don't know it yet. The system notices avoidance and gently persists.

### Inline Definition Suggestions
While typing, if you use a term you've defined:
- Subtle autocomplete appears
- Tab to insert the term
- Modifier key to expand your definition inline (for self-review)

```
You're typing: "The transform|"
                      ↓
         ┌─────────────────────────┐
         │ transformer             │
         │ "Architecture using     │
         │ self-attention, no RNNs"│
         │ [tab] insert  [?] expand│
         └─────────────────────────┘
```

### Tension Surfacing
Find contradictions or unresolved questions across your notes:

> "On March 3 you wrote X, on March 20 you wrote Y. Resolve?"

This is where real learning happens. Contradictions aren't bugs, they're opportunities.

### Serendipity Injection
Occasionally surface an old note that isn't obviously related but shares deep structural similarity. The "huh, I never thought about it that way" moment.

Not random. Semantically adjacent but topically distant.

### Drift Detection
Track the semantic trajectory of your notes during a session. If you started researching "RLHF" and you're now deep in "constitutional AI," surface a gentle breadcrumb trail showing how you got there.

Helps you not lose the thread, or intentionally fork with awareness.

### Concept Maturity Scoring
For each topic you touch, track:
- Frequency: how often you mention it
- Recency: when you last engaged
- Depth: word count, connections made
- Confidence signals: hedging language ("I think") vs declarative statements

Visualize subtly. Concepts you understand could glow differently than ones you're wrestling with.

### Ghost Links
Before you explicitly link two notes, detect when they should be linked. Show a faint connection. Confirm with a click or ignore. Over time it learns your personal ontology.

---

## Information Dump Processor

When you paste a wall of text (article, lecture notes, research dump), the system:

### Processing Steps
1. **Segment** - Break into atomic claims/ideas automatically
2. **Score each segment on:**
   - Connection density: how many existing concepts does this touch?
   - Novelty: is this new or redundant to your knowledge base?
   - Goal relevance: does this advance any active learning goals?
   - Tension potential: does this contradict something you "know"?
3. **Heat map render** - High relevance segments glow, low relevance fades

### Visual Output
```
┌─────────────────────────────────────────┐
│ [pasted content]                        │
│                                         │
│ "Attention mechanisms allow models to   │ ← dim (you know this)
│ focus on relevant parts of input..."    │
│                                         │
│ "Recent work shows attention heads      │ ← bright (connects to 3 notes,
│ exhibit interpretable features..."      │   novel angle, matches goal)
│                                         │
│ "The computational cost scales          │ ← medium (new but no connections
│ quadratically with sequence length"     │   yet - potential concept seed)
│                                         │
└─────────────────────────────────────────┘
        [Extract highlighted] [Dismiss]
```

You scan visually, click to expand/capture the hot spots. Triage for information overload.

---

## Flow Protection Principles

- Queue suggestions, never interrupt
- Surface prompts at natural pauses (30+ seconds idle, session end)
- All AI actions are reversible and transparent
- Never rearrange without consent, only suggest
- Respect energy levels (short fragmented notes = capture mode, don't prompt for expansion)

---

## Technical Approach

### Platform
- Tauri v2 (Rust backend + web frontend)
- Frontend: your choice (React, Svelte, Solid, vanilla). Keep it minimal.
- Prioritize keyboard-first interactions

### Storage
- SQLite with FTS5 for full-text search (tauri-plugin-sql or rusqlite)
- Markdown-based note storage (portable, future-proof)
- All data local by default

### Embeddings & AI
- Local embeddings via llama.cpp (rust bindings: llama-cpp-rs or similar)
- Small embedding model bundled (nomic-embed-text or similar, ~100MB)
- Similarity search via vector distance in SQLite or simple in-memory index
- Background processing in Rust, non-blocking

### LLM Integration
- Local: llama.cpp for small models (summarization, extraction)
- API: Claude for heavier analysis (tension detection, serendipity, complex suggestions)
- Hybrid approach: local for latency-sensitive (autocomplete, inline suggestions), API for depth

### Background Processing
- Rust async tasks for embedding generation, scoring, clustering
- Tauri commands expose results to frontend
- Queue-based suggestion system (AI writes to queue, frontend reads at natural pauses)

---

## Pomodoro Timer & Task System

### Timer
- Optional, configurable (default 25/5, but adjustable)
- Minimal visual presence when running (menubar or subtle corner indicator)
- No aggressive alerts, gentle chime or visual pulse on completion

### Tasks & Todos
- Tasks can be linked to:
  - Specific goals ("study transformers")
  - Specific notes (work on expanding this)
  - Specific concepts (deepen understanding here)
  - Or standalone
- Before starting a pomodoro, optionally select what you're working on
- After completion, prompt: "What did you accomplish?" (optional, feeds back into notes)

### Session Tracking
- Track what you worked on during each pomodoro
- See patterns: "You spend most deep work time on X but your goal is Y"
- Connect focus time to concept maturity (more pomodoros on a topic = more understanding, roughly)

### Streaks
- Daily streak: completed at least one pomodoro
- Goal streaks: consecutive days working toward a specific goal
- Concept streaks: consecutive days engaging with a topic
- Streaks are visible but not gamified to the point of anxiety
- Missing a day shows gentle "welcome back" not guilt

### Integration with AI Behaviors
- If you consistently start pomodoros for a goal but never finish, surface it: "You've started 5 sessions on X but completed 1. Too ambitious? Want to break it down?"
- Suggest tasks based on ghost definitions, tensions, or gaps: "You have 25 minutes. Want to define 'backpropagation' or resolve the tension in your RL notes?"
- Post-session: "You wrote 3 notes touching 'attention'. Mark as reviewed?"

---

## Open Questions

- How aggressive should ghost definitions be? Configurable threshold?
- Streak visibility: always shown or hidden until you look?
- Should breaking a streak have any effect on suggestions? (Probably not, avoid guilt loops)
- Should serendipity injection be scheduled or purely opportunistic?
- How to visualize concept maturity without cluttering the minimal UI?
- Keyboard-first or mouse-friendly? (Probably keyboard-first with mouse support)
- Sync across devices or local-only initially?

---

## Success Criteria

The app succeeds if:
1. You capture thoughts faster than in any other tool
2. You notice connections you wouldn't have made yourself
3. You can explain concepts better after using it (glossary forces articulation)
4. You never feel interrupted by the AI
5. Returning to old notes feels like visiting a well-organized mind, not a graveyard
