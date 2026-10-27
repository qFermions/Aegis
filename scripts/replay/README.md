# Aegis Replay Cache — deterministic fast path (V2)

Contract for `replay-cli.js`. Decision record: `docs/adr/ADR-006-harness-native-governance.md`.
Suite: `node scripts/replay/replay.test.js` (R1–R15). Demo: `node scripts/replay/replay-demo.js`
(sandboxed, rerunnable, prints every CLI step).

## What it is

The cheapest rung of the execution-strategy ladder (`docs/harness.md`): a
previously **verified** ticket solution whose authority basis is unchanged is
replayed verbatim from local storage — no model reasoning, no agents, no loops,
no graph, no network. Determinism is the point: whether a ticket is "the same"
is decided by normalization + sha256 keys, never by an LLM.

## Lifecycle

```
record (candidate) ──verify --evidence [--identity-variants]──▶ verified ──lookup/render──▶ CACHE_HIT
                                                                   │ authority fingerprint changed
                                                                   ▼
                                                                 stale  (preserved as historical
                                                                         evidence; live tickets route
                                                                         through the adaptive path)
```

- **Only verified solutions replay.** Raw ticket text, guesses, draft agent
  output, and failed attempts are not authoritative memory (R2/R5). An alias that
  points at an unverified case is still a MISS (R2).
- **Invalidation is fingerprint-based, never a time TTL.** Each verified case
  records sha256 fingerprints of the authority files it depends on; fingerprints
  are rechecked at lookup AND at render (time-of-use). A changed basis → STALE,
  served only with `--historical` under an explicit banner (R6). Unrelated
  changes do not invalidate (R7).
- **Persistence boundary (SR-1/SR-8):** secret-shaped content, the tenant
  literal, real email addresses (bracket-wrapped or not), and phone-number
  patterns (dashed, dotted, spaced, parenthesised, international, bare ten
  digits) are refused at `record`, `verify`, `alias`, and `invalidate` (exit 4)
  — private material cannot even enter the store (R8, R9). Only canonical
  placeholder shapes are exempt: upper-case tokens such as `[USER@DOMAIN.COM]` /
  `[JIRA-###]`, the `[@Aegion_*]` family, and RFC `example.*` domains. The
  pattern set is explicit and finite — a boundary against the shapes it lists,
  not a PII classifier.
- **Instruction-shaped text is refused at the same boundary (SR-3, exit 4).**
  A verified solution renders verbatim with zero new reasoning, so a ticket,
  solution, evidence, alias or reason carrying one of the graph edge
  sanitizer's injection markers (`scripts/graph/sanitize.js`) never enters the
  store. Markers are matched as written and confusable-folded (zero-width and
  other format characters, fullwidth forms, combining marks, Latin
  look-alikes). Pinned by `scripts/untrusted/poisoned-memory.test.js` B7.
- **A second tenant is refused at the same boundary (exit 4).** `[@Aegion_*]`
  is this deployment's org; an org environment token of any other namespace
  (`[@<Namespace>_<suffix>]`, any spelling of the suffix: mixed case, digits, hyphens, more underscores) in a ticket, solution, evidence, alias or
  reason means the case mixes two tenants, so it never enters the store (same
  rule as the graph edge sanitizer). Pinned by
  `scripts/untrusted/wrong-customer.test.js` C4.
- **Re-checked at read time.** `lookup` and `render` run the same persistence
  boundary over the stored ticket and solution before they serve a case. A case
  changed on disk outside the CLI so that it carries instruction-shaped text, a
  secret, a real address, the tenant literal or a second org namespace is a
  `MISS` with a `withheld` list of labels (lookup) or exit 4 (render); its text is
  never printed. Residual: a gate-clean edit to a case file is not detected,
  because case files carry no seal (the memory store has one).
- **One store, one tenant (exit 6).** The store's first write under a tenant
  (`AEGION_DOMAIN` set) binds it: `tenant.json` records a sha256 fingerprint
  of the lower-cased tenant domain, never the literal (SR-8). Every command
  (`lookup`, `render`, `list`, `status`, `explain`, `record`, ...) then exits
  `6` and prints nothing from the store when the runtime tenant differs or is
  unset, so tenant A's verified solutions never render in tenant B's case. A
  store with no binding (created before this rule, or only written with
  `AEGION_DOMAIN` unset) carries no evidence of whose it is: it stays readable
  and its first write under a tenant binds it. Same rule as the memory store.
  Pinned by `scripts/untrusted/wrong-customer.test.js` C6, C7.
- **Writes are serialized** by a directory lock: a second writer is refused with
  exit 5 and leaves no partial case; reads never need the lock; parallel writers
  never corrupt the index (R13, R14).

## Three keys, checked in order — none of them semantic

| Key | How it is computed | When it hits |
|---|---|---|
| **exact** | `sha256(normalize(ticket))` — lower-case, punctuation and whitespace collapsed | the same ticket, however it is capitalized or punctuated (R3) |
| **alias** | an operator-registered second exact key for a known equivalent phrasing (`alias --case … --ticket …`) | that phrasing, exactly (R3) |
| **shape** | `sha256("shape.v2|" + objectClass + "|" + shapeOf(ticket))` — the SAME words with the identity literal (a UPN/email, or `[UPN]` / `[USER@DOMAIN.COM]` / `[MANAGER_UPN]` / `[USER_UPN]` / `[GUEST_UPN]` / `[EMAIL]`) replaced by one slot token; the slot COUNT is part of the shape | only when the stored case opted in (`verify … --identity-variants`), only when the shape carries **exactly one** slot (two principals could swap roles), only when both tickets are **pure ASCII** (a homoglyph or zero-width character could hide a risk word from the guard), only when BOTH the stored ticket and the lookup ticket are floor-clean under `scripts/tier/tier-guard.js`, and only when both sides are bound to the **same object class** (below) (R10, R11, R15) |

### Object class — what kind of principal the slot names

A member user's procedure is not a guest's (B2B invitation), a shared mailbox's,
or a distribution group's, even when the sentence is word-for-word the same. So a
shape hit also requires the object class of the slot to be **established on both
sides and equal**. Classes: `member-user` · `guest` · `shared-mailbox` ·
`distribution-group` · `m365-group` · `resource-mailbox` · `service-account`.

| Side | How the class is established | Anchor recorded |
|---|---|---|
| Stored case (at `verify --identity-variants`) | from the dictionary token in the ticket — `[UPN]` / `[USER@DOMAIN.COM]` / `[MANAGER_UPN]` / `[USER_UPN]` → `member-user`, `[GUEST_UPN]` → `guest`; a raw literal or `[EMAIL]` has no class and the verifier must pass `--object-class <class>` or the opt-in is refused | `placeholder` / `asserted` |
| Lookup ticket | a dictionary token → its class; a literal containing Microsoft's guest UPN marker (`…#EXT#@…`) → `guest`; any other raw literal → **unknown → MISS**, unless the caller passes `--object-class <class>` | `placeholder` / `ext-marker` / `asserted` |

An assertion never overrides a deterministic anchor, on any path: `--object-class
member-user` on a `#EXT#` literal (or `guest` on a `[UPN]` ticket) is refused as
a contradiction before exact, alias, or shape keys are consulted. Nothing here
infers a class from a domain, a local part, or a word list — the CLI records
`anchor: "asserted"` on the hit so the rendered answer can say who vouched for the
class. The shape index is keyed per class (`shape.v2|<class>|<shape>`), so a
member-user case and a guest case with the same wording coexist and are told
apart by class; within one class a shape has exactly one owner. Aliases are
operator-explicit second keys, but they cannot bridge a risk floor or an object
class either: `alias` refuses a phrasing whose tier-guard floor differs from the
case's, or whose slot class is established on both sides and differs (a slot-less
or `[EMAIL]` phrasing carries no class and is not refused on that ground). Doctrine for the lead (`docs/harness.md`):
pass `--object-class` only when the operator's own words state the class ("our
guest contractor", "the shared mailbox"); reading is allowed, inference is not,
and unknown routes adaptive.

`explain --ticket "…"` prints the normalized text, both keys, the shape, the slot
count, the guard's floor/triggers, and which layers would be consulted.

### Why "similar tickets" stops here

The mission for V2 was to recognize more genuinely equivalent recurring tickets
without an LLM in the fast path, and to prove the mechanism cannot serve the
wrong procedure. Adversarial pairs are pinned in `scripts/eval/ms-tickets.json`
and re-checked by R12 and the ticket eval:

| Pair | Why it must miss | What blocks it |
|---|---|---|
| "new phone, reset MFA" vs "new phone, but we suspect the account was compromised" | routine re-registration vs incident containment | different words → different keys; the compromise wording floors to T3, so shape is never consulted |
| "license didn't apply" vs "remove their license" | provisioning vs destructive removal | different words; removal floors (SR-2) |
| "Outlook keeps asking for the password" vs "disable the account, it's compromised" | credential loop vs containment | different words; disable floors |
| "device shows Not compliant" vs "wipe the device" | triage vs wipe | different words; wipe floors |
| "reset [UPN]'s password" vs "reset passwords for all users" | one object vs mass | different words; mass floors |
| one user vs two users, same sentence | blast radius | slot count differs → different shape (R11) |

What shape matching deliberately does **not** do: names (no deterministic way to
tell a real name from a word), device names, numbers (a count is blast radius),
synonyms, stop-word stripping, stemming, or any distance metric. A ticket with
one changed word is a different ticket (R11). Two identity slots cannot opt in at
all — "give A access to B's calendar" and the same sentence with A and B swapped
would share a shape, so the roles could invert (R11). Tickets containing
non-ASCII letters cannot opt in or match: a confusable character ("wıpe" with a
dotless ı) could hide a risk word from the guard, so such tickets replay on exact
keys and aliases only, and the guard itself folds Latin/Cyrillic/Greek
confusables before matching (R11, tier suite). The remaining gap — the same ask
in different words — stays a MISS by design; the operator can register an alias
after the resolution is verified. Safety beats hit rate.

**Residual risk, stated plainly:** with object-class binding, a case verified
for `[UPN]` can no longer render for a guest, a shared mailbox, or a group — a
raw literal of unknown class is a MISS, a `#EXT#` guest is a MISS, a token or
assertion of another class is a MISS (R15). What remains is the `asserted`
anchor itself: if a caller passes `--object-class member-user` for a literal
that is really a shared mailbox, the CLI cannot know. That is a caller
responsibility, not an inference the engine makes, it is recorded on the hit,
and it is bounded by per-case opt-in, the risk floor on both sides, and the
advisory-only boundary. The ledger (`docs/evidence/claim-ledger.md`) therefore
rates the deterministic anchors PROVEN and the asserted path as exactly that.

## The honest token boundary

Measured, not asserted (R4 proves it statically on the module graph and at run
time under a tripwire that throws on any http/https/net/tls/dns/child_process/
worker/fetch call):

| Path | Ticket-solving model calls | Platform overhead |
|---|---|---|
| `node scripts/replay/replay-cli.js lookup/render` run directly (terminal, script, scheduled job) | **0** | **0** — no model anywhere in the process |
| `/onboard` (or any slash command / plain ticket) inside Claude Code | **0 on CACHE_HIT** — the model executes the lookup, then emits the stored solution verbatim; no re-derivation, no workers, no loops, no graph | 1 conversation turn — Claude Code necessarily sends the request through the model. This is platform overhead, not ticket reasoning, and it is a behavioral contract (`CLAUDE.md` §Response Format), not something this suite can measure |

If zero total tokens matter, use the CLI directly — that is the supported,
tested, truly model-free path.

## Store & privacy boundary

Store: `memory/replay/` (git-ignored wholesale with the rest of `memory/`).
Public releases ship the **engine, the suite, and synthetic fixtures**
(`fixtures/onboard-demo.md`, `fixtures/shared-mailbox-demo.md`) — never real
cases. Enforced by R8 + `scripts/harness/release-boundary-check.js`. A V1 store
(`index.json` without `shapes`) is read as-is; shape keys appear only when a
case opts in.
