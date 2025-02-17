import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { Key } from "../types";

export const getKeyByHash = async (c: Context, hash: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: api_keys, error } = await supabase
      .from("api_keys")
      .select(`*, organizations(*)`)
      .eq("key_hash", hash);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      api_keys && api_keys.length > 0
        ? api_keys[0]
        : {
            id: "",
            created_at: "",
            key_hash: "",
            key_name: "",
            scope: "",
            organization_id: "",
          }
    ) as Key;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const createApiKey = async (
  c: Context,
  orgId: string,
  name: string,
  scope: string,
  keyHash: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.from("api_keys").insert([
      {
        organization_id: orgId,
        key_name: name,
        scope: scope,
        key_hash: keyHash,
      },
    ]);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getApiKeysByOrgId = async (
  c: Context,
  orgId: string,
  offset: number
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: api_keys, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("organization_id", orgId)
      .range(offset, offset + 10 - 1)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return api_keys as Key[];
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const deleteApiKey = async (c: Context, keyId: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { error } = await supabase.from("api_keys").delete().eq("id", keyId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};
