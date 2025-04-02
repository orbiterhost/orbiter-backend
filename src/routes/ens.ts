import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { verifyENSOwnership } from "../utils/ens/verify";
import { updateEnsSite, getEnsBySite, getSiteByENS, updateResolverSet } from "../utils/db/ens";
import { getUserSession } from "../middleware/auth";
import { createPublicClient, http, isAddressEqual } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/verify", async (c) => {
  try {

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { ensName, message, signature, address, siteId } = await c.req.json();

    const isValid = await verifyENSOwnership(c, {
      ensName,
      message,
      signature,
      address
    });

    if (!isValid) {
      return c.json({
        verified: false,
        message: "ENS ownership verification failed"
      }, 400);
    }

    await updateEnsSite(c, siteId, ensName);

    return c.json({
      verified: true,
      message: "ENS ownership verified successfully"
    }, 200);

  } catch (error) {
    console.error(error);
    return c.json({
      verified: false,
      message: "Server error during verification"
    }, 500);
  }
});

app.put("/verify", async (c) => {
  try {

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { ensName, siteId } = await c.req.json();

    await updateEnsSite(c, siteId, ensName);

    return c.json({
      message: "ENS Updated"
    }, 200);

  } catch (error) {
    console.error(error);
    return c.json({
      verified: false,
      message: "Server error during verification"
    }, 500);
  }
});

app.get("/verify/:siteId", async (c) => {
  try {
    const { siteId } = c.req.param()

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const data = await getEnsBySite(c, siteId)

    if (!data.ens) {
      return c.json({
        verified: false,
        message: "ENS Not Set"
      }, 400);
    }

    if (data.ens) {
      return c.json({
        verified: true,
        message: "ENS Set",
        ens: data.ens
      }, 200);
    }

  } catch (error) {
    console.error(error);
    return c.json({
      verified: false,
      message: "Server error during verification"
    }, 500);
  }
});


app.get("/resolver/:ens", async (c) => {
  try {
    const { ens } = c.req.param()

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const data = await getSiteByENS(c, ens)

    if (!data.id) {
      return c.json({
        resolverSet: false,
        message: "No site for ENS"
      }, 400);
    }

    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(c.env.ALCHEMY_URL),
    })
    const resolverAddress = await publicClient.getEnsResolver({
      name: normalize(ens),
    })

    console.log("Current Resolver: ", resolverAddress)
    console.log("Orbiter Resolver: ", c.env.RESOLVER_ADDRESS)

    const match = isAddressEqual(resolverAddress, c.env.RESOLVER_ADDRESS)

    console.log("Match Status: ", match)

    if (match) {
      await updateResolverSet(c, data.id, true)
      return c.json({
        resolverSet: true,
        message: "Resovler Set",
      }, 200);
    } else {
      await updateResolverSet(c, data.id, false)
      return c.json({
        resolverSet: false,
        message: "Resovler Not Set",
      }, 400);

    }

  } catch (error) {
    console.error(error);
    return c.json({
      verified: false,
      message: "Server error during verification"
    }, 500);
  }
});

export default app;
