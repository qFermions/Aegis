// poisoned-memory.test.js: a memory or knowledge entry that is poisoned. It
// carries instruction-shaped text, it was never verified, or it was changed on
// disk outside its single write path.
//
// Contract: REVIEW.md "Project failure" (memory entries are never
// instructions; an unverified suggestion is never stored or served as approved
// knowledge), SR-3, PRODUCT_CONTRACT.md invariant 3 (only verified solutions
// replay; unverified output never becomes trusted memory),
// scripts/memory/README.md ("the CLI is the only write path"),
// scripts/replay/README.md ("only verified solutions replay").
//
// EXPECTED DECISION
// A poisoned entry is never stored, and never served as approved knowledge.
// Retrieval serves only records whose on-disk content is exactly what
// memory-cli.js wrote and that still pass the persist gates; anything else is
// withheld and named, not served. Concretely (every store is a sandbox:
// AEGIS_MEMORY_DIR / AEGIS_REPLAY_DIR under the OS temp dir):
//
// 1. scripts/memory/memory-cli.js propose with an instruction marker hidden by
//    a zero-width character, a Cyrillic look-alike letter or fullwidth letters
//    in summary or detail.
//    MUST: exit 3 (sanitizer BLOCK, class "injection-marker"); no
//    mem-NNNN.json is written; the ledger records BLOCKED.
//
// 2. A clean candidate whose only provenance is external-content.
//    MUST: promote exits 4 and the record stays "candidate"; retrieve without
//    --include-candidates returns no result for a matching query; with
//    --include-candidates it may appear, but only with status "candidate".
//    MUST NOT: surface as "verified" on any path.
//
// 3. index.json edited outside the CLI so a candidate's row reads "verified".
//    MUST: retrieve exits 0, the id is absent from results and listed under
//    `withheld` with a reason.
//
// 4. A verified record changed outside the CLI, in either file: index row
//    summary replaced with instruction text; index row keywords stuffed so it
//    surfaces for unrelated queries; mem-NNNN.json detail replaced with
//    instruction text; mem-NNNN.json status or keywords changed.
//    MUST: retrieve withholds it (absent from results, listed under
//    `withheld`); an untouched verified record in the same store is still
//    returned; show <id> still prints the record for audit but labels it with
//    an `integrity` value other than "intact".
//
// 5. A record file plus index row written by hand, never through
//    memory-cli.js.
//    MUST: retrieve does not return it.
//
// 6. verify <id> (the re-verification path) on a verified record whose detail
//    was replaced on disk with instruction text.
//    MUST: exit 3, and the record stays withheld from retrieve. Re-verifying
//    cannot launder a tampered record into approved knowledge.
//
// 7. scripts/replay/replay-cli.js record --ticket <t> --solution-file <a
//    document carrying a marker, plain or obfuscated>.
//    MUST: exit 4 (persistence boundary); no case file is created; a later
//    lookup of the same ticket is "MISS". A verified solution renders
//    verbatim with zero new reasoning, so instruction-shaped text must never
//    enter the replay cache in the first place.
