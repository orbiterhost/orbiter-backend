import { Context } from "hono";
import Stripe from "stripe";
import { getOrganizationById } from "./db/organizations";

export const createStripeSession = async (
  c: Context,
  priceId: string,
  orgId: string
) => {
  try {
    const stripe = new Stripe(c.env.STRIPE_KEY);

    // Get existing customer
    const orgInfo = await getOrganizationById(c, orgId);

    let customerId = orgInfo.stripe_customer_id;
    let existingSubscription = null;

    console.log({ customerId });

    if (customerId) {
      // Get customer's subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        existingSubscription = subscriptions.data[0];
      }
    }

    // If there's an existing subscription, create a billing portal session instead
    if (existingSubscription && customerId) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${c.env.SITE_DOMAIN}`,
      });

      return {
        type: "portal",
        url: portalSession.url,
      };
    }

    // Otherwise create a new checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${c.env.SITE_DOMAIN}?success=true`,
      cancel_url: `${c.env.SITE_DOMAIN}?canceled=true`,
      allow_promotion_codes: true,
      client_reference_id: orgId,
    });

    return {
      type: "checkout",
      url: session.url,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const constructEvent = async (c: Context, payload: any, sig: any) => {
  try {
    // Create a crypto provider that uses WebCrypto
    const cryptoProvider = Stripe.createSubtleCryptoProvider();

    // Use the async version of constructEvent
    const event = await Stripe.webhooks.constructEventAsync(
      payload,
      sig,
      c.env.ENDPOINT_SECRET,
      undefined,
      cryptoProvider
    );
    return event;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getStripeCustomerByStripeId = async (
  c: Context,
  customerId: string
) => {
  try {
    const stripe = new Stripe(c.env.STRIPE_KEY);
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getSubscriptionsForStripeCustomer = async (
  c: Context,
  customerId: string
) => {
  try {
    const stripe = new Stripe(c.env.STRIPE_KEY);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    return subscriptions && subscriptions.data ? subscriptions.data : [];
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getSubscriptionScheduleById = async (c: Context, id: string) => {
  try {
    const stripe = new Stripe(c.env.STRIPE_KEY);
    const schedule = await stripe.subscriptionSchedules.retrieve(id);
    return schedule;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getActiveSubscriptions = async (c: Context) => {
  const stripe = new Stripe(c.env.STRIPE_KEY);

  const subscribers: any[] = []
  
  await stripe.subscriptions.list({
    limit: 100,
  }).autoPagingEach(function(subscription) {
    subscribers.push(subscription)
  });

  return subscribers;
};

export async function calculateMRR(c: Context) {
  const stripe = new Stripe(c.env.STRIPE_KEY);
  let mrr = 0;
  let testUserEmails = ['launchorbiter@gmail.com', 'justin@polluterofminds.com', 'justin.edward.hunter@gmail.com', 'justin@orbiter.host', 'stevedsimkins@gmail.com']; // Your list of test users
  
  // Get all active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    status: 'active',
    limit: 100 // Adjust based on your needs
  });
  
  // Process each subscription
  for (const subscription of subscriptions.data) {
    // Get customer info to check if they're a test user
    const customer: any = await getStripeCustomerByStripeId(c, subscription.customer as string);
    // Skip test users
    if (customer.email && testUserEmails.includes(customer.email)) {
      continue;
    }
    
    console.log(customer)
    // Calculate monthly value for this subscription
    let subscriptionMRR = 0;
    
    for (const item of subscription.items.data) {
      const price = item.price;
      const quantity = item.quantity || 1;
      
      // Convert to monthly value if needed
      if (price && price?.recurring?.interval === 'month' && price.unit_amount) {
        subscriptionMRR += price.unit_amount * quantity;
      } else if (price && price?.recurring?.interval === 'year' && price.unit_amount) {
        subscriptionMRR += (price.unit_amount * quantity) / 12;
      } 
    }
    
    // Add to total MRR (convert from cents to dollars)
    mrr += subscriptionMRR / 100;
  }
  
  return mrr;
}
