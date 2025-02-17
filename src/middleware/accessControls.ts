import { Context } from "hono";
import { Site, Membership, PlanMapping } from "../utils/types";
import { getSubscriptionsForStripeCustomer } from "../utils/stripe";
import {
  getMembershipByOrgIdAndUserId,
  getMembershipForOrganization,
  getMemberships,
  getOrganizationById,
  getOrgMembership,
  getSiteCountForOrganization,
} from "../utils/db/organizations";
import { getSiteById } from "../utils/db/sites";

const ACTION_ROLE_MAPPING: any = {
  add_workspace_member: ["ADMIN", "OWNER"],
  remove_workspace_member: ["ADMIN", "OWNER"],
  create_site: ["ADMIN", "OWNER", "MEMBER"],
  delete_site: ["ADMIN", "OWNER"],
  update_site: ["ADMIN", "OWNER", "MEMBER"],
  manage_custom_domain: ["ADMIN", "OWNER"],
  transfer_ownership: ["OWNER"],
  manage_billing: ["ADMIN", "OWNER"],
  create_api_key: ["ADMIN", "OWNER"],
  delete_api_key: ["ADMIN", "OWNER"],
};

type PlanType = "free" | "launch" | "orbit";

export const SITE_LIMITS: Record<PlanType, number> = {
  free: 2,
  launch: 5,
  orbit: 100000000000,
};

export const canModifySite = async (
  c: Context,
  siteId: string,
  userId: string
) => {
  try {
    const siteInfo: Site = await getSiteById(c, siteId);
    if (!siteInfo || !siteInfo.organization_id) {
      return c.json({ message: "Invalid site ID" }, 400);
    }

    const { organization_id } = siteInfo;

    const membership = await getMembershipForOrganization(
      c,
      organization_id,
      userId
    );
    if (!membership || !membership.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    return siteInfo;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const canCreateSite = async (
  c: Context,
  userId: string,
  orgId: string
) => {
  try {
    const PLAN_MAPPING: PlanMapping = {
      [c.env.ORBIT_MONTHLY_PRICE_ID]: "orbit",
      [c.env.LAUNCH_MONTHLY_PRICE_ID]: "launch",
      [c.env.LAUNCH_YEARLY_PRICE_ID]: "launch", // annual
      [c.env.ORBIT_YEARLY_PRICE_ID]: "orbit", // annual
    };
    const memberships = await getMemberships(c, userId);
    if (
      !memberships ||
      !memberships.find((m: Membership) => m.organization_id === orgId)
    ) {
      return c.json({ message: "Invalid organization or user id" }, 400);
    }

    let plan: PlanType = "free";

    const orgInfo = await getOrganizationById(c, orgId);

    if (!orgInfo.stripe_customer_id) {
      plan = "free";
    } else {
      const subscriptions = await getSubscriptionsForStripeCustomer(
        c,
        orgInfo.stripe_customer_id
      );
      const currentSubscription: any =
        subscriptions && subscriptions.length > 0 ? subscriptions[0] : {};
      plan =
        currentSubscription && currentSubscription.items
          ? PLAN_MAPPING[currentSubscription.items.data[0].price.id]
          : "free";
    }

    if (plan !== "orbit") {
      //  Check if they have reached their site limit
      const siteCount: number | null = await getSiteCountForOrganization(
        c,
        orgId
      );

      if (siteCount && siteCount >= SITE_LIMITS[plan]) {
        return false;
      }
    }

    //  @TODO - fetch total storage from Pinata for customer

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const canModifyPlan = async (
  c: Context,
  orgId: string,
  userId: string
) => {
  try {
    const memberships = await getMembershipByOrgIdAndUserId(c, userId, orgId);
    if (memberships && memberships.length > 0) {
      return true;
    }

    return false;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const canAddCustomDomain = async (c: Context, orgId: string) => {
  try {
    const plan = (await c.env.SITE_PLANS.get(orgId)) || "free";

    if (plan === "free") {
      return false;
    }

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const canAccessVersions = async (c: Context, orgId: string) => {
  try {
    const plan = (await c.env.SITE_PLANS.get(orgId)) || "free";

    if (plan === "free") {
      return false;
    }

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getOrgMemberStatus = async (
  c: Context,
  orgId: string,
  userId: string
) => {
  try {
    const membership = await getOrgMembership(c, orgId, userId);
    return membership;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const canMemberTakeAction = (role: string, action: string) => {
  if (ACTION_ROLE_MAPPING[action].includes(role)) {
    return true;
  } else {
    return false;
  }
};
