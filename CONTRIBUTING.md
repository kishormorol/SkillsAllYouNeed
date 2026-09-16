# Contributing to SkillsAllYouNeed

This is a directory of first-party skills and capabilities shipped by AI vendors. Additions and corrections are welcome from anyone.

## Adding or correcting a skill

Use the issue forms, which collect the right fields:

- **Submit a capability** to add a skill that is missing.
- **Report a correction** when an entry is wrong or out of date.

Every entry needs a source link to first-party documentation. Entries without one are not merged, because the point of the registry is that each claim is checkable.

## Editing the corpus directly

Skill data lives in the corpus that generates `skills.json`:

```bash
npm run validate   # validate the corpus
npm run generate   # validate and rewrite skills.json
```

Run `npm run generate` before opening a PR so the published JSON matches the corpus.

## Scope

First-party only: skills, capabilities, tools and extensions shipped by the vendor of the assistant. Third-party plugins and community prompt packs belong elsewhere.

## License

Content is CC BY 4.0. By contributing you agree your contribution is released under that license.
