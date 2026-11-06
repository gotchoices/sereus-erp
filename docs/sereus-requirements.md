# What WyattERP needs from Sereus

Requirements from WyattERP for the Sereus stack. The findings were checked against the
`ser/sereus` code and the published packages in November 2026 (`@serfab/cadre-core` 1.21,
`@quereus/quereus` 4.25, Optimystic 1.25). Test-backed findings point to
`packages/core/src/multi-strand/`. Paths starting `sereus/` are in `ser/sereus/packages/`
unless noted.

WyattERP runs as several strands: catalog, parties, ops, AP and AR, plus a link strand per
vendor and per shop. It shares the party's cadre with Bonum, whose own strand holds the
books. Each module reads the others and posts to them
([specs/architecture.md](specs/architecture.md) §5–§6).

## 1. What works today

All of these are shown by `multi-strand.test.ts`, which runs real nodes in one process:

* One machine runs strands of **several different sApps** at once, with
  `strandFilter: { mode: 'all' }`. The sApp config is kept per strand
  (`CadreNode.sAppConfigs`, keyed by strand ID).
* Each strand is its own `Database`, with its tables in schema `App`.
* A query on one strand can be exposed in another strand's `Database` as a table-valued
  function. One SQL statement can then join across strands. This works because the function
  reads a *different* `Database`, so it does not wait on the calling statement's exec mutex.
* An outbox posting from one strand to another is idempotent, keyed by a unique posting ID
  in the target. It survived a poster crash and retry.
* A second party joins a closed link strand by invitation. Extracts and bids replicate in
  both directions in under a second on loopback.

## 2. Apps that share a machine

**How it works today:**
* **One node per process and storage directory.** On Node, `FileRawStorage` takes a
  `store.lock`. On mobile, each app has its own LevelDB and key store.
* **No daemon or IPC.** There is no way for two apps to share one node. cadre-host only
  manages separate `cadre-cli` processes.
* **Each app install is a separate machine of the party**, with its own identity, joined to
  the cadre by a machine invitation (`sereus/docs/architecture.md`, around line 900).
* **Within one process, one node can carry any number of sApps**, which is what a
  desktop or server "super-app" needs.

**The hazard: a claim is not checked against the strand's sApp.**
* `Strand.Header` records the founding sApp and can never change.
* A joining `addStrand` applies whatever `sAppConfig` the caller passes, without comparing
  its `id` to the Header's `sAppId`.
* `StrandInstanceManager.attachSApp` only logs a mismatch, and only when a different sApp is
  already attached.

`foreign-claim.test.ts` shows the effect. A second party joins a Bonum strand by invitation
and claims it with the ops schema. The claim is accepted. That party's database for Bonum's
strand has the ops tables and no Bonum tables. The founder is unaffected, at least without
writes from the joiner. The mismatch is silent on both sides.

**Why it matters here.** WyattERP and Bonum on one cadre means two apps that both see
`strand:discovered` for each other's strands. The control `Strand` row carries no sApp ID,
so an app can't tell whose strand it is before claiming it. The RN reference app claims
every discovered strand with the chat schema.

**Requested, in order of importance:**
1. **Refuse a claim whose `sAppConfig.id` differs from `Strand.Header.sAppId`.** Until the
   Header has arrived, run the strand as a replica and attach the app's schema only after
   the Header matches.
2. **Put the sApp ID on the control `Strand` row.** It could be bound into the owner
   signature, or copied from `FormationInvite.sAppId` on the consent path. Discovery can then
   route a strand to the right app without launching it.
3. **Allow several sApp IDs in one filter.** For example
   `StrandFilter { mode: 'sAppIds'; sAppIds: string[] }`, for a super-app.
4. **Register an sApp once per node** (`node.registerSApp(config)`), so the node claims
   matching discovered strands itself. A super-app would register WyattERP's and Bonum's
   signed configs.
5. Optional: a node-level `trustedSchemaAuthors` list. Today a signature only proves the
   schema matches its own `id`. Anyone who holds Bonum's signed schema can claim Bonum
   strands.

**Mobile stays one app per schema:** one node per app, with the kit defaulting the filter to
the app's own sApp ID. With item 1 in place, a phone app also can't put its schema on
another app's strand by mistake.

**WyattERP's position.** Each sApp has one control library: its schema plus whatever rules
live in code, such as `@wyatt/core` and the planned `bonum-core`. Any app that works in a
strand, a super-app included, goes through that strand's library. Rules that can be
expressed in the schema should live there, because only those hold for every app.

## 3. Composing strands into one Database

**Today:** there is one `Database` per strand and no `ATTACH`. The table-valued-function
bridge works, but it reads whole relations, pushes nothing down, and declares column types
by hand.

**Wanted:** one `Database` holding several strands, one schema per strand (`catalog.Part`,
`ops.Move`), so that joins are planned and pushed down. Starting read-only would be enough.

**What blocks it** (from `quereus-plugin-sereus/src/compose-strand.ts` and `app-schema.ts`):
* The vtab defaults are set for the whole database: `setDefaultVtabName`,
  `setDefaultVtabArgs({ networkName })` and `default_network_name`.
* The schema names `Strand` and `App` are fixed.
* Collection URIs are derived from the schema name: `tree://default/<schema>/<table>`.

**The pieces already exist.** Optimystic accepts a `networkName` per table and an explicit
collection URI as the first argument, and Quereus supports several schemas in one
`Database`.

**Smallest change suggested.** Add a `schemaAlias` option that declares a strand's tables
in another `Database` as `<Alias>.<table>`. Each table would still be backed by the
strand's own collection (`tree://default/App/<table>` on `strand-<id>`), so storage is
unchanged.
* **Start read-only:** catalog hydrate, the offline queue and the transaction bridge are
  each tied to one `Database`.
* **Writes need a transaction per strand:** Optimystic does not commit atomically across
  transactors (`txn-bridge.ts`). WyattERP's postings already assume this.

## 4. Cross-strand views (later)

This would be a read-only view in one strand, defined over another strand's data. Nodes that
hold both strands compute it, and other members receive the results. The use cases:
* AP matching invoices against ops receipts;
* AR billing from shipments;
* a vendor seeing its own open PO lines;
* a shop seeing the part definitions for its runs.

Until then, WyattERP publishes extracts into link strands as an explicit step. The
multi-strand test does this with one statement over the bridge.

## 5. Tickets touched

None in `ser/sereus/tickets` covers multi-app nodes, super-apps, or checking a claim against
the Header. These are related:
* `backlog/feat-party-private-app-state.md`
* `blocked/decide-party-private-labels-and-app-state.md`
* `blocked/decide-app-link-join-carries-ownership.md`
* `backlog/bug-refused-app-schema-kept-for-strand-resume.md`
* `backlog/feat-cadre-host-hosted-node-strand-view.md`
