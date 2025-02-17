import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";

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
