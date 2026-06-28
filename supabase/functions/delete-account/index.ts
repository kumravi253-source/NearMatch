// Self-service account deletion.
//
// A user can only ever delete the account their own JWT belongs to —
// the target id comes from ctx.userClaims, never from the request
// body, so there's no way to pass someone else's id in. Deleting the
// auth.users row cascades through every foreign key in the schema
// (profiles, swipes, matches, messages, blocks, reports,
// legal_attestations, age_verifications), so this one call fully
// removes the account and everything tied to it.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "not authenticated" }, { status: 401 });
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Failed to delete account", error);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }

    return Response.json({ deleted: true });
  }),
};
