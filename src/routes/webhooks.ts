import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, PlanMapping } from "../utils/types";
import {
  constructEvent,
  getSubscriptionsForStripeCustomer,
} from "../utils/stripe";
import { postSubscriptionChanges } from "../utils/notifications";
import {
  addStripeCustomerIdToOrgTable,
  getOrgInfoByStripeCustomer,  
} from "../utils/db/organizations";

import CryptoJS from "crypto-js";
import { verifySupabaseWebhookSecret } from "../middleware/auth";
import { getFunctionUsage, getFunctionUsageByScript } from "../utils/functions";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.post("/loop_test", async (c) => {
  try {
    const body = await c.req.json();

    const signature = CryptoJS.HmacSHA256(
      JSON.stringify(body),
      c.env.LOOP_TEST_ENDPOINT_SECRET
    ).toString(CryptoJS.enc.Base64);
    const loopSigHeader = c.req.header("loop-signature");
    console.log({ signature, loopSigHeader });
    if (signature !== loopSigHeader) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    console.log(body);
    const { event, externalCustomerId, refId, email, item } = body;
    const orgId = refId;

    switch (event) {
      case "AgreementSignedUp":
        const subscriptions = await getSubscriptionsForStripeCustomer(
          c,
          externalCustomerId
        );

        if (subscriptions.length > 0) {
          // Update KV
          await c.env.SITE_PLANS.put(orgId, item.toLowerCase());
          //  Add customer ID to organizations table
          await addStripeCustomerIdToOrgTable(c, orgId, externalCustomerId);
          const message = `
${item} subscription created using Loop: 
orgId: ${orgId}, 
email: ${email}, 

stripeCustomer: ${externalCustomerId}`;
          await postSubscriptionChanges(c, message);
        } else {
          console.log("No subscriptions found...");
        }
        break;
    }
    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/loop", async (c) => {
  try {
    const body = await c.req.json();

    const signature = CryptoJS.HmacSHA256(
      JSON.stringify(body),
      c.env.LOOP_ENDPOINT_SECRET
    ).toString(CryptoJS.enc.Base64);
    const loopSigHeader = c.req.header("loop-signature");
    console.log({ signature, loopSigHeader });
    if (signature !== loopSigHeader) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    console.log(body);
    const { event, externalCustomerId, refId, email, item } = body;
    const orgId = refId;

    switch (event) {
      case "AgreementSignedUp":
        const subscriptions = await getSubscriptionsForStripeCustomer(
          c,
          externalCustomerId
        );

        if (subscriptions.length > 0) {          
          // Update KV
          await c.env.SITE_PLANS.put(orgId, item.toLowerCase());
          //  Add customer ID to organizations table
          await addStripeCustomerIdToOrgTable(c, orgId, externalCustomerId);
          const message = `
${item} subscription created using Loop: 
orgId: ${orgId}, 
email: ${email}, 

stripeCustomer: ${externalCustomerId}`;
          await postSubscriptionChanges(c, message);
        } else {
          console.log("No subscriptions found...");
        }
        break;
    }
    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

// app.post("/test-function-usage", async (c) => {
//   // const usage = await getWorkerUsage(c, "marketing", "2025-05-17T00:00:00.000Z", "2025-06-16T23:59:59.000Z");
//   const usage = await getFunctionUsageByScript(
//     c.env.CLOUDFLARE_ACCOUNT_ID,
//     c.env.CLOUDFLARE_API_TOKEN,
//     // 'staging-functions', // namespace name
//     'marketing', // script name within the namespace
//     new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
//     new Date().toISOString()
//   );

//   return c.json({ usage }, 200);
// });

app.post("/stripe", async (c) => {
  try {
    const PLAN_MAPPING: PlanMapping = {
      [c.env.ORBIT_MONTHLY_PRICE_ID]: "orbit",
      [c.env.LAUNCH_MONTHLY_PRICE_ID]: "launch",
      [c.env.LAUNCH_YEARLY_PRICE_ID]: "launch", // annual
      [c.env.ORBIT_YEARLY_PRICE_ID]: "orbit" // annual
    };
    const payload = await c.req.text();
    const sig = c.req.header("stripe-signature");

    const event: any = await constructEvent(c, payload, sig);

    const session = event.data.object;
    const customerId = session.customer;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        const orgId = session.client_reference_id;

        if (!orgId) {
          console.log("No org ID in the session payload");
        }
        const subscriptions = await getSubscriptionsForStripeCustomer(
          c,
          customerId
        );

        if (subscriptions.length > 0) {
          const subscription = subscriptions[0];
          const priceId = subscription.items.data[0].price.id;
          // Update KV
          await c.env.SITE_PLANS.put(orgId, PLAN_MAPPING[priceId]);
          //  Add customer ID to organizations table
          await addStripeCustomerIdToOrgTable(c, orgId, customerId);
          const message = `${PLAN_MAPPING[priceId]} subscription created by org: ${orgId}`;
          await postSubscriptionChanges(c, message);
        } else {
          console.log("No subscriptions found...");
        }
        break;
      case "customer.subscription.updated":
        // Fires when a subscription is changed to a different plan
        // Also fires for other subscription updates like payment method changes
        const orgInfo = await getOrgInfoByStripeCustomer(c, customerId);
        const updatedSubscription = event.data.object;
        const previousAttributes = event.data.previous_attributes;

        // Check if the price/plan changed
        if (previousAttributes.items) {
          // Plan was changed
          const newPriceId = updatedSubscription.items.data[0].price.id;
          if (PLAN_MAPPING[newPriceId] === "orbit") {
            //  Upgrade
            const message = `Subscription upgraded to Orbit by org: ${orgInfo.id}`;
            await postSubscriptionChanges(c, message);
          } else {
            //  Downgrade
            const message = `Subscription downgraded by org: ${orgInfo.id}`;
            await postSubscriptionChanges(c, message);
          }
          // Update your KV store with new plan info
          await c.env.SITE_PLANS.put(orgInfo.id, PLAN_MAPPING[newPriceId]);
        }
        break;

      case "customer.subscription.deleted":
        const organizationInfo = await getOrgInfoByStripeCustomer(
          c,
          customerId
        );
        // Fires when a subscription is cancelled
        // const canceledSubscription = event.data.object;
        if (organizationInfo && organizationInfo.id) {
          const message = `Subscription cancelled by org: ${organizationInfo.id}`;
          await postSubscriptionChanges(c, message);
          await c.env.SITE_PLANS.delete(organizationInfo.id);
        }
        break;
      case "customer.subscription.pending_update_applied":
        // Fires when a scheduled subscription update is applied
        // This happens if you allow users to schedule plan changes for the next billing period
        const updatedPendingSubscription = event.data.object;
        break;
    }

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/supabase", async (c) => {
  try {
    const validRequest = await verifySupabaseWebhookSecret(c);
    if(!validRequest) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    
    switch(body.type) {
      case "INSERT":
      default: 
        //  Check for the table
        if(body.table === "users") {
          const { record } = body;
          const email = record.email;

          //  Post message to slack
          const message = `New free sign up from: ${email}`
          await postSubscriptionChanges(c, message);
        }
      break;
    }

    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
})

export default app;
