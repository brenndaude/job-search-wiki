# Northwind Robotics: application package (example)

Fictional target used to show the package standard. Role: ML Engineer, Fleet Forecasting (ref NW-042).

| File | Purpose |
|---|---|
| `job-description.md` | The posting, verbatim, with URL and capture date |
| `research-dossier.md` | Company, people, process, pay, sources |
| `resume.html` | One-page CV forked from `_base/`. Gate: `node _verify.mjs` |
| `application-text.md` | Cover message, form answers, phone pitch |
| `outreach.md` | Notes to named people |
| `strategy.md` | Fit, gaps, pay, interview prep, what not to claim |

## Status
| Item | State |
|---|---|
| CV | ✅ One page |
| Application text | ✅ Drafted |
| Outreach | ✅ Drafted, unsent |
| Application | ❌ Not submitted |

## Next actions
1. Run the gate: `node ../_pipeline/quality-gate.mjs .` (with `EMPLOYER_NAME="Northwind Robotics"`).
2. Submit, then log it in `../_pipeline/log.md`.
3. Same day: the two outreach notes.
