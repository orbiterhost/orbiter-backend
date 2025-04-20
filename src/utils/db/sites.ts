import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { Site, SiteVersionLookupType, SiteVersions } from "../types";
import { getMemberships } from "./organizations";

const VERSIONS_PER_PAGE = 10;

export const getSiteByDomain = async (
  c: Context,
  domain: string
): Promise<Site> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: sites, error } = await supabase
      .from("sites")
      .select("*")
      .eq("domain", domain);

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

export const getAllSites = async (
  c: Context
): Promise<Site[]> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let { data: sites, error } = await supabase
      .from("sites")
      .select("*")

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return (
      sites || []
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getSiteById = async (
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

export const getSiteVersions = async (
  c: Context,
  lookup: SiteVersionLookupType,
  offset?: number
): Promise<SiteVersions[]> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let query = supabase
      .from("site_versions")
      .select("*")
      .eq(lookup.field, lookup.value)
      .order("created_at", { ascending: false });

    if (offset !== undefined) {
      query = query.range(offset, offset + VERSIONS_PER_PAGE - 1);
    }

    let { data: versions, error } = await query;

    if (error) {
      console.error("Supabase error: ", error);
      throw error;
    }

    return versions || [];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const loadSites = async (
  c: Context,
  orgId: string,
  userId: string,
  domain?: string
) => {
  const memberships = await getMemberships(c, userId);
  if (memberships?.find((m: any) => m.organization_id === orgId)) {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (domain) {
      let { data: sites, error } = await supabase
        .from("sites")
        .select("*")
        .eq("organization_id", orgId)
        .ilike("domain", `${domain}.orbiter.website`);

      if (error) {
        throw error;
      }

      return sites as Site[];
    }

    let { data: sites, error } = await supabase
      .from("sites")
      .select("*")
      .eq("organization_id", orgId);

    if (error) {
      throw error;
    }

    return sites as Site[];
  } else {
    return c.json({ message: "Unauthorized" }, 401);
  }
};

export const createOrUpdateSiteMapping = async (
  c: Context,
  userId: string,
  orgId: string,
  domain: string,
  cid: string,
  siteContract?: string
) => {
  try {
    console.log("Updating site mapping!");
    const memberships = await getMemberships(c, userId);
    if (memberships?.find((m: any) => m.organization_id === orgId)) {
      const supabase = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const updateData: any = {
        cid,
        organization_id: orgId,
        domain: `${domain}.orbiter.website`,
        deployed_by: userId,
      };

      // Only include site_contract if it's provided
      if (siteContract) {
        updateData.site_contract = siteContract;
      }

      const { data, error } = await supabase
        .from("sites")
        .upsert(updateData, { onConflict: "domain" })
        .select();

      if (error) {
        throw error;
      }
    } else {
      return c.json({ message: "Unauthorized" }, 401);
    }
  } catch (error) {
    console.log("site mapping error: ", error);
    throw error;
  }
};

export const deleteSiteFromDbById = async (c: Context, siteId: string) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.from("sites").delete().eq("id", siteId);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const addCustomDomainToSiteTable = async (
  c: Context,
  siteId: string,
  customDomain: string,
  orgId: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("sites")
      .upsert(
        {
          id: siteId,
          custom_domain: customDomain,
          organization_id: orgId,
        },
        {
          onConflict: "id",
        }
      )
      .select();

    if (error) {
      throw error;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const updateDomainVerificationForSite = async (
  c: Context,
  siteId: string,
  orgId: string,
  verified: boolean,
  ssl: boolean,
  customDomain?: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const upsertData =
      customDomain === ""
        ? {
          id: siteId,
          organization_id: orgId,
          domain_ownership_verified: verified,
          ssl_issued: ssl,
          custom_domain: null,
        }
        : {
          id: siteId,
          organization_id: orgId,
          domain_ownership_verified: verified,
          ssl_issued: ssl,
        };

    const { data, error } = await supabase
      .from("sites")
      .upsert(upsertData, { onConflict: "id" })
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

export const getCustomDomainByName = async (
  c: Context,
  customDomain: string
) => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("custom_domain", customDomain);

    if (error) {
      console.log("Supabase error: ", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
