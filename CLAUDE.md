# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A personal collection of Claude Agent Skills. There is no application code, build system, package manifest, linter, or test suite — this repo is pure content (Markdown instructions + reference data), packaged for Claude to load as skills.

## Structure

Each skill lives in `skills/<skill-name>/` and follows the standard Agent Skill layout:

- `SKILL.md` — required. YAML frontmatter (`name`, `description`, and for story-forge also `compatibility`) followed by the full instruction body. The `description` field is what a Claude instance uses to decide *when* to invoke the skill, so it front-loads trigger phrases and use cases — treat it as load-bearing, not just documentation.
- `references/*.md` — optional supporting files a skill points to for lookups (e.g. `daily-prompt-writing/references/prompt-elements.md` is a bank of prompt seeds the skill remixes from rather than quotes verbatim).
- `<skill-name>.skill` — a zip archive (deflate, v2.0) containing the same `SKILL.md` (and any `references/`) under a top-level folder named after the skill. This is the packaged/installable form of the skill and must be kept in sync with the loose files any time the skill is edited.

## Working on a skill

- Edit the loose `SKILL.md` / `references/` files first, then re-zip to update the matching `.skill` archive so the two don't drift:
  ```
  cd skills/<skill-name> && zip -r <skill-name>.skill <skill-name>/... 
  ```
  (mirror the existing archive layout — top-level folder named after the skill, containing `SKILL.md` and any `references/`.)
- Skill instructions are behavioral specs for an LLM, not code: precision in wording matters (what's shown to the user vs. kept as private bookkeeping, exact output formatting, when to roll dice vs. narrate, tone/register rules). When editing, preserve this precision rather than paraphrasing loosely.
- There are no automated checks. "Testing" a change means walking through the skill's own workflow by hand (e.g. actually invoking `/writing-prompt` or running a turn of `story-forge`) and confirming the described behavior holds.
