import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { adminAccess } from "../middleware/auth";
import {
  getDailyUsers,
  getDailyVersions,
  getSiteCount,
  getUserCount,
} from "../utils/db/admin";
import { calculateMRR, getActiveSubscriptions } from "../utils/stripe";
import { getWalletBalance } from "../utils/viem";
import { deleteSubdomain, purgeCache } from "../utils/subdomains";
import { blockUser } from "../utils/db/users";
import { slowEquals } from "../utils/security";
import { getAllSites } from "../utils/db/sites";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/kv", async (c) => {
  try {
    const token = c.req.header("X-Orbiter-Admin");
    if (!token || !slowEquals(token, c.env.NGINX_SERVER_TOKEN)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { namespace, key, value } = await c.req.json();

    //	@ts-ignore
    await c.env[namespace].put(key, value);
    return c.json({ message: "KV Updated!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/sites", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteCount = await getSiteCount(c);

    return c.json({ data: { count: siteCount || 0 } }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/users", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const userCount = await getUserCount(c);

    return c.json({ data: { count: userCount || 0 } }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/subscriptions", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const subscriptions = await getActiveSubscriptions(c);

    return c.json({ data: { count: subscriptions?.length || 0 } }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/wallet_balance", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const data = await getWalletBalance(c);

    return c.json(
      { data: { balance: { eth: parseFloat(data.eth) || 0, usd: data.usd } } },
      200
    );
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/site_updates_by_day", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const data = await getDailyVersions(c);
    return c.json({ data: data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/users_by_day", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const data = await getDailyUsers(c);

    return c.json({ data: data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/block_site", async (c) => {
  try {
    const { domain } = await c.req.json();
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    if (!domain.includes("https") || !domain.include("orbiter.website")) {
      return c.json({ message: "Please use full domain like: https://somedomain.orbiter.website" }, 400)
    }

    const subdomain = domain.split(".orbiter.website")[0].split("https://")[1];

    await deleteSubdomain(c.env, subdomain);
    await purgeCache(c, domain);

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.get("/mrr", async (c) => {
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const mrr = await calculateMRR(c);
    return c.json({ data: mrr }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.post("/block_user", async (c) => {
  try {
    const { email } = await c.req.json();
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    await blockUser(c, email);

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.post("/backfill-site-contracts", async (c) => {
  try {    
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const sites = await getAllSites(c);
    if(sites) {
      for(const site of sites) {
        await c.env.SITE_CONTRACT.put(site.domain.toLowerCase(), site.site_contract);
      }
    }

    return c.text("Done!");
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

export default app;
