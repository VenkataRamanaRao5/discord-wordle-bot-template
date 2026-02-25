import { relations } from "drizzle-orm";
import { float } from "drizzle-orm/mysql-core";
import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const horsesTable = sqliteTable('horses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dayNumber: integer('day_number').notNull().unique(),
  optimalScore: integer('optimal_score').notNull(),
});

export const playersTable = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull().unique(),
  discordName: text('discord_name').notNull(),
});

export const scoresTable = sqliteTable('scores', {
  discordId: text('discord_id').notNull().references(() => playersTable.discordId),
  dayNumber: integer('day_number').notNull().references(() => horsesTable.dayNumber),
  score: integer('score').notNull().default(1),
  percentage: integer('percentage').notNull().default(1),
  isWin: integer('is_win').default(0),
  isTie: integer('is_tie').default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.discordId, table.dayNumber] })
}));

export const playerScoresRelations = relations(playersTable, ({ many }) => ({
  scores: many(scoresTable)
}));

export const scoresRelations = relations(scoresTable, ({ one }) => ({
  player: one(playersTable, {
    fields: [scoresTable.discordId],
    references: [playersTable.discordId]
  }),
  horse: one(horsesTable, {
    fields: [scoresTable.dayNumber],
    references: [horsesTable.dayNumber]
  })
}));

export const horseRelations = relations(horsesTable, ({ many }) => ({
  scores: many(scoresTable)
}));

export type Inserthorse = typeof horsesTable.$inferInsert;
export type Selecthorse = typeof horsesTable.$inferSelect;

export type InsertPlayer = typeof playersTable.$inferInsert;
export type SelectPlayer = typeof playersTable.$inferSelect;

export type InsertScore = typeof scoresTable.$inferInsert;
export type SelectScore = typeof scoresTable.$inferSelect;
export type SelectScoreWithRelations = SelectScore & { player: SelectPlayer };