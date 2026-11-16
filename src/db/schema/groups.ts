import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, unique } from "drizzle-orm/pg-core";

// K-pop groups the crew covers, used to pre-fill the member allocation list
// when a cover starts. Public artist reference data only (SRS SEC-4).
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  // Stable key for the seed and for URLs, so the display name can change.
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Official line order, which is the order the allocation list pre-fills in.
    position: integer("position").notNull(),
  },
  (t) => [unique().on(t.groupId, t.name), unique().on(t.groupId, t.position)],
);

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
}));
