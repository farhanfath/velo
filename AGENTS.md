# AGENTS.md — Velo (`storage-local`)

Code lives in this repo (`D:\My Data\FATHUR PROGRAM\ai-project-all\storage-local`). **All product documentation, specs, plans, roadmap, decisions, and progress live in the Obsidian vault `D:\vault\storage-vault`**, which is the single **Source of Truth**. Do not scatter design or progress docs inside this code repository.

## Every session

1. **Before doing anything**, read:
   - `D:\vault\storage-vault\00-Index.md`: project overview and navigation hub.
   - `D:\vault\storage-vault\progress-log.md`: what previous sessions did and what is unfinished (newest entry at the bottom).
   - The active spec in `D:\vault\storage-vault\specs\` (`2026-11-08-storage-local-design.md`).
   - The active implementation plan or roadmap in `D:\vault\storage-vault\plans\` (`2026-11-08-storage-local-plan.md`, `roadmap-velo.md`).
2. **During work**:
   - If code and the vault disagree, the vault wins — or update the vault spec/decision first, then update the code.
   - Tick plan checkboxes (`- [x]`) in the vault plan/roadmap as steps complete.
3. **Before ending the session**, append an entry to `D:\vault\storage-vault\progress-log.md` (append-only, never rewrite past entries):

```markdown
## YYYY-MM-DD — <agent/tool> — <short title>
- **Did**: ...
- **Decisions**: ... (significant decisions also get a note in `decisions/` and a `[[wikilink]]`)
- **Unfinished / Next**: ...
```

## Vault layout (`D:\vault\storage-vault`)

- `00-Index.md`: Central navigation hub (`[[wikilinks]]` to all active specs, plans, roadmap, and decisions).
- `specs/`: Validated design documents (`2026-11-08-storage-local-design.md`).
- `plans/`: Step-by-step implementation plans (`2026-11-08-storage-local-plan.md`) and future roadmap (`roadmap-velo.md`).
- `decisions/`: Architecture & product decision notes (`ADR-001-tauri-v2-pure-rust-vault.md`).
- `progress-log.md`: Append-only chronological session log.

## Project Summary

**Velo** (`storage-local`) is a 100% local-first, zero-server desktop credential & secret centralizer built with **Tauri v2 (Rust Core Engine + React 19/TypeScript + Tailwind CSS v4)**.
- **Crypto & Storage**: Pure Rust `argon2` (`Argon2id`) + `chacha20poly1305` (`XChaCha20-Poly1305`) + `zeroize` with atomic single-file `.vault` persistence and automatic `.vault.bak` backup.
- **Core Workflow**: Smart Chat-Style Parser (`Title` + `key: value` lines + `#tags`), Bulk Paste Migrator (from WhatsApp/Telegram/Notepad), Instant Search & Reverse Email Relation Lookup, 30s Clipboard Auto-Clear, System Tray & Global Hotkey (`Ctrl+Shift+Space`), and Idle Auto-Lock.
- **Standalone Release Binary**: `src-tauri\target\release\Velo.exe` (built via `npm.cmd run tauri build -- --no-bundle`).
