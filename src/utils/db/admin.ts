import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";
import { OnboardingResponse, SourceCount } from "../types";

export const getSiteCount = async (c: Context): Promise<number | null> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { count, error } = await supabase
      .from("sites")
      .select("id", { count: "exact" });

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

export const getUserCount = async (c: Context): Promise<number | null> => {
  try {
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { count, error } = await supabase
      .from("users")
      .select("id", { count: "exact" });

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

export const getDailyVersions = async (c: Context) => {
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc("get_daily_versions");

  if (error) {
    throw new Error(`Error fetching daily versions: ${error.message}`);
  }

  // Transform the data to include formatted dates
  return data.map((row: any) => ({
    date: new Date(row.date).toISOString().split("T")[0],
    updates: parseInt(row.version_count),
  }));
};

export const getDailyUsers = async (c: Context) => {
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc("get_daily_users");

  if (error) {
    throw new Error(`Error fetching daily versions: ${error.message}`);
  }

  // Transform the data to include formatted dates
  return data.map((row: any) => ({
    date: new Date(row.date).toISOString().split("T")[0],
    users: parseInt(row.version_count),
  }));
};

function countUniqueValues(data: OnboardingResponse[], field: string) {
  const counts = {};

  data.forEach((item: OnboardingResponse) => {
    //  @ts-expect-error
    const value = item[field];
    //  @ts-expect-error
    counts[value] = (counts[value] || 0) + 1;
  });

  // Convert to array of objects for easier consumption
  return Object.entries(counts)
    .map(([value, count]) => ({
      value,
      count,
    }))
    .sort((a: any, b: any) => b.count - a.count); // Sort by count descending
}

export const getOnboardingDataByDateRange = async (
  c: Context,
  startDate: string,
  endDate: string
) => {
  console.log({ startDate, endDate });
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("onboarding_responses")
    .select("*")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) {
    console.log("Supabase error: ");
    console.log(error);
    throw error;
  }

  const analytics = {
    referral_sources: countUniqueValues(data, "referral_source"),
    site_types: countUniqueValues(data, "site_types"),
    technical_experience: countUniqueValues(data, "technical_experience"),
    previous_platform: countUniqueValues(data, "previous_platform"),
  };

  return analytics;
};

export const getSiteDeploymentSources = async (
  c: Context,
  startDate: string,
  endDate: string
) => {
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await supabase
    .from("site_versions")
    .select("source")
    .gte("created_at", startDate)
    .lte("created_at", endDate)

    if (error) {
      throw new Error(`Error fetching source data: ${error.message}`);
    }
  
    if (!data || data.length === 0) {
      return [];
    }
  
    const sourceCounts: Record<string, number> = {};
    
    data.forEach(record => {
      const source = record.source === null ? 'web-app' : record.source;
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
  
    const result: SourceCount[] = Object.entries(sourceCounts).map(([source, count]) => ({
      value: source,
      count
    }));
  
    return result.sort((a, b) => b.count - a.count);
};
