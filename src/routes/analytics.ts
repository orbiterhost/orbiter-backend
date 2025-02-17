import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { getSiteById } from "../utils/db/sites";
import { canModifySite } from "../middleware/accessControls";
import { getCountryData, getDailySiteStats, getPathData, getReferrerData } from "../utils/analytics";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/:siteId/stats", async (c) => {
  try {
    const siteId = c.req.param("siteId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

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

    let data; 
    if(startDate && endDate) {
        const range = {
            startDate, 
            endDate
        }
        data = await getDailySiteStats(c, siteInfo.domain, range);
    } else {
        data = await getDailySiteStats(c, siteInfo.domain);
    }
    return c.json({ data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" });
  }
});

app.get("/:siteId/paths", async (c) => {
  try {
    const siteId = c.req.param("siteId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

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

    let data; 
    if(startDate && endDate) {
        const range = {
            startDate, 
            endDate
        }
        data = await getPathData(c, siteInfo.domain, range);
    } else {
        data = await getPathData(c, siteInfo.domain);
    }
    return c.json({ data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" });
  }
});

app.get("/:siteId/referrers", async (c) => {
  try {
    const siteId = c.req.param("siteId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

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

    let data; 
    if(startDate && endDate) {
        const range = {
            startDate, 
            endDate
        }
        data = await getReferrerData(c, siteInfo.domain, range);
    } else {
        data = await getReferrerData(c, siteInfo.domain);
    }
    return c.json({ data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" });
  }
});

app.get("/:siteId/countries", async (c) => {
  try {
    const siteId = c.req.param("siteId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

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

    let data; 
    if(startDate && endDate) {
        const range = {
            startDate, 
            endDate
        }
        data = await getCountryData(c, siteInfo.domain, range);
    } else {
        data = await getCountryData(c, siteInfo.domain);
    }
    return c.json({ data }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" });
  }
});

export default app;
