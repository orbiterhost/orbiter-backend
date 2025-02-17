import { Context } from "hono";
import { createClient } from "@supabase/supabase-js";
import { Invite } from "../types";

export const blockUser = async (c: Context, email: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const user = await getUserByEmail(c, email);

    if (!user) {
      console.log("No user found!");
      throw new Error("No user found");
    }
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        blocked: "true",
        blockDate: new Date(),
      },
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getUserById = async (c: Context, id: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (users && users[0]) || {
        id: "",
        created_at: "",
        updated_at: "",
        display_name: "",
        email: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getUserByEmail = async (c: Context, email: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (users && users[0]) || {
        id: "",
        created_at: "",
        updated_at: "",
        display_name: "",
        email: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const addInvite = async (
  c: Context,
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  userId: string,
  orgId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: invites, error } = await supabase
      .from("invites")
      .insert([
        {
          invite_email: email,
          first_name: firstName,
          last_name: lastName,
          role: role,
          invited_by: userId,
          status: "PENDING",
          organization_id: orgId,
        },
      ])
      .select();

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (invites && invites[0]) || {
        id: "",
        created_at: "",
        updated_at: "",
        organization_id: "",
        invite_email: "",
        role: "",
        status: "",
        first_name: "",
        last_name: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getInviteByOrgAndUser = async (
  c: Context,
  orgId: string,
  email: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: invites, error } = await supabase
      .from("invites")
      .select("*")
      .eq("invite_email", email)
      .eq("organization_id", orgId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return ((invites && invites[0]) || {
      id: "",
      created_at: "",
      updated_at: "",
      organization_id: "",
      invite_email: "",
      role: "",
      status: "",
      first_name: "",
      last_name: "",
    }) as Invite;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getInviteById = async (c: Context, inviteId: string) => {
  try {
    console.log("Getting invite details...");
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: invites, error } = await supabase
      .from("invites")
      .select(`*, organizations(*)`)
      .eq("id", inviteId);
    console.log(invites);
    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return ((invites && invites[0]) || {
      id: "",
      created_at: "",
      updated_at: "",
      organization_id: "",
      invite_email: "",
      role: "",
      status: "",
      first_name: "",
      last_name: "",
    }) as Invite;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const acceptInvite = async (c: Context, inviteId: string) => {
  try {
    console.log("ACCEPTING INVITE YO!");
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: invites, error } = await supabase
      .from("invites")
      .update({ status: "ACCEPTED" })
      .eq("id", inviteId)
      .select();

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return ((invites && invites[0]) || {
      id: "",
      created_at: "",
      updated_at: "",
      organization_id: "",
      invite_email: "",
      role: "",
      status: "",
      firstName: "",
      lastName: "",
    }) as Invite;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const addUserToOrg = async (
  c: Context,
  userId: string,
  orgId: string,
  role: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { error } = await supabase
      .from("members")
      .insert([{ user_id: userId, organization_id: orgId, role: role }]);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getInvitesByOrgId = async (c: Context, orgId: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: invites, error } = await supabase
      .from("invites")
      .select("*")
      .eq("organization_id", orgId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return invites as Invite[];
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const removeInvite = async (c: Context, inviteId: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { error } = await supabase
      .from("invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};
