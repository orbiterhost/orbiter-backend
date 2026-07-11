import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, Membership } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { createOrganizationAndMembership } from "../utils/db/organizations";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/", async (c: Context) => {
  try {
    //  ── SIGN UPS DISABLED (SERVICE SHUTDOWN) ──────────────────────────────
    //  Orbiter is shutting down — no new accounts/organizations.
    //  Blocks onboarding so a new Supabase user cannot reach a usable account.
    //  TO RE-ENABLE: comment out this block.
    return c.json(
      { message: "Orbiter is shutting down. New sign ups are disabled." },
      403
    );
    //  ──────────────────────────────────────────────────────────────────────

    const { orgName } = await c.req.json();

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    await createOrganizationAndMembership(c, orgName, user?.id);

    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
