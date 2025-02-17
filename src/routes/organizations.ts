import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, Membership } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { createOrganizationAndMembership } from "../utils/db/organizations";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/", async (c: Context) => {
  try {
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
