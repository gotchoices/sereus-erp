/**
 * Bring a second node into a closed strand by invitation, the way ser/chat mints and redeems
 * one (packages/core/src/sereus/model.ts). Returns the joiner's database for the strand once
 * it can write.
 */
import type { SAppConfig, StrandRow } from '@serfab/cadre-core';
import type { Database } from '@quereus/quereus';
import type { TestNode } from './node-host.js';

export async function joinStrand(founder: TestNode, joiner: TestNode, strandId: string, sAppConfig: SAppConfig): Promise<Database> {
  const invitation = await founder.node.createOpenInvitation(sAppConfig.id, 10 * 60_000);
  await founder.node.publishFormationInvite(invitation.token, sAppConfig.id, {
    expiresAtMs: invitation.expiration.getTime(), strandId, totalUses: 1,
  });
  const token = founder.node.encodeInvitation(invitation);
  const formed = await joiner.node.formStrand(joiner.node.decodeInvitation(token), {});
  if (formed.strandId !== strandId) throw new Error(`joined ${formed.strandId}, expected ${strandId}`);
  const row = {
    Id: formed.strandId, MemberPrivateKey: formed.memberPrivateKey ?? null,
    Type: formed.memberPrivateKey ? 'c' : 'o', FounderOwnerKey: null, FounderPeerId: null,
  } as unknown as StrandRow;
  try {
    const instance = await joiner.node.addStrand({ strandRow: row, sAppConfig, founder: false });
    return instance.database!.getDatabase();
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'StrandAwaitingFirstSyncError') throw err;
    return (await joiner.node.whenStrandWritable(strandId, { timeoutMs: 240_000 })).database!.getDatabase();
  }
}
