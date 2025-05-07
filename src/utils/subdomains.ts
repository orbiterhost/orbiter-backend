import { Context, Env } from "hono";
import short from "short-uuid";
import { Bindings, SubdomainValidation } from "./types";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";


export const generateSubdomainText = () => {
  try {
    return uniqueNamesGenerator({
      dictionaries: [adjectives, animals, colors], // colors can be omitted here as not used
      length: 3,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const createSubdomain = async (env: Bindings, subdomain: string) => {
  try {
    const ZONE_ID = env.ZONE_ID;
    const API_TOKEN = env.CLOUDFLARE_API_TOKEN;
    console.log(subdomain);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CNAME",
          name: subdomain,
          content: "orbiter-websites.orbiter-api.workers.dev", 
          proxied: true,
        }),
      }
    );

    const result = await response.json();
    console.log(result);
    return result;
  } catch (error) {
    console.log("Subdomain error: ", error);
    throw error;
  }
};

export const deleteSubdomain = async (env: Bindings, subdomain: string) => {
  try {
    const ZONE_ID = env.ZONE_ID;
    const API_TOKEN = env.CLOUDFLARE_API_TOKEN;

    // First, find the DNS record ID for the subdomain
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name.contains=${subdomain}`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const listResult: any = await listResponse.json();
    
    if (!listResult?.success || !listResult?.result.length) {
      throw new Error(`No DNS record found for subdomain: ${subdomain}`);
    }

    const recordId = listResult.result[0].id;

    // Delete the DNS record
    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${recordId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const deleteResult = await deleteResponse.json();
    console.log(deleteResult);
    return deleteResult;

  } catch (error) {
    console.log("Delete subdomain error: ", error);
    throw error;
  }
};

export const checkSubdomainDNSRecord = async (
  env: Bindings,
  subdomain: string
) => {
  const baseUrl = "https://api.cloudflare.com/client/v4";

  try {
    const response = await fetch(
      `${baseUrl}/zones/${env.ZONE_ID}/dns_records?name=${subdomain}.orbiter.website`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(
        `Cloudflare API error: ${
          errorData.errors[0]?.message || "Unknown error"
        }`
      );
    }

    const data: any = await response.json();

    console.log("Results from subdomain check: ")
    console.log(data);

    // Check if any DNS records exist for this subdomain
    const exists = data.result.length > 0;

    return {
      exists,
      records: data.result,
      totalRecords: data.result.length,
    };
  } catch (error) {
    console.error("Error checking DNS record:", error);
    throw error;
  }
};

export async function purgeCache(c: Context, domain: string) {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${c.env.ZONE_ID}/purge_cache`, {
      method: "POST", 
      headers: {
        Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hosts: [
          `https://${domain}/*`
        ]
      })
    })
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    // throw error;
  }
}

export const RESTRICTED_SUBDOMAINS = new Set([
  // System and security related
  "admin",
  "administrator",
  "root",
  "system",
  "sys",
  "security",
  "secure",
  "ssl",
  "certbot",
  "letsencrypt",
  "plesk",
  "cpanel",
  "whm",
  "webmail",
  "mail",
  "email",
  "smtp",
  "pop",
  "pop3",
  "imap",
  "app",

  // Authentication related
  "login",
  "signin",
  "signup",
  "register",
  "auth",
  "oauth",
  "sso",
  "saml",
  "accounts",
  "profile",
  "password",

  // Common service names
  "api",
  "api-docs",
  "docs",
  "status",
  "health",
  "staging",
  "test",
  "dev",
  "development",
  "prod",
  "production",
  "beta",
  "alpha",
  "demo",
  "internal",
  "localhost",

  // Infrastructure related
  "ns",
  "ns1",
  "ns2",
  "nameserver",
  "dns",
  "ftp",
  "sftp",
  "ssh",
  "vpn",
  "proxy",
  "cdn",
  "assets",
  "static",
  "media",
  "images",
  "database",
  "redis",
  "elasticsearch",
  "mongo",

  // Common website sections
  "www",
  "web",
  "site",
  "blog",
  "shop",
  "store",
  "support",
  "help",
  "faq",
  "kb",
  "wiki",
  "portal",
  "dashboard",
  "analytics",
  "stats",

  // Payment and billing
  "billing",
  "payment",
  "checkout",
  "cart",
  "paypal",
  "stripe",
  "invoice",

  // Common protocols and services
  "http",
  "https",
  "wss",
  "ws",
  "git",
  "svn",
  "jenkins",
  "ci",
  "build",
]);

export const validateSubdomain = (subdomain: string) => {
  // Convert to lowercase for consistent checking
  const normalizedSubdomain = subdomain.toLowerCase().trim();

  const validation: SubdomainValidation = {
    isValid: true,
    errors: [],
  };

  // Check if subdomain is in restricted list
  if (RESTRICTED_SUBDOMAINS.has(normalizedSubdomain)) {
    validation.isValid = false;
    validation.errors.push("This subdomain name is restricted");
  }

  // Check length constraints
  if (normalizedSubdomain.length < 3) {
    validation.isValid = false;
    validation.errors.push("Subdomain must be at least 3 characters long");
  }

  if (normalizedSubdomain.length > 63) {
    validation.isValid = false;
    validation.errors.push("Subdomain must be less than 64 characters long");
  }

  // Check for valid characters (RFC 1035)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalizedSubdomain)) {
    validation.isValid = false;
    validation.errors.push(
      "Subdomain can only contain lowercase letters, numbers, and hyphens. " +
        "It must start and end with a letter or number"
    );
  }

  // Check for consecutive hyphens (often used in special DNS records)
  if (normalizedSubdomain.includes("--")) {
    validation.isValid = false;
    validation.errors.push("Subdomain cannot contain consecutive hyphens");
  }

  // Check for common deceptive patterns
  const deceptivePatterns = [
    /paypal/i,
    /google/i,
    /microsoft/i,
    /apple/i,
    /amazon/i,
    /facebook/i,
    /instagram/i,
    /twitter/i,
    /netflix/i,
    /login/i,
    /signin/i,
    /security/i,
    /support/i,
    /account/i,
    /update/i,
    /verify/i,
    /wallet/i,
  ];

  for (const pattern of deceptivePatterns) {
    if (pattern.test(normalizedSubdomain)) {
      validation.isValid = false;
      validation.errors.push(
        "This subdomain name is not allowed as it may be misleading"
      );
      break;
    }
  }

  return validation;
};
