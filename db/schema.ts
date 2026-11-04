import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";

// One row per click. The three tables share the same shape.
function clickTable<const N extends string>(name: N) {
  return pgTable(name, {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  });
}

export const red = clickTable("red");
export const green = clickTable("green");
export const blue = clickTable("blue");

export const clickTables = { red, green, blue };
