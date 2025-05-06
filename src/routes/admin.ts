import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { adminAccess } from "../middleware/auth";
import {
  addCidToBadContentList,
  banUserFromAuth,
  getDailyUsers,
  getDailyVersions,
  getOnboardingDataByDateRange,
  getSiteCount,
  getSiteDeploymentSources,
  getUserCount,
  getUserMetadata,
  removeUserBan,
} from "../utils/db/admin";
import { calculateMRR, getActiveSubscriptions } from "../utils/stripe";
import { getWalletBalance } from "../utils/viem";
import { deleteSubdomain, purgeCache } from "../utils/subdomains";
import { blockUser } from "../utils/db/users";
import { slowEquals } from "../utils/security";
import { getAllSites, getSiteById } from "../utils/db/sites";

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

app.get("/onboarding_data", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const startDate = c.req.param("startDate")
    const endDate = c.req.param("endDate");

    const today = new Date();
    //  Default to 30 days ago
    const thirtyDaysAgo = new Date(today);

    thirtyDaysAgo.setDate(today.getDate() - 30);
    let start = thirtyDaysAgo.toISOString();
    let end = new Date().toISOString();
    if(startDate) {
      start = new Date(startDate).toISOString();
    }

    if(endDate) {
      end = new Date(endDate).toISOString();
    }

    const data = await getOnboardingDataByDateRange(c, start, end);

    return c.json({ data: data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/deployment_source", async (c) => {
  try {
    //	Check authentication via token and supabase
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const startDate = c.req.param("startDate")
    const endDate = c.req.param("endDate");

    const today = new Date();
    //  Default to 30 days ago
    const thirtyDaysAgo = new Date(today);

    thirtyDaysAgo.setDate(today.getDate() - 30);
    let start = thirtyDaysAgo.toISOString();
    let end = new Date().toISOString();
    if(startDate) {
      start = new Date(startDate).toISOString();
    }

    if(endDate) {
      end = new Date(endDate).toISOString();
    }

    const data = await getSiteDeploymentSources(c, start, end);

    return c.json({ data: data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/block_site", async (c) => {
  try {
    const { subdomain } = await c.req.json();
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    if (subdomain.includes("https") || subdomain.includes("orbiter.website")) {
      return c.json({ message: "Please only use the subdomain (mysite instead of mysite.orbiter.website)" }, 400)
    }

    const domain = `https://${subdomain}.orbiter.website`;
    await deleteSubdomain(c.env, subdomain);

    await purgeCache(c, domain);

    await addCidToBadContentList(c, domain.split("https://")[1]);

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.post("/ban_user", async (c) => {
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { email } = await c.req.json();
    await banUserFromAuth(c, email);
    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500)
  }
});

app.put("/remove_ban", async (c) => {
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { email } = await c.req.json();

    await removeUserBan(c, email);

    return c.json({ message: "Success" }, 500);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/user_ban/:email", async(c) => {
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const email = c.req.param("email");

    const data = await getUserMetadata(c, email);
    return c.json({ data }, 200);
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
        const siteKey = site.domain.split('.')[0];
        await c.env.SITE_CONTRACT.put(siteKey.toLowerCase(), site.site_contract);
      }
    }

    return c.text("Done!");
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.post("/backfill-site-contract/:id", async (c) => {
  const siteId = c.req.param('id')
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const site = await getSiteById(c, siteId)

    await c.env.CONTRACT_QUEUE.send({
      type: 'create_contract',
      cid: site.cid,
      siteId: site.id,
      retryCount: 3
    });

    return c.text("Done!");
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

app.post("/backfill-site-contract-cid/:id", async (c) => {
  const siteId = c.req.param('id')
  try {
    const { isAuthenticated, user } = await adminAccess(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    if (!siteId){
      return c.json({ message: "Missing site ID" }, 400);
    }

    const site = await getSiteById(c, siteId)

    await c.env.CONTRACT_QUEUE.send({
      type: 'update_contract',
      cid: site.cid,
      contractAddress: site.site_contract as `0x${string}`,
      siteId: site.id,
    });

    return c.text("Done!");
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})


export default app;
