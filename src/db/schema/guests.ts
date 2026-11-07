import { pgTable, text } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export const guests = pgTable("guests", {
  id: id(),
  name: text("name").notNull(),
  instagram: text("instagram"),
  contactNote: text("contact_note"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});
