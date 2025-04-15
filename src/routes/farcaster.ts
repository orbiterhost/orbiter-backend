import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { ethers } from "ethers";
import { getSiteById } from "../utils/db/sites";
import { canModifySite } from "../middleware/accessControls";
import { FarcasterJFS } from "../utils/farcaster-jfs";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/account_association/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);
    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");

    // Verify ownership of the site
    let siteInfo: any;
    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user.id);
    }

    if (!siteInfo || !siteInfo?.id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    // Ensure this is an orbiter.website domain
    if (!siteInfo.domain.endsWith('.orbiter.website')) {
      return c.json({ message: "Farcaster signing is only available for orbiter.website domains" }, 400);
    }

    // Get domain from site info
    const domain = siteInfo.domain;

    // Get Farcaster wallet and FID from environment
    const FID = parseInt(c.env.FARCASTER_FID || "0", 10);
    if (!FID) {
      return c.json({ message: "Server configuration error" }, 500);
    }

    const signer = new ethers.Wallet(c.env.FARCASTER_MNEMONIC as string);
    const custodyAddress = await signer.getAddress();

    // Use the FarcasterJFS utility to create the signed association
    const accountAssociation = await FarcasterJFS.sign(
      FID,
      custodyAddress,
      { domain: domain },
      signer
    );

    // Return the account association object
    return c.json({ accountAssociation }, 200);

  } catch (error) {
    console.error(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
