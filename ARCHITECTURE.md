# MOOSA Intelligence Architecture

MOOSA is a local-first personal AI agent built on the PocketPal codebase
(MIT License, (c) 2024 Asghar Ghorbani — see LICENSE). This document
describes the intelligence architecture: what exists, what is partial,
and what is planned. A capability is only called "implemented" when it
is present in this codebase and has been exercised; anything else is
labelled partial or planned.

## Hard rules

1. The brain is a **local open-weight GGUF model** executed by
   llama.cpp (via llama.rn). No external chatbot API (ChatGPT, Claude,
   Gemini or any other) is used as the brain, silently or otherwise.
2. Features that need the internet say so openly in the UI/prompts.
3. Sensitive actions (payments, publishing, deletions, messages,
   trades) always require the user's explicit approval.
4. Credentials are never requested in chat or stored by the agent.

## Layers

### 1. Model engine (replaceable) — IMPLEMENTED
- llama.rn 0.13 (llama.cpp bridge) loads any compatible GGUF model.
- Models are downloaded in-app from Hugging Face or imported as files
  (ModelStore / HFStore). Swapping the brain = downloading another
  model; the app never has to be rebuilt for a new model.
- Future devices (powerful phones, PC-class hardware) run the same
  GGUF contract with larger models; the module layer below is
  model-agnostic by design.

### 2. Model library & task-based routing — PARTIAL
- Multiple offline models can coexist on the device; each Pal can be
  assigned a default model.
- `src/store/moosaModules.ts` defines the routing policy as data
  (MOOSA_MODEL_TIERS): Fast (Qwen3-1.7B, verified on the target
  phone), Balanced (Qwen2.5-3B-Instruct, benchmarking), Deep
  (Qwen3-4B, benchmarking, high RAM risk on 6 GB), Vision (Lookie's
  vision model pathway, planned as a general module).
- Each capability module declares a `preferredTier`. Automatic
  per-message model switching is NOT implemented: routing today is
  "the right Pal with the right model", chosen by the user.

### 3. Agent execution (tool calling) — PARTIAL (upstream substrate)
- `src/services/agent/AgentRunner.ts` implements a multi-turn agent
  loop (default max 5 turns) that lets a model call Talent engines
  and use their results.
- Offline engines that exist: Calculator, Date & Time.
- Internet engines that exist but are OFF by MOOSA policy unless the
  user explicitly enables them with their own keys: Web Search,
  Read URL (they disclose themselves as external services).
- Mission Mode (long autonomous missions with permission gates) is
  PLANNED on top of this loop, not yet built.

### 4. Capability modules (Pals) — IMPLEMENTED (v1)
- Built-in Pals are seeded from the module registry in
  `src/store/moosaModules.ts` by `PalStore.initializeMoosaPals`:
  Moosa (mentor), Moosa Business (Fiverr writing/QC), Moosa English
  Teacher, Moosa Trading Teacher (education + paper only).
- Seeding is idempotent per module; user edits/deletions survive.

### 5. Memory — PARTIAL
- Chats and Pals persist in a local SQLite database (WatermelonDB) on
  the device, independent of the model: changing models loses nothing.
- A curated, user-controlled long-term memory system (inspectable and
  editable facts the agent applies across chats) is PLANNED. Today the
  honest mechanism is the user-editable memory note the user pastes at
  chat start. The agent never claims memory it does not have.

### 6. Voice — PARTIAL
- Speech out: on-device TTS service exists (Kokoro engine via
  @pocketpalai/react-native-speech). Needs on-device testing in the
  MOOSA build.
- Speech in: keyboard microphone (may need internet, OS-dependent).
- Wake word: NOT implemented. Reliable offline wake-word on a 6 GB
  phone is a separate research item, not promised.

### 7. Vision — PARTIAL
- The Lookie VideoPal (react-native-vision-camera + a vision model)
  already describes camera input on-device.
- General screenshot/website visual inspection as a MOOSA module is
  PLANNED (Vision tier). Text-only models cannot see; nothing in the
  prompts claims otherwise.

### 8. Android control — NOT IMPLEMENTED
- No accessibility-service automation exists in this codebase.
- Permission-based app control is a future stage requiring new native
  code and a permission-gated design. Until then, neither the app nor
  its prompts claim to open apps or control the phone.

### 9. Business workflows (Fiverr / Shopify / marketing) — PARTIAL
- Offline drafting and analysis: via Moosa Business module.
- Live platform work (browsing Fiverr/Shopify, publishing, client
  messaging) cannot be done by the local model and is performed, when
  requested, by the user's assistant in chat with the user's
  approval — disclosed as such, never disguised as the local model.

### 10. Trading — EDUCATION ONLY (by design)
- No live market data exists offline; no real orders are possible.
- The Trading Teacher module teaches concepts, risk and paper
  practice only.

### 11. Backup & multi-device — PARTIAL
- Source of truth: this repository (code + module definitions +
  prompts). Models are re-downloadable from Hugging Face.
- Encrypted backup of app data and cross-device sync: PLANNED.
- The same codebase targets Android today; iOS/Windows builds are a
  future stage (React Native base, with platform work still required
  — compatibility is not claimed until tested).

## Status summary

| Area | Status |
|---|---|
| Local model engine (GGUF, replaceable) | Implemented |
| Multiple offline models | Implemented |
| Task-based model routing | Partial (policy data + per-Pal models; no auto-switch) |
| Agent tool-calling loop | Partial (upstream AgentRunner + offline engines) |
| Capability modules (Pals) | Implemented (v1: 4 modules) |
| Persistent memory (model-independent) | Partial (SQLite persistence; curated memory planned) |
| Voice out (TTS) | Partial (engine present; MOOSA-build test pending) |
| Voice in / wake word | Partial (keyboard mic) / Not implemented (wake word) |
| Vision | Partial (Lookie camera descriptions; general module planned) |
| Android app control | Not implemented |
| Fiverr/Shopify live workflows | Partial (offline drafting; live work via assistant in chat, disclosed) |
| Trading | Education/paper only, by design |
| Encrypted backup / multi-device | Planned (repo is the current backup of code/config) |

## Hybrid operation (added 2026-10-19, owner's final decision)

MOOSA is a **hybrid** agent: local-first brain, online tools when the
internet is available.

- **The brain never moves.** Reasoning and conversation always run on
  the local GGUF model. The system never switches to a cloud AI model
  (ChatGPT, Claude, Gemini or any other) without the owner's explicit
  permission. No code path in this project does so.
- **Offline mode (no internet):** local models, offline Talent
  engines (Calculator, Date & Time), on-device TTS, and the local
  database/memory keep working. Nothing about the core assistant
  depends on a connection.
- **Online tools (internet available):** the codebase already contains
  internet Talent engines (Web Search, Read URL) behind the Talent
  registry. MOOSA policy: they stay OFF until the owner explicitly
  enables them with their own provider key, because they send queries
  to an external service. Enabling them is a settings decision by the
  owner, never a silent default.
- **Actions with side effects** (sending messages, publishing,
  purchases, deletions, trades) require the owner's explicit approval
  in all modes. Approved autonomous missions (Mission Mode) remain
  PLANNED on top of the AgentRunner loop.
- **Business work today:** offline drafting/analysis happens in the
  app (Moosa Business). Live platform work (Fiverr, Shopify, market
  data) is performed by the owner's assistant in chat, disclosed as
  such, until the app's own online tools are enabled and tested.

## Portability, backup & sync (owner requirement, 2026-10-19)

MOOSA is a portable, online-connected, local-first agent — not an app
trapped on one phone.

- **Source code** lives on GitHub (the owner's fork) with full version
  history; project files stay accessible online.
- **Phone** = interface, local GGUF inference, voice, vision and
  device controls. The AI brain is ALWAYS a local open-weight model;
  online services are never silently substituted as the reasoning
  engine.
- **Secure online storage** (future, owner-approved provider): client
  project files, documents and APPROVED memory backups, with
  synchronization so MOOSA can be restored on a new phone and can work
  on authorized project files with the owner's permission.
- **Memory backups must be encrypted before upload.** GitHub must
  NEVER store passwords, API keys or unencrypted sensitive client
  information — code and non-sensitive project files only.
- **Restore path:** install MOOSA on a new device -> sign in ->
  restore encrypted backup -> re-download the local GGUF model.
- **Future devices:** Android first; the same architecture extends to
  PC later (the local engine and data formats are portable by design).

Status today: source on GitHub ✅; encrypted backup / cloud sync /
restore-on-new-device = PLANNED (Stage 4/9 work), not yet built.
