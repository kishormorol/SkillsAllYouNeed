---
name: skill-audit
description: "Audit and lint Agent Skills (SKILL.md and bundled scripts/references) for YAML frontmatter errors, broken links, weak trigger descriptions, context bloat, hardcoded secrets, and unsafe shell or prompt-injection patterns. Use when the user asks to 'audit my skills', 'lint SKILL.md', 'check why my skill isn't triggering', 'verify a skill before installing or publishing', or 'scan skills for broken references or security issues'."
argument-hint: "[skill_dir_or_root ...] [--format text|json|tsv] [--fail-on error|warning|none]"
---

# Audit Agent Skills before they fail silently

A broken skill rarely crashes with a stack trace. Instead, an unquoted `: ` in
frontmatter drops the skill from the menu, a renamed helper script fails on the day
it is called, or a description that states *what* the skill is without *when* to use
it causes the agent to ignore it. Third-party skills cloned from GitHub can also hide
hardcoded credentials, destructive shell pipelines, or prompt-injection payloads.

This skill runs `scripts/audit_skills.py` to check skill folders deterministically,
reports the exact file and line for every finding, and proposes targeted fixes.

## 1. Run the auditor

The script sits under `scripts/` next to this `SKILL.md`:

```bash
python3 <skill_dir>/scripts/audit_skills.py [paths...]
```

On Windows, run it with `python` instead of `python3`.

- **No paths given:** scans `~/.agents/skills` and `~/.claude/skills`, deduplicating
  symlinks and junctions so each skill is checked once.
- **Specific path(s):** accepts a single skill folder (`./my-skill`), a parent folder
  of skills (`~/.claude/skills` or `./.claude/skills`), or a `SKILL.md` file directly.
- **Machine-readable output:** pass `--format json` or `--format tsv` when inspecting
  large collections or wiring into CI.

## 2. What it checks

| Category | Code | Severity | Why it matters |
|---|---|---|---|
| **Frontmatter & Spec** | `missing-frontmatter`, `unclosed-frontmatter`, `frontmatter-syntax`, `frontmatter-tab-indent`, `frontmatter-unclosed-quote` | error | Agents silently skip a skill whose YAML header fails to parse. |
| **YAML Scalar Traps** | `unquoted-colon-in-frontmatter`, `unquoted-hash-in-frontmatter` | error | An unquoted `: ` or ` #` in `description` splits the mapping or truncates the text as a comment. |
| **Skill Identity** | `missing-name`, `invalid-name-format`, `name-directory-mismatch` | error / warning | Names must be `lowercase-hyphenated` and match the folder name across Claude Code, Codex, and Cursor. |
| **Trigger Quality** | `missing-description`, `description-too-short`, `description-too-long`, `weak-trigger-description` | error / warning | The description is the only text in context before a skill loads. Without trigger cues (`Use when...`, `Use for...`, or quoted user phrasings), the agent undertriggers. |
| **Progressive Disclosure** | `empty-body`, `body-too-long` | error / warning | A `SKILL.md` body over 500 lines crowds the context window; detailed docs belong in `references/`. |
| **Bundled References** | `missing-bundled-file`, `broken-markdown-link`, `path-traversal` | error | Verifies every `scripts/<file>`, `references/<file>`, `assets/<file>` path and markdown link resolves inside the skill folder. |
| **Security & Hygiene** | `hardcoded-secret-*`, `pipe-to-shell`, `destructive-rm-root`, `prompt-injection`, `script-not-executable` | error / warning | Catches leaked API keys, remote shell-pipe patterns, root/home deletions, and instruction-override strings before a skill is trusted. |

## 3. Report and fix

1. **Report only first.** Group findings by skill (`ERROR`, then `WARN`), citing
   `file:line` and the rule code. Do not edit any skill file without asking.
2. **Distinguish real bugs from illustrative examples.** A skill about security or
   authoring skills may intentionally mention a placeholder path or an example command
   inside a fenced code block. Call those out clearly instead of deleting examples.
3. **Offer concrete fixes.** Show the exact frontmatter quote fix, updated trigger
   description, or corrected file path, and wait for the user's yes before writing.
