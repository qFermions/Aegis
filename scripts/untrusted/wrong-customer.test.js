// wrong-customer.test.js: a case or a store that mixes two tenants.
//
// Contract: REVIEW.md "Project failure" (customer data from one tenant must
// never be reachable from another tenant's case), SR-1 and SR-8 in
// modules/security/security-doctrine.md, modules/security/placeholder-dictionary.md
// (the [@Aegion_*] namespace is this deployment's org; the tenant domain is
// env-var only, AEGION_DOMAIN).
//
// Model: one Aegis deployment serves one tenant. Its org tokens are the
// [@Aegion_*] family and its tenant identity at runtime is AEGION_DOMAIN.
// Every case in a deployment is that tenant's case, so an org-namespace token
// of any OTHER namespace ([@<Name>_<UPPER_SUFFIX>], for example a second
// org's [@Otherorg_DOMAIN]) inside a case means the case mixes two tenants.
//
// EXPECTED DECISION
// A case or a store that mixes two tenants fails closed: nothing is created,
// stored, retrieved or rendered, and no text belonging to the other tenant is
// printed. Concretely (sandbox stores and run dirs only; tenant domains are
// RFC example domains set through AEGION_DOMAIN in the child environment):
//
// 1. scripts/graph/graph-cli.js new with a ticket carrying [@Aegion_DOMAIN]
//    and [@Otherorg_DOMAIN], and with a ticket carrying only
//    [@Otherorg_DOMAIN].
//    MUST: exit 3 and create no run directory.
//    Control: a ticket with [@Aegion_*] tokens, [UPN], [GUEST_UPN] and a B2B
//    guest #EXT# literal at an example domain MUST still exit 0. A guest from
//    another directory is one customer's case, not a second customer.
//
// 2. graph-cli.js submit of a SPECIALIST artifact whose evidence pulls in
//    [@Otherorg_DOMAIN].
//    MUST: exit 3; node stays "SPECIALIST"; none of that evidence lands in
//    state.
//
// 3. scripts/memory/memory-cli.js propose with an [@Otherorg_*] token in
//    summary or detail.
//    MUST: exit 3 and write no record.
//
// 4. scripts/replay/replay-cli.js record with an [@Otherorg_*] token in the
//    ticket or in the solution.
//    MUST: exit 4 and create no case.
//
// 5. A memory store first written under AEGION_DOMAIN=<tenant A>.
//    MUST: under tenant A, retrieve returns the record. Under tenant B, and
//    with AEGION_DOMAIN unset, retrieve, show, list and propose exit 6 and
//    print none of tenant A's stored text. No file in the store contains the
//    tenant A literal (the binding is a fingerprint, SR-8).
//
// 6. A replay store first written under tenant A.
//    MUST: under tenant A, lookup is CACHE_HIT. Under tenant B, and with
//    AEGION_DOMAIN unset, lookup, render, list, status, explain and record
//    exit 6 and print none of the stored solution.
//
// 7. Backward compatibility. A store with no tenant binding (created before
//    this rule existed, or only ever written with AEGION_DOMAIN unset) holds
//    no evidence of whose it is.
//    MUST: it stays readable as before; its first write under a tenant binds
//    it to that tenant, after which rules 5 and 6 apply.
