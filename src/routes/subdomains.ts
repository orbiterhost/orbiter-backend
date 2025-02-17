import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { checkSubdomainDNSRecord, validateSubdomain } from "../utils/subdomains";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/:name", async (c) => {
  try {
    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const name = c.req.param("name");

    const { isValid, errors } = validateSubdomain(name);

    if (!isValid) {
      return c.json({ message: errors.join(", ") }, 400);
    }

    const { exists } = await checkSubdomainDNSRecord(c.env, name);

    return c.json(
      {
        data: {
          subdomainExists: exists,
        },
      },
      200
    );
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
