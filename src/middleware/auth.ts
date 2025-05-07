import { createClient } from "@supabase/supabase-js";
import { Bindings } from "../utils/types";
import { Context } from "hono";
import { getKeyByHash } from "../utils/db/keys";
import { hashApiKey } from "../utils/apiKeys";
import { slowEquals } from "../utils/security";

const ALLOWED_USERS = [
  "491404e0-0c90-43fe-a86e-4e11014a7e52",
  "f5735334-738c-4d48-a324-226ac182a08b",
  "e931bc05-6164-436b-8960-e31df696217d",
];

export const getUserSession = async (c: Context) => {
  try {
    //  get header
    const apiKey = c.req.header("X-Orbiter-API-Key");

    if (apiKey) {
      const hashedKey = await hashApiKey(apiKey);
      const keyData = await getKeyByHash(c, hashedKey);
      if (!keyData.id) {
        return {
          isAuthenticated: false
        }
      }

      return {
        isAuthenticated: true,
        organizationData: { id: keyData.organization_id, orgOwner: keyData.organizations?.owner_id, scope: keyData.scope }
      }
    }

    const token = c.req.header("X-Orbiter-Token");

    if (!token) {
      return {
        isAuthenticated: false,
      };
    }

    const supabase = createClient(
      "https://myyfwiyflnerjrdaoyxs.supabase.co",
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if(user?.app_metadata.banned === "true") {
      return {
        isAuthenticated: false,
      };
    }

    if (user && user.id) {
      return {
        isAuthenticated: true,
        user: user,
      };
    } else {
      return {
        isAuthenticated: false,
      };
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const adminAccess = async (c: Context) => {
  try {
    const token = c.req.header("X-Orbiter-Token");
    const adminToken = c.req.header("X-Orbiter-Admin");
    if (!token && !adminToken) {
      return {
        isAuthenticated: false,
      };
    } else if (!token && !slowEquals(adminToken as string, c.env.NGINX_SERVER_TOKEN)) {
      return {
        isAuthenticated: false,
      };
    }

    if (token) {
      //  Need to verify that it is Steve or Justin or launchOrbiter
      const supabase = createClient(
        "https://myyfwiyflnerjrdaoyxs.supabase.co",
        c.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user && user.user_metadata.blocked === "true") {
        console.log("User is blocked: ", user);
        return {
          isAuthenticated: false
        }
      }

      if (user && user.id && ALLOWED_USERS.includes(user.id)) {
        return {
          isAuthenticated: true,
          user: user,
        };
      } else {
        return {
          isAuthenticated: false,
        };
      }
    } else {
      return {
        isAuthenticated: true,
        user: { id: "ADMIN" },
      };
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const verifySupabaseWebhookSecret = async (c: Context) => {
  try {
    const secret = c.req.header("x-supabase-secret")
    console.log("Supabase secret!")
    console.log(secret);
    //  @TODO - figure out why Supabase is not sending the custom header I set

    // if(secret !== c.env.SUPABASE_WEBHOOK_SECRET) {
    //   return false;
    // }

    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
