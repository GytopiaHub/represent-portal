import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const buttonCounts = pgTable("button_counts", {
  color: text("color").primaryKey(), // "red" | "blue" | "green"
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
