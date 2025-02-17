import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { Site } from "../types";

export const getSiteByENS = async (
  c: Context,
  ens: string
): Promise<Site> => {
  try {
    const supabase = createClient(
       c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: sites, error } = await supabase
      .from("sites")
      .select("*")
      .eq("ens", ens);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (sites && sites[0]) || {
        id: "",
        created_at: "",
        organization_id: "",
        cid: "",
        domain: "",
        site_contract: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getEnsBySite = async (
  c: Context,
  siteId: string
): Promise<Site> => {
  try {
    const supabase = createClient(
       c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: sites, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", siteId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      (sites && sites[0]) || {
        id: "",
        created_at: "",
        organization_id: "",
        cid: "",
        domain: "",
        site_contract: "",
      }
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const updateEnsSite = async (
  c: Context,
  siteId: string,
  ens: string | null,
  resolverSet?: boolean | null
): Promise<void> => {
  try {
    const supabase = createClient(
       c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (resolverSet) {
      await supabase
        .from("sites")
        .update({ ens, resolverSet })
        .eq("id", siteId);
    }

    await supabase
      .from("sites")
      .update({ ens })
      .eq("id", siteId);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const updateResolverSet = async (
  c: Context,
  siteId: string,
  resolverSet: boolean
): Promise<void> => {
  try {
    const supabase = createClient(
       c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase
      .from("sites")
      .update({ resolverSet })
      .eq("id", siteId);
  } catch (error) {
    console.log(error);
    throw error;
  }
};