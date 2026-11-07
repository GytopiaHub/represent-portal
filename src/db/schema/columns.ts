import { timestamp, uuid } from "drizzle-orm/pg-core";

// Columns every app table shares (SRS §5).

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
};
export const id = () => uuid("id").primaryKey().defaultRandom();
