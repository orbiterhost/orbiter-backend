import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, PlanMapping } from "../utils/types";
import {
  createStripeSession,
  getSubscriptionScheduleById,
  getSubscriptionsForStripeCustomer,
} from "../utils/stripe";
import { canModifyPlan } from "../middleware/accessControls";
import { getUserSession } from "../middleware/auth";
import { getOrganizationById } from "../utils/db/organizations";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/:organization_id/plan", async (c) => {
  try {
    const PLAN_MAPPING: PlanMapping = {
      [c.env.ORBIT_MONTHLY_PRICE_ID]: "orbit",
      [c.env.LAUNCH_MONTHLY_PRICE_ID]: "launch",
      [c.env.LAUNCH_YEARLY_PRICE_ID]: "launch", // annual
      [c.env.ORBIT_YEARLY_PRICE_ID]: "orbit", // annual
    };
    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = c.req.param("organization_id");

    console.log({ orgId });

    const orgInfo = await getOrganizationById(c, orgId);

    const stripeCustomerId = orgInfo.stripe_customer_id;

    console.log({ stripeCustomerId });

    if (!stripeCustomerId) {
      console.log("No Stripe customer, return default plan info");
      const subscriptionData = {
        planName: "free",
        currentPeriodStart: 0,
        currentPeriodEnd: 0,
        status: "free",
        nextPlan: null,
      };
      return c.json({ data: subscriptionData }, 200);
    }

    const subscriptions = await getSubscriptionsForStripeCustomer(
      c,
      stripeCustomerId
    );
    const currentSubscription = subscriptions[0];

    console.log({ currentSubscription });

    // Check for scheduled changes
    let nextPlan = null;
    if (
      currentSubscription &&
      currentSubscription.schedule &&
      typeof currentSubscription.schedule === "string"
    ) {
      const schedule: any = await getSubscriptionScheduleById(
        c,
        currentSubscription.schedule
      );

      // Get the next phase after the current one
      const currentPhaseIndex = schedule.phases.findIndex(
        (phase: any) =>
          phase.start_date <= Date.now() / 1000 &&
          phase.end_date > Date.now() / 1000
      );

      if (
        currentPhaseIndex >= 0 &&
        currentPhaseIndex + 1 < schedule.phases.length
      ) {
        const nextPhase = schedule.phases[currentPhaseIndex + 1];
        const nextPriceId = nextPhase.items[0].price;
        nextPlan = PLAN_MAPPING[nextPriceId];
      }
    }

    const subscriptionData = {
      planName:
        currentSubscription && currentSubscription.items
          ? PLAN_MAPPING[currentSubscription.items.data[0].price.id]
          : "free",
      currentPeriodStart: currentSubscription?.current_period_start || 0,
      currentPeriodEnd: currentSubscription?.current_period_end || 0,
      status: currentSubscription?.cancel_at_period_end
        ? "canceling"
        : currentSubscription?.status || "",
      nextPlan,
    };

    console.log(subscriptionData);

    return c.json({ data: subscriptionData }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/:organization_id/plan", async (c) => {
  try {
    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { priceId } = await c.req.json();

    const orgId = c.req.param("organization_id");

    const canModify = await canModifyPlan(c, orgId, user?.id);

    if (!canModify) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const session = await createStripeSession(c, priceId, orgId);

    return c.json({ data: { url: session.url } }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
