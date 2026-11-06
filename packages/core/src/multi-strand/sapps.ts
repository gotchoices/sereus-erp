/**
 * Minimal sApps for the multi-strand experiment: stand-ins for the catalog, operations,
 * Bonum and vendor-link schemas. Each strand carries exactly one of these; StrandDatabase
 * wraps the DDL as `declare schema App { … }`, so every strand's tables are `App.*`.
 */
import type { SAppConfig } from '@serfab/cadre-core';

function sApp(id: string, schema: string): SAppConfig {
  return { id, version: '0.0.1', schema, signature: '', latencyHint: 'interactive' } as SAppConfig;
}

export const CATALOG = sApp('test.wyatt.catalog', `
table Part (
  Id text primary key,
  Pnum text not null,
  Name text not null,
  StdCost integer not null
);`);

export const OPS = sApp('test.wyatt.ops', `
table PoLine (
  Id text primary key,
  PoNumber text not null,
  VendorId text not null,
  PartId text not null,
  Qty integer not null,
  Received integer not null default 0
);
table Posting (
  Id text primary key,
  Kind text not null,
  SourceId text not null,
  Amount integer not null,
  Status text not null default 'pending',
  TargetId text null
);`);

/** Stand-in for Bonum: a transaction keyed by the posting that created it. */
export const BOOKS = sApp('test.bonum', `
table Txn (
  Id text primary key,
  PostingId text not null unique,
  Memo text not null,
  Amount integer not null
);`);

export const VENDOR = sApp('test.wyatt.vendor', `
table OpenPoLine (
  Id text primary key,
  PoNumber text not null,
  Pnum text not null,
  Qty integer not null
);
table Bid (
  Id text primary key,
  Pnum text not null,
  Qty integer not null,
  Price integer not null
);`);
