/**
 * Persistence for the autonomous lab: campaigns, experiments, and notebook.
 *
 * Kept separate from queries.ts to keep the discovery-engine and lab concerns
 * readable. All of these are optional — the simulation engines and the scientist
 * agent run fine in-memory; persistence is what makes a campaign resumable and
 * shareable.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from './index';
import {
  type NewCampaign,
  type NewExperiment,
  type NewNotebookEntry,
  campaigns,
  experiments,
  notebookEntries,
} from './schema';

/* ─── Campaigns ──────────────────────────────────────────────────────── */

export async function createCampaign(input: NewCampaign) {
  const [row] = await db.insert(campaigns).values(input).returning();
  return row;
}

export async function updateCampaign(id: string, patch: Partial<NewCampaign>) {
  const [row] = await db.update(campaigns).set(patch).where(eq(campaigns.id, id)).returning();
  return row;
}

export async function campaignById(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row;
}

export async function recentCampaigns(limit = 50) {
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(limit);
}

/* ─── Experiments ────────────────────────────────────────────────────── */

export async function recordExperiment(input: NewExperiment) {
  const [row] = await db.insert(experiments).values(input).returning();
  return row;
}

export async function experimentsForCampaign(campaignId: string, limit = 500) {
  return db
    .select()
    .from(experiments)
    .where(eq(experiments.campaignId, campaignId))
    .orderBy(desc(experiments.score))
    .limit(limit);
}

/** Dedupe helper: has this exact engine+params run already? */
export async function experimentByInputHash(campaignId: string, inputHash: string) {
  const [row] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.campaignId, campaignId), eq(experiments.inputHash, inputHash)))
    .limit(1);
  return row;
}

/* ─── Notebook ───────────────────────────────────────────────────────── */

export async function appendNotebook(input: NewNotebookEntry) {
  const [row] = await db.insert(notebookEntries).values(input).returning();
  return row;
}

export async function notebookForCampaign(campaignId: string) {
  return db
    .select()
    .from(notebookEntries)
    .where(eq(notebookEntries.campaignId, campaignId))
    .orderBy(notebookEntries.seq);
}
