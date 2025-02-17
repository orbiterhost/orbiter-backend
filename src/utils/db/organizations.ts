import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { Membership, Organization } from "../types";

//  Hard code limit on orgs until we support multi-tenancy
const ORG_LIMIT = 1;

export const getMembershipForOrganization = async (
  c: Context,
  organizationId: string,
  userId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: memberships, error } = await supabase
      .from("members")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return memberships && memberships.length > 0
      ? memberships[0]
      : ({} as Membership);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getMembershipByOrgIdAndUserId = async (
  c: Context,
  userId: string,
  orgId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    let { data: members, error } = await supabase
      .from("members")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) {
      console.log("Supabase error: ", error);
    }

    return members;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getMemberships = async (c: Context, userId: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: memberships, error } = await supabase
      .from("members")
      .select(
        `
      *,
      organizations (
        id,
        name,
        created_at
      )
    `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching memberships:", error);
      return;
    }

    return memberships as Membership[];
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getMembersForOrg = async (
  c: Context,
  orgId: string,
  offset = 0
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: members, error } = await supabase
      .from("members")
      .select(
        `
      *,
      users (
        id,
        display_name,
        email,
        avatar_url
      )
    `
      )
      .eq("organization_id", orgId);

    if (error) {
      console.error("Error fetching members:", error);
      throw error;
    }

    return members as Membership[];
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const removeMember = async (
  c: Context,
  orgId: string,
  userId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getOrgMembership = async (
  c: Context,
  orgId: string,
  userId: string
): Promise<Membership> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: memberships, error } = await supabase
      .from("members")
      .select(
        `
      *,
      organizations (
        id,
        name,
        created_at
      )
    `
      )
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (error) {
      console.error("Error fetching membership:", error);
      throw error;
    }

    return (
      (memberships && memberships[0]) || {
        id: "",
        created_at: "",
        role: "",
        user_id: "",
        organization_id: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const createOrganizationAndMembership = async (
  c: Context,
  orgName: string,
  userId: string
) => {
  try {
    //  Only allow if memberships < ORG_MEMBERSHIP_LIMIT
    const memberships = await getMemberships(c, userId);
    if (memberships && memberships.length < ORG_LIMIT) {
      const supabase = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert([{ name: orgName, owner_id: userId }])
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: memberError } = await supabase.from("members").insert([
        {
          organization_id: org.id,
          role: "ADMIN",
          user_id: userId,
        },
      ]);

      if (memberError) throw memberError;
    } else {
      return c.json(
        { message: "You have reached your organization limit" },
        400
      );
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getSiteCountForOrganization = async (
  c: Context,
  organizationId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { count, error } = await supabase
      .from("sites")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return count;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getOrganizationById = async (
  c: Context,
  orgId: string
): Promise<Organization> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: organizations, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (organizations && organizations[0]) || {
        id: "",
        created_at: "",
        name: "",
        owner_id: "",
        stripe_customer_id: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const addStripeCustomerIdToOrgTable = async (
  c: Context,
  orgId: string,
  customerId: string
) => {
  try {
    console.log("Updating customer in db");
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", orgId)
      .select();

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getOrgInfoByStripeCustomer = async (
  c: Context,
  customerId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: organizations, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (organizations && organizations[0]) || {
        id: "",
        created_at: "",
        name: "",
        owner_id: "",
        stripe_customer_id: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getOrgByOwnerId = async (c: Context, id: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: organizations, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", id);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (organizations && organizations[0]) || {
        id: "",
        created_at: "",
        name: "",
        owner_id: "",
        stripe_customer_id: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};
