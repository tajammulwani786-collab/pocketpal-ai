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
