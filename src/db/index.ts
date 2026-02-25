import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from "@libsql/client";
import { eq, and } from "drizzle-orm";
import { playersTable, scoresTable, horsesTable, type SelectScoreWithRelations } from './schema';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_TOKEN!,
});
const db = drizzle(client, { schema });

export async function getScoresByDayNumber(dayNumber: number): Promise<SelectScoreWithRelations[]> {
  try {
    return await db.query.scoresTable.findMany({
      where: eq(scoresTable.dayNumber, dayNumber), with: {
        player: true
      }
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function createHorse(dayNumber: number, optimalScore: number): Promise<boolean> {
  try {
    await db.insert(horsesTable).values({ dayNumber, optimalScore }).onConflictDoNothing();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function createPlayer(discordId: string, discordName: string): Promise<boolean> {
  try {
    await db.insert(playersTable).values({ discordId, discordName }).onConflictDoNothing();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function createScore(discordId: string, dayNumber: number, score: number, percentage: number, isWin: number = 0, isTie: number = 0): Promise<SelectScoreWithRelations | undefined> {
  try {
    const result = await db.insert(scoresTable).values({ discordId, dayNumber, score, percentage, isWin, isTie }).onConflictDoNothing().returning();
    if (result.length === 0) {
      return undefined;
    }
    const scoreResult = await db.query.scoresTable.findFirst({
      where: and(eq(scoresTable.dayNumber, dayNumber), eq(scoresTable.discordId, discordId)), with: {
        player: true
      }
    });
    return scoreResult;
  } catch (error) {
    console.error(error);
    return;
  }
}