# SkillsAllYouNeed for LLMs

> The open registry of AI skills — ready-to-use capability definitions for Claude, Claude Code, ChatGPT, Codex, OpenCode, Cursor, Gemini, Perplexity, Microsoft 365 Copilot, GitHub Copilot, Antigravity, Kiro, and Pi.

[![Live site](https://img.shields.io/badge/live%20site-kishormorol.github.io%2FSkillsAllYouNeed-C7401E?style=flat-square)](https://kishormorol.github.io/SkillsAllYouNeed/)
[![Skills](https://img.shields.io/badge/skills-181-15130E?style=flat-square)](https://kishormorol.github.io/SkillsAllYouNeed/)
[![Ecosystems](https://img.shields.io/badge/ecosystems-13-1B5296?style=flat-square)](https://kishormorol.github.io/SkillsAllYouNeed/)
[![License](https://img.shields.io/badge/license-CC%20BY%204.0-4527A0?style=flat-square)](https://creativecommons.org/licenses/by/4.0/)
[![API](https://img.shields.io/badge/API-skills.json-1A7A44?style=flat-square)](https://kishormorol.github.io/SkillsAllYouNeed/skills.json)

---

## What is this?

**SkillsAllYouNeed** is a searchable, filterable reference directory of every first-party skill, capability, tool, and extension shipping across the major AI assistant platforms. Think of it as an *arXiv meets print magazine* — editorial-preprint-styled, printable, and deep-linkable.

If you've ever asked *"Can Claude do X?"* or *"How do I trigger ChatGPT's deep research?"* — this is the answer page.

**→ [Open the live registry](https://kishormorol.github.io/SkillsAllYouNeed/)**

---

## Ecosystems covered (181 skills)

| Ecosystem | Skills | Highlights |
|-----------|--------|------------|
| **Claude** | web, desktop & mobile | Artifacts, Projects, Memory, Extended Thinking, Computer Use |
| **Claude Code** | CLI + IDE agent | MCP servers, Hooks, Subagents, Skills, CI integration |
| **ChatGPT** | web, desktop & mobile | Canvas, Custom GPTs, Voice, Deep Research, Operator |
| **Gemini** | web, mobile & Workspace | Gems, Deep Research, Imagen, Veo, NotebookLM, Gemini API |
| **Perplexity** | answer engine | Pro Search, Spaces, Pages, Focus modes, Sonar API |
| **Microsoft 365 Copilot** | Microsoft 365 + Windows | Word/Excel/Teams, Designer, Pages, Notebook |
| **OpenCode** | open source terminal agent | Plan/Build modes, Custom Agents, Plugins, LSP, MCP, GitHub Actions |
| **Codex** | CLI + desktop agent | Plan/Goal modes, Worktrees, Automations, Computer Use, Skills |
| **Cursor** | AI-native code editor | Agent Mode, Plan Mode, Rules, Skills, MCP, Cloud Agent, Bugbot, CLI |
| **GitHub Copilot** | IDE + CLI agent | Code Completion, Chat, CLI, Cloud Agent, Code Review |
| **Antigravity** | Google coding agent | Projects & Worktrees, agy CLI, Scheduled Tasks, Artifacts |
| **Kiro** | agentic engineering IDE | Specs, Task execution, Steering, Hooks, Powers |
| **Pi** | minimal terminal coding harness | Compaction, Extensions, Skills, Prompt templates, Pi packages, Multi-provider |

---

## Why people use this

- **Discover hidden features** — find capabilities you didn't know your AI assistant had
- **Onboard your team** — share a deep link to any skill so teammates can activate it immediately
- **Compare across platforms** — the 36-row capability matrix shows what each ecosystem supports
- **Build with confidence** — every entry includes the exact trigger phrase, a worked example, and an official source link
- **Use as a corpus** — download `skills.json` for RAG pipelines, fine-tuning datasets, or tooling

---

## Features

### Search & filter
- Full-text search across names, descriptions, triggers, and examples
- Filter chips for ecosystem, category (9 types), and status (Stable / Beta / Deprecated)
- Count badges on every chip show entries per dimension
- Quick presets: **Claude Code**, **Agentic**, **Stable**, **New additions**
- Active filter tag bar with one-click dismiss per filter
- Sort by index order or recent (Beta-first)

### Cards & detail sheet
- 181 skill cards in an asymmetric 12-column editorial grid
- Per-ecosystem brand colors (vermillion, navy, green, purple, teal, blue)
- **Click any card** → full detail sheet with description, trigger, how-to, worked example, and source
- **Related skills** — up to 4 cross-links by category and ecosystem inside every sheet
- Trigger phrase on every card — click to copy to clipboard instantly
- Prev / Next navigation between skills without closing the sheet
- Deep-link anchor (¶) per card — hash routing auto-opens the correct sheet on load

### Save & share
- ♡ / ♥ favorites button on every card — persisted in `localStorage`
- Saved filter shows only your bookmarked skills
- Web Share API integration — native share sheet on mobile
- **Export JSON ↓** — downloads currently visible skills as a structured JSON file
- **[skills.json API](https://kishormorol.github.io/SkillsAllYouNeed/skills.json)** — machine-readable corpus of all 181 skills (CC BY 4.0)

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `/` | Focus search |
| `?` | Toggle shortcuts card |
| `Esc` | Close sheet / shortcuts |
| `j` / `k` | Navigate cards |
| `←` / `→` | Prev / next inside sheet |
| `f` | Toggle favorite |
| `r` | Random skill |

### Other
- 🌙 Dark mode (persisted in `localStorage`)
- 📱 PWA-ready — installable on mobile and desktop
- Comparison matrix: 36 capability rows × 13 ecosystems
- JSON-LD structured data (`schema.org/Dataset`) for search engine rich results
- Full print stylesheet — single column, page numbers, expanded content
- Scroll-to-top button, onboarding strip (shown once), ecosystem deep-dive strip

---

## Tech

Modular HTML + CSS + JS. Zero build step. Zero runtime dependencies.

```
index.html   ← skeleton HTML
styles.css   ← all presentation
data.js      ← skills corpus, glyphs, ecosystem config
scripts.js   ← renderer, filters, state, interactions
skills.json  ← machine-readable corpus
sitemap.xml  ← for search engine crawlers
manifest.json← PWA manifest
favicon.svg  ← brand icon
```

- **Type:** Instrument Serif · Newsreader · JetBrains Mono
- **Palette:** paper `#F2EFE6` · ink `#15130E` · vermillion `#C7401E`
- **Hosting:** GitHub Pages (free, zero config)

---

## Use the JSON API

All 181 skills are available as a static JSON endpoint:

```
GET https://kishormorol.github.io/SkillsAllYouNeed/skills.json
```

```json
{
  "version": "1.7",
  "count": 181,
  "ecosystems": ["Claude", "Claude Code", "ChatGPT", "Codex", "OpenCode", "Cursor", "Gemini", "Perplexity", "Microsoft 365 Copilot", "GitHub Copilot", "Antigravity", "Kiro", "Pi"],
  "license": "CC BY 4.0",
  "skills": [
    {
      "id": "cl-artifacts",
      "name": "Artifacts",
      "ecosystem": "Claude",
      "category": "Visual",
      "status": "Stable",
      "description": "...",
      "trigger": "...",
      "howto": "...",
      "example": "...",
      "source": "..."
    }
  ]
}
```

Good for: RAG pipelines · fine-tuning datasets · AI assistant tooling · research

---

## Versions

| Version | What shipped |
|---------|-------------|
| **v1.7** | Cursor + Kiro ecosystems, 18 new sourced entries, Comet + Copilot Studio expansions, context/spec/harness matrix rows, corpus validator |
| **v1.6** | Pi ecosystem, 8 skills, font flash fix, complete matrix columns |
| **v1.5** | GitHub Copilot + Antigravity ecosystems, Microsoft 365 Copilot rename, 9 new skills, modular architecture (styles.css, data.js, scripts.js), smooth scroll, font fixes |
| **v1.4** | OpenCode + Codex ecosystems, 22 new skills, branded SVG icons, 8-ecosystem matrix |
| **v1.3** | Perplexity + Microsoft 365 Copilot ecosystems, 13 new skills, related-skills panel, JSON-LD, `skills.json` API, `sitemap.xml`, GitHub star button, 32-row capability matrix |
| **v1.2** | Dark mode, PWA + favicon, onboarding, presets, ecosystem brand colors, hover effects, modal animations, favorites, chip counts, sheet nav, export, keyboard shortcuts |
| **v1.1** | +43 entries, API category, hash routing, keyboard shortcuts, ecosystem strip, print stylesheet |
| **v1.0** | Initial release — 38 entries across four ecosystems |

---

## Contributing

Found a missing skill? Spotted an error? Two ways to help:

1. **[Open an issue](https://github.com/kishormorol/SkillsAllYouNeed/issues/new?template=submit-capability.yml)** using the structured submission form
2. **Fork and PR** — run `npm ci`, add entries to the `SKILLS` array in `data.js`, then run `npm run generate`

Every entry needs: `id`, `name`, `ecosystem`, `category`, `status`, `description`, `trigger`, `howto`, `example`, `source`.

Run `npm run validate` before opening a PR. It checks the registry, comparison matrix, submission form, workflow, and generated `skills.json`.

---

## Contributors

Thanks to everyone who has helped grow the registry:

| Contributor | What they added |
|-------------|----------------|
| [@WhiteHades](https://github.com/WhiteHades) | OpenCode + Codex ecosystems, 22 skills, branded SVG icons (v1.4) · GitHub Copilot + Antigravity ecosystems, Microsoft 365 Copilot rename, modular architecture refactor (v1.5) · Pi ecosystem, 8 skills, font flash fix, complete matrix columns (v1.6) |

Want to see your name here? [Open a PR](https://github.com/kishormorol/SkillsAllYouNeed/compare) adding skills or fixing entries.

---

## License

Content: **CC BY 4.0** — free to use, adapt, and redistribute with attribution.  
Code: **MIT**

---

*Named in tribute to [Attention Is All You Need](https://arxiv.org/abs/1706.03762) — Vaswani et al., 2017.*

<!-- Search keywords: AI skills directory, LLM capabilities, Claude skills, ChatGPT features, Gemini tools, Perplexity features, Copilot skills, prompt engineering, AI assistant comparison, MCP tools, Claude Code skills, AI capabilities registry, GitHub Copilot skills, Antigravity skills, Codex skills, OpenCode skills -->
