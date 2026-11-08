# AGENTS.md — storage-local

Code lives in this repo (`D:\My Data\FATHUR PROGRAM\ai-project-all\storage-local`). **All product documentation, specs, plans, decisions, and progress live in the Obsidian vault `D:\vault\storage-vault`**, which is the single **Source of Truth**. Do not scatter design or progress docs inside this code repository.

## Every session

1. **Before doing anything**, read:
   - `D:\vault\storage-vault\00-Index.md`: project overview and navigation hub.
   - `D:\vault\storage-vault\progress-log.md`: what previous sessions did and what is unfinished (newest entry at the bottom).
   - The active spec in `D:\vault\storage-vault\specs\`.
   - The active implementation plan in `D:\vault\storage-vault\plans\`.
2. **During work**:
   - If code and the vault disagree, the vault wins — or update the vault spec/decision first, then update the code.
   - Tick plan checkboxes (`- [x]`) in the vault plan as steps complete.
3. **Before ending the session**, append an entry to `D:\vault\storage-vault\progress-log.md` (append-only, never rewrite past entries):

```markdown
## YYYY-MM-DD — <agent/tool> — <short title>
- **Did**: ...
- **Decisions**: ... (significant decisions also get a note in `decisions/` and a `[[wikilink]]`)
- **Unfinished / Next**: ...
```

## Vault layout (`D:\vault\storage-vault`)

- `00-Index.md`: Central navigation hub (`[[wikilinks]]` to all active specs, plans, and decisions).
- `specs/`: Validated design documents (`YYYY-MM-DD-<topic>-design.md`).
- `plans/`: Step-by-step implementation plans (`YYYY-MM-DD-<topic>-plan.md`).
- `decisions/`: Architecture & product decision notes (why chosen, alternatives rejected).
- `progress-log.md`: Append-only chronological session log.

## Project Summary

**Storage Local** is a 100% local-first, zero-server desktop credential & secret centralizer built with **Tauri v2 (Rust Core Engine + React/TypeScript + Tailwind CSS)**.
- **Crypto & Storage**: Pure Rust `argon2` (`Argon2id`) + `chacha20poly1305` (`XChaCha20-Poly1305`) + `zeroize` with atomic single-file `.vault` persistence and automatic `.vault.bak` backup.
- **Core Workflow**: Smart Chat-Style Parser (`Title` + `key: value` lines + `#tags`), Bulk Paste Migrator (from WhatsApp/Telegram/Notepad), Instant Search & Reverse Email Relation Lookup, System Tray & Global Hotkey (`Alt+Space` / `Ctrl+Shift+Space`), and Auto-Lock.
