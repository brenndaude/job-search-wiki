# Job-search wiki: schema and operating manual

This repository is a **personal, LLM-maintained wiki** for a job search, following Andrej Karpathy's
[LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

The human is the **curator**: they drop in sources, make decisions and send things. The LLM (Claude
Code) is the **librarian**: it reads sources, keeps the wiki current, builds application packages and
keeps the to-do list honest. The human never edits the wiki by hand.

---

## Layers

| Layer | Path | Owner | Mutability |
|---|---|---|---|
| Raw sources | `raw/` | Human | Immutable: emails, job posts, call notes, CV exports. Never edit |
| Wiki | `wiki/` | LLM | Written and maintained by the LLM |
| Applications | `applications/` | LLM | One folder per target, plus `_base/` and `_pipeline/` |
| Facts | `wiki/facts.md` | Both | The canonical career facts every document must match |
| Index | `index.md` | LLM | Updated on every change |
| Log | `log.md` | LLM | Append-only record of what was done |

`raw/`, `wiki/` content and `applications/*/` packages hold personal data. In a real search, keep the
repository private, or keep those folders out of git.

## Wiki structure

```
wiki/
├── overview.md      Where the search stands and what's next. Short, scannable
├── facts.md         Canonical titles, dates, figures, languages; and what never to write
├── sources/         One page per raw source (summary + takeaways)
├── entities/        People, companies, recruiters, schools
└── concepts/        Strategy, pay research, processes, rules
```

## Page conventions

Every page except `index.md`, `log.md` and `overview.md` starts with YAML frontmatter:

```yaml
---
type: source | entity | concept
title: Human-readable title
tags: [kebab-case]
sources: [raw files or wiki pages this draws from]
updated: YYYY-MM-DD
---
```

- Cross-reference with `[[page-name]]` (Obsidian-compatible).
- Cite inline: `(source: raw/<file>)` or `(source: [[page]])`.
- Flag contradictions with a `> ⚠ Conflict:` blockquote naming both sources. Newer beats older unless
  the human says otherwise.
- **Never invent facts.** Unknown or inferred? Say so, or leave a `> TODO:` blockquote.

## Operations

### Ingest (a new source arrives)
1. Save it to `raw/`. 2. Read it. 3. Discuss the takeaways with the human. 4. Write
`wiki/sources/<slug>.md`. 5. Update every entity and concept it touches (often 5 to 15 pages).
6. Update `overview.md`, `index.md`, and `applications/_pipeline/todo.md`. 7. Append to `log.md`.

### Query
Read `index.md` first, then the pages it points to. Answer with citations to wiki pages. If the answer
is reusable, offer to file it as a page.

### Lint (when asked, or every ~10 ingests)
Contradictions between pages, stale claims, orphan pages, broken `[[links]]`, important entities with
no page, index entries that no longer match.

## Application packages

Every target gets `applications/<company>-<year>/`:

| File | Content |
|---|---|
| `README.md` | Files, status table, next actions |
| `research-dossier.md` | Company, people, process, pay, sources |
| `job-description.md` | The posting, verbatim, with URL and capture date |
| `resume.html` | Forked from `_base/`, tailored. One page, gated by `_verify.mjs` |
| `application-text.md` | Cover message, form answers, phone-screen pitch |
| `outreach.md` | Notes to named people (≤ 200 characters for LinkedIn invitations) |
| `strategy.md` | Fit and gaps, pay, interview prep, and **what not to claim** |

Before anything is sent, run `node applications/_pipeline/quality-gate.mjs applications/<folder>`:
one page, no placeholders, employer and role named, nothing from `facts.md` « Never write ».

## Résumés

- **One page, no gaps.** `_verify.mjs` measures overflow against the A4 print area
  (`print_overflow_px` must be negative; aim for −15 or lower). To make room, shorten lines that wrap
  by a word or two before cutting facts.
- **Every claim traceable.** Titles, dates and figures come from `wiki/facts.md`. Client names and
  numbers come from the human or from the project itself, never from the LLM's imagination.
- Deviations for one posting are allowed, and recorded in that package's `strategy.md`.

## Correspondence

- Short and direct. Lead with the ask. No em dashes, metaphors or flourishes; they read as written by
  an AI.
- **Warm contacts (friends inside a company):** say you're moving or looking, name the role you applied
  to and whose team you think it is, ask whether they know that person or someone on the team, add a
  three-line blurb they can forward with the CV attached, and suggest catching up. No dates or project
  details.
- Personalised LinkedIn invitations are rationed on free accounts: spend them on hiring managers;
  send everyone else a blank invitation and the message after they accept.

## Log format

```
## [YYYY-MM-DD] <op> | <short description>
```

`<op>` is one of `init | ingest | query | lint | refactor | note`. Submissions are also logged in
`applications/_pipeline/log.md` as `submit | <employer> · <role>`.

## Working style

- Concrete next actions first. `applications/_pipeline/todo.md` is the single list; roll unfinished
  items forward each day.
- Discuss before writing big new pages. Update `updated:` whenever a page changes.
- Anything sent outside (email, form, post) is the human's call. Draft, don't send.
