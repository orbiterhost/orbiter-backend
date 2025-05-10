import { Context } from "hono";
import { getOrganizationsCreatedByDateRange } from "./db/organizations";
import { getSitesByOrgId } from "./db/sites";
import { getUserById } from "./db/users";

export const sendTransactionalEmail = async (c: Context, body: string) => {
  try {
    await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.env.LOOPS_API_KEY}`,
      },
      body: body,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const sendNoSiteEmail = async (c: Context) => {
  try {
    //  Get all of the users who have signed up 7 days ago but have not set up a site
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Set to beginning of that day (midnight)
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const start = sevenDaysAgo.toISOString();

    // Set to end of that day (23:59:59.999)
    sevenDaysAgo.setHours(23, 59, 59, 999);
    const end = sevenDaysAgo.toISOString();

    const orgs = await getOrganizationsCreatedByDateRange(c, start, end);
    const noSites = [];

    if (!orgs) {
      return;
    }

    console.log(orgs);

    // for (const org of orgs) {
    //   const sites = await getSitesByOrgId(c, org.id);
    //   if (sites?.length === 0) {
    //     noSites.push({
    //       orgId: org.id,
    //       owner: org.owner_id,
    //     });
    //   }
    // }

    // for (const site of noSites) {
    //   const user = await getUserById(c, site.owner);
    //   if (user) {
    //     const body = {
    //       email: user.email,
    //       eventName: "noSiteCreation",
    //       eventProperties: {
    //         signUpDate: user.created_at,
    //       },
    //     };
    //     await fetch("https://app.loops.so/api/v1/events/send", {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Bearer ${c.env.LOOPS_API_KEY}`,
    //       },
    //       body: JSON.stringify(body),
    //     });
    //   }
    // }
  } catch (error) {
    console.log(error);
    throw error;
  }
};
