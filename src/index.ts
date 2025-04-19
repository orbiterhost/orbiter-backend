import { Context, Hono } from "hono";
import { Bindings } from "./utils/types";
import { cors } from "hono/cors";
import sites from "./routes/sites";
import organizations from "./routes/organizations";
import subdomains from "./routes/subdomains";
import keys from "./routes/keys";
import admin from "./routes/admin";
import billing from "./routes/billing";
import webhooks from "./routes/webhooks";
import analytics from "./routes/analytics";
import members from "./routes/members";
import resolve from "./routes/resolve"
import ens from "./routes/ens";
import farcaster from "./routes/farcaster";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.route("/sites", sites);
app.route("/organizations", organizations);
app.route("/keys", keys);
app.route("/subdomains", subdomains);
app.route("/admin", admin);
app.route("/billing", billing);
app.route("/webhooks", webhooks);
app.route("/members", members);
app.route("/lookup", resolve);
app.route("/ens", ens);
app.route("/analytics", analytics);
app.route("/farcaster", farcaster);

app.get("/health", async (c: Context<{ Bindings: Bindings }>) => {
  return c.json({ status: "orbiting" }, 200);
});

export default app;
