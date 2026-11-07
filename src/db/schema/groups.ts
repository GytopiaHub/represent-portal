import { pgTable, text, integer, boolean, uuid, index } from "drizzle-orm/pg-core";
import { userRef } from "./auth";
import { id, timestamps } from "./columns";
import { groupType, requestStatus } from "./enums";

// ---------------------------------------------------------------------------
// Idol groups
// ---------------------------------------------------------------------------

export const idolGroups = pgTable("idol_groups", {
  id: id(),
  name: text("name").notNull(),
  nameKr: text("name_kr"),
  groupType: groupType("group_type").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const idolMembers = pgTable(
  "idol_members",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => idolGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    romanisation: text("romanisation"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("idol_members_group_idx").on(t.groupId)],
);

export const groupRequests = pgTable("group_requests", {
  id: id(),
  requestedBy: userRef("requested_by").notNull(),
  name: text("name").notNull(),
  note: text("note"),
  status: requestStatus("status").notNull().default("open"),
  ...timestamps,
});
