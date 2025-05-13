import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, SiteVersionLookupType } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import {
  canAccessVersions,
  canAddCustomDomain,
  canCreateSite,
  canModifySite,
} from "../middleware/accessControls";
import {
  checkSubdomainDNSRecord,
  createSubdomain,
  deleteSubdomain,
  purgeCache,
  validateSubdomain,
} from "../utils/subdomains";
import { createContract, writeCID } from "../utils/viem";
import { getRedirectsFile, getSiteData } from "../utils/pinata";
import { detectMaliciousContent } from "../utils/security";
import {
  postNewSiteToSlack,
  postUpdatedSiteToSlack,
} from "../utils/notifications";
import {
  issueSSLCertAndProxyCustomDomain,
  removeSSLCertAndProxyForDomain,
  verifyDomainOwnership,
} from "../utils/customDomains";
import {
  getSiteByDomain,
  createOrUpdateSiteMapping,
  deleteSiteFromDbById,
  getSiteById,
  getSiteVersions,
  loadSites,
  addCustomDomainToSiteTable,
  updateDomainVerificationForSite,
  getCustomDomainByName,
} from "../utils/db/sites";
import { getUserById } from "../utils/db/users";
import { parseRedirectsFile } from "../utils/redirects";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/:identifier/versions", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const identifier = c.req.param("identifier");

    const offset = c.req.query("offset");

    const all = c.req.query("all")

    // Helper function to check if string is UUID
    const isUUID = (str: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const lookUpType: SiteVersionLookupType = isUUID(identifier)
      ? { field: "site_id", value: identifier }
      : { field: "domain", value: identifier };

    let siteInfo: any;

    if (user) {
      siteInfo =
        lookUpType.field === "site_id"
          ? await getSiteById(c, lookUpType.value)
          : await getSiteByDomain(c, lookUpType.value);
    } else if (organizationData) {
      siteInfo = await getSiteById(c, identifier);
      if (siteInfo.organization_id !== organizationData?.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    }

    const canAccess = await canAccessVersions(c, siteInfo.organization_id);

    if (!canAccess) {
      return c.json(
        {
          message: "You must upgrade your plan to access this feature",
        },
        403
      );
    }

    const versions = await getSiteVersions(
      c,
      lookUpType,
      all === "true" ? undefined : parseInt(offset || "0", 10)
    );

    //  We will return a nextOffset to help the FE and CLI manage pagination better
    //  If there are fewer then 10 results for versions, we will return null
    return c.json(
      {
        data: versions,
        nextOffset: all === "true" ? null :
          versions.length === 10 ? parseInt(offset || "0", 10) + 10 : null,
      },
      200
    );
  } catch (error) {
    console.error(error);
    return c.json(
      {
        error: {
          code: "internal_server_error",
          message: "An unexpected error occurred",
        },
      },
      500
    );
  }
});
app.get("/", async (c) => {
  try {
    const domain = c.req.query("domain");

    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    let orgId = user ? user.user_metadata.orgId : organizationData.id;

    let userIdToUse = "";

    if (user) {
      userIdToUse = user.id;
    } else {
      userIdToUse = organizationData?.orgOwner || "";
    }

    const sites = await loadSites(c, orgId, userIdToUse, domain);
    console.log(sites);
    return c.json({ data: sites }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

//	Create or update an existing site based on userId
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const source = c.req.header("Source") || "";
    //	The CID comes from the frontend since the FE will be handling the site upload
    const { cid, subdomain } = body;
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user ? user.user_metadata.orgId : organizationData.id;

    //  Need to get plan details to see if _redirects supported
    const plan = (await c.env.SITE_PLANS.get(orgId)) || "free";

    if(plan !== "free") {
      const redirectsFile = await getRedirectsFile(c, cid);
      if(redirectsFile) {
        const redirectsJSON = parseRedirectsFile(redirectsFile as string);
        await c.env.REDIRECTS.put(subdomain.toLowerCase(), JSON.stringify(redirectsJSON));
      }
    }

    if (organizationData && organizationData.id !== orgId) {
      return c.json({ message: "Org ID does not match" }, 401);
    } else if (user) {
      const canCreate = await canCreateSite(c, user.id, orgId);

      if (!canCreate) {
        return c.json(
          { message: "This action would exceed your plan limits" },
          401
        );
      }
    }

    const userIdToUser = user ? user.id : organizationData?.orgOwner;

    const { isValid, errors } = validateSubdomain(subdomain);

    if (!isValid) {
      return c.json({ message: errors.join(", ") }, 400);
    }

    const { exists } = await checkSubdomainDNSRecord(
      c.env,
      subdomain.toLowerCase()
    );

    if (exists) {
      return c.json({ message: "Subdomain already exists" }, 400);
    }

    await c.env.CONTRACT_QUEUE.send({
      type: 'create_contract',
      cid: cid,
      domain: subdomain.toLowerCase(),
      userId: user ? user.id : organizationData?.orgOwner,
      orgId: orgId,
      retryCount: 3
    });

    const html: any = await getSiteData(c, cid);

    //	Check for malicious html
    await detectMaliciousContent(c, html, subdomain.toLowerCase(), cid);

    await createSubdomain(c.env, subdomain.toLowerCase());
    //	Update DB to link subdomain to user
    await createOrUpdateSiteMapping(
      c,
      userIdToUser!,
      orgId,
      subdomain.toLowerCase(),
      cid,
      source
    );
    //	Next we need to map the user's domain to the new CID using Cloudflare KV
    await c.env.ORBITER_SITES.put(subdomain.toLowerCase(), cid);
    await c.env.SITE_TO_ORG.put(subdomain.toLowerCase(), orgId);
    //	@TODO If the user has a custom domain, we must map both the custom domain and default domain to the CID
    const userDetails = await getUserById(c, userIdToUser!);

    await postNewSiteToSlack(c, subdomain, userDetails, cid);

    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.put("/:siteId", async (c) => {
  const source = c.req.header("Source") || "";
  try {
    const siteId = c.req.param("siteId");
    //	The CID comes from the frontend since the FE will be handling the site upload
    const { cid } = await c.req.json();
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    //	Middleware to check if the user has access to modify the site
    let siteInfo: any;
    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user.id);
    }

    if (!cid) {
      return c.json({ message: "cid is required" }, 400);
    }

    const { site_contract, domain, organization_id } = siteInfo;

    const domainPrefix = domain.split(".orbiter.website")[0];

    //  Need to get plan details to see if _redirects supported
    const plan = (await c.env.SITE_PLANS.get(organization_id)) || "free";
    
    if(plan !== "free") {      
      const redirectsFile = await getRedirectsFile(c, cid);
      console.log("Checking for redirects file: ", redirectsFile)
      if(redirectsFile) {
        const redirectsJSON = await parseRedirectsFile(redirectsFile as string);
        console.log("Parsed redirects: ", redirectsJSON);
        await c.env.REDIRECTS.put(domainPrefix.toLowerCase(), JSON.stringify(redirectsJSON));
      }
    }

    await purgeCache(c, siteInfo.domain);

    if (site_contract) {
      await c.env.CONTRACT_QUEUE.send({
        type: 'update_contract',
        cid: cid,
        contractAddress: site_contract as `0x${string}`,
        siteId: siteId,
        userId: user ? user.id : organizationData?.orgOwner,
        orgId: organization_id
      });
    }

    //	Next we need to map the user's domain to the new CID using Cloudflare KV
    await c.env.ORBITER_SITES.put(domainPrefix.toLowerCase(), cid);
    //	If the user has a custom domain, we must map both the custom domain and default domain to the CID
    //	Update DB record for customer's site
    let userForDb = user ? user.id : organizationData?.orgOwner || "";
    await createOrUpdateSiteMapping(
      c,
      userForDb,
      organization_id,
      domainPrefix.toLowerCase(),
      cid,
      source,
      site_contract
    );

    const userDetails = await getUserById(c, userForDb);
    await postUpdatedSiteToSlack(
      c,
      domainPrefix.toLowerCase(),
      userDetails,
      cid
    );
    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.delete("/:siteId", async (c) => {
  try {
    const siteId = c.req.param("siteId");
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    //	Middleware to check if the user has access to modify the site
    let siteInfo: any;

    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user?.id);
    }

    if (!siteInfo || !siteInfo?.id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    //	Delete DNS record from Cloudflare
    await deleteSubdomain(c.env, siteInfo.domain.toLowerCase());

    //	Delete KV mapping
    await c.env.ORBITER_SITES.delete(siteInfo.domain);

    //	Delete custom domain & SSL if applicable
    if (siteInfo.custom_domain) {
      await removeSSLCertAndProxyForDomain(c, siteInfo.custom_domain);
    }
    //	Delete site from database
    await deleteSiteFromDbById(c, siteInfo.id);
    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/:siteId/custom_domain", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");
    //	Middleware to check if the user has access to modify the site
    let siteInfo: any;

    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user?.id);
    }

    if (!siteInfo || !siteInfo?.id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    const canAdd = await canAddCustomDomain(c, siteInfo.organization_id);

    if (!canAdd) {
      return c.json(
        { message: "Custom domains are not available on the free plan" },
        401
      );
    }

    const { customDomain } = await c.req.json();

    if (!customDomain) {
      return c.json({ message: "Custom domain is required" }, 400);
    }

    const parts = customDomain.split(".");
    const recordHost = parts.length > 2 ? parts[0] : "@";

    //	We need to look up the subdomain for the site
    const foundDomains = await getCustomDomainByName(c, customDomain);

    if (foundDomains && foundDomains.length === 0) {
      //	Write domain to sites table
      const orgId = siteInfo.organization_id;
      await addCustomDomainToSiteTable(c, siteId, customDomain, orgId);

      return c.json(
        {
          data: {
            recordType: "A",
            recordHost: recordHost,
            recordValue: c.env.NGINX_IP,
          },
        },
        200
      );
    } else if (foundDomains[0].organization_id === siteInfo.organization_id) {
      //  Domain exists and this is the org it belongs to, so we should return the A record details
      return c.json(
        {
          data: {
            recordType: "A",
            recordHost: recordHost,
            recordValue: c.env.NGINX_IP,
          },
        },
        200
      );
    } else {
      return c.json({ message: "Custom domain is already in use" }, 400);
    }
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.delete("/:siteId/custom_domain", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");

    //	Middleware to check if the user has access to modify the site
    let siteInfo: any;

    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user?.id);
    }

    if (!siteInfo || !siteInfo?.id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    const { customDomain } = await c.req.json();

    if (!customDomain) {
      return c.json({ message: "Custom domain is required" }, 400);
    }

    //	We need to look up the subdomain for the site
    const foundDomains = await getCustomDomainByName(c, customDomain);

    if (
      foundDomains &&
      foundDomains.length > 0 &&
      foundDomains[0].organization_id === siteInfo.organization_id
    ) {
      //  Delete the domain
      if (foundDomains[0].ssl_issued) {
        console.log("Removing SSL");
        await removeSSLCertAndProxyForDomain(c, customDomain);
      }
      console.log("Updating db...");
      //  We call updateDomainVerificationForSite with the final value as an empty string to set the custom domain back to empty
      await updateDomainVerificationForSite(
        c,
        siteId,
        siteInfo.organization_id,
        false,
        false,
        ""
      );
      return c.json({ message: "Success" }, 200);
    } else {
      return c.json(
        { message: "Custom domain not found or not owned by org" },
        400
      );
    }
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/:siteId/verify_domain", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { customDomain } = await c.req.json();
    const siteId = c.req.param("siteId");

    const siteInfo = await getSiteById(c, siteId);

    if (!siteInfo || !siteInfo?.id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    //  We should always verify domain ownership and DNS config
    //  People can remove the dns entry later and we should reflect that

    const isVerified = await verifyDomainOwnership(c, customDomain);

    if (
      isVerified &&
      siteInfo.domain_ownership_verified &&
      siteInfo.ssl_issued
    ) {
      console.log("Verified!");
      await updateDomainVerificationForSite(
        c,
        siteId,
        siteInfo.organization_id,
        isVerified,
        siteInfo.ssl_issued
      );
      return c.json({ data: { verified: true, sslIssued: true } }, 200);
    }

    if (isVerified && !siteInfo.ssl_issued) {
      console.log("Domain ownership verified! Issuing SSL!");
      await issueSSLCertAndProxyCustomDomain(
        c,
        siteInfo.domain.split(".orbiter.website")[0].toLowerCase(),
        customDomain
      );
      await updateDomainVerificationForSite(
        c,
        siteId,
        siteInfo.organization_id,
        true,
        true
      );
      return c.json({ data: { isVerified, sslIssued: true } }, 200);
    }

    if (!isVerified && siteInfo.ssl_issued) {
      await updateDomainVerificationForSite(
        c,
        siteId,
        siteInfo.organization_id,
        isVerified,
        siteInfo.ssl_issued
      );
      return c.json({ data: { isVerified: false, sslIssued: true } }, 200);
    }

    return c.json({ data: { isVerified: false, sslIssued: false } }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
