import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { canCreateFunction, canModifySite } from "../middleware/accessControls";
import { getSiteById } from "../utils/db/sites";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

interface WorkerUpload {
  name: string;
  script: string;
  siteId: string;
  routes?: string[];
  environment?: Record<string, string>;
  bindings?: Array<{
    name: string;
    type:
      | "kv_namespace"
      | "d1_database"
      | "service"
      | "plain_text"
      | "secret_text";
    [key: string]: any;
  }>;
}

interface WorkerMetadata {
  script: string;
  environment: Record<string, string>;
  bindings: Array<any>;
  lastUpdated: string;
  deployedName: string;
}

// Helper function to generate unique worker names for Workers for Platforms
function generateWorkerScriptName(
  siteId: string,
  organizationId: string,
  workerName: string
): string {
  return `${organizationId}-${siteId}-${workerName}`.replace(
    /[^a-zA-Z0-9-]/g,
    "-"
  );
}

// Upload and deploy a new worker using Workers for Platforms
app.post("/deploy/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const body = (await c.req.json()) as WorkerUpload;
    const { script, environment, bindings } = body;

    const siteId = c.req.param("siteId");

    if (!script || typeof script !== "string") {
      return c.json({ message: "Invalid worker script" }, 400);
    }

    const organizationId = user
      ? user.user_metadata.orgId
      : organizationData.id;

    // Verify site access
    let siteInfo: any;
    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user.id);
    }

    if (!canCreateFunction(c, organizationId)) {
      return c.json(
        { message: "You must be on a paid plan to create functions" },
        401
      );
    }

    const scriptName = siteInfo.domain.split(".")[0]; //generateWorkerScriptName(siteId, organizationId, name);

    console.log("=== DEPLOYING WORKER TO DISPATCH NAMESPACE ===");
    console.log("Account ID:", c.env.CLOUDFLARE_ACCOUNT_ID);
    console.log("Dispatch Namespace:", c.env.DISPATCH_NAMESPACE_NAME);
    console.log("Script Name:", scriptName);

    // **FIXED: Use correct Workers for Platforms API endpoint**
    const scriptsURI = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${c.env.DISPATCH_NAMESPACE_NAME}/scripts`;

    // **FIXED: Prepare FormData in the correct format**
    const formData = new FormData();

    // The script filename (extension matters for module type)
    const scriptFileName = `${scriptName}.mjs`;

    // **FIXED: Proper metadata structure**
    const metadata = {
      main_module: scriptFileName,
      // Add bindings if provided
      ...(bindings && bindings.length > 0 && { bindings }),
      // Add compatibility date
      compatibility_date: "2024-06-01",
    };

    formData.append(
      "metadata",
      new File([JSON.stringify(metadata)], "metadata.json", {
        type: "application/json",
      })
    );

    // **FIXED: Add script as ES module**
    formData.append(
      scriptFileName,
      new File([script], scriptFileName, {
        type: "application/javascript+module",
      })
    );

    // Optional: Add platform modules (like in the example)
    const platformModuleContent =
      'const platformThing = "This module is provided by the platform"; export { platformThing };';
    formData.append(
      "platform_module.mjs",
      new File([platformModuleContent], "platform_module.mjs", {
        type: "application/javascript+module",
      })
    );

    console.log("Uploading to:", `${scriptsURI}/${scriptName}`);

    // **FIXED: Use correct API call**
    const deploymentResponse = await fetch(`${scriptsURI}/${scriptName}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        // Don't set Content-Type for FormData - let browser set it automatically
      },
      body: formData,
    });

    if (!deploymentResponse.ok) {
      const errorText = await deploymentResponse.text();
      console.error("Deployment failed:", errorText);
      throw new Error(`Failed to deploy worker: ${errorText}`);
    }

    const successResponse = await deploymentResponse.json();
    console.log("=== DEPLOYMENT SUCCEEDED ===");
    console.log("Response:", successResponse);

    // **OPTIONAL: Add script tags for organization (like in example)**
    if (organizationId) {
      try {
        const tagsResponse = await fetch(`${scriptsURI}/${scriptName}/tags`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([organizationId, siteInfo.domain]),
        });

        if (!tagsResponse.ok) {
          console.warn("Failed to add tags:", await tagsResponse.text());
        }
      } catch (tagError) {
        console.warn("Error adding tags:", tagError);
      }
    }

    // Store metadata in KV
    const workerKey = `worker:${siteInfo.domain.split(".")[0]}`;
    const workerMetadata: WorkerMetadata = {
      script,
      environment: environment || {},
      bindings: bindings || [],
      lastUpdated: new Date().toISOString(),
      deployedName: scriptName,
    };

    await c.env.FUNCTIONS.put(workerKey, JSON.stringify(workerMetadata));

    const siteHostname = siteInfo.custom_domain || siteInfo.domain;
    const apiUrl = `https://${siteHostname}/_api`;

    return c.json(
      {
        message: "API worker deployed successfully",
        data: {
          siteId,
          scriptName,
          apiUrl, // This is the correct URL where their API is accessible
          apiEndpoint: "/_api", // The base endpoint path
          lastUpdated: new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    console.error("=== WORKER DEPLOYMENT ERROR ===");
    console.error("Error details:", error);

    return c.json(
      {
        error: {
          code: "worker_deployment_failed",
          message:
            error instanceof Error ? error.message : "Failed to deploy worker",
        },
      },
      500
    );
  }
});

app.get("/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");

    // Verify site access
    let siteInfo: any;
    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user.id);
    }

    const scriptName = siteInfo.domain.split(".")[0];
    const scriptsURI = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${c.env.DISPATCH_NAMESPACE_NAME}/scripts`;

    const workerResponse = await fetch(`${scriptsURI}/${scriptName}`, {
      headers: {
        Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (!workerResponse.ok) {
      if (workerResponse.status === 404) {
        // No worker deployed for this site
        return c.json(
          {
            data: [],
            meta: {
              siteId,
              siteDomain: siteInfo.domain,
              scriptName,
              message: "No API function deployed for this site",
            },
          },
          200
        );
      }

      const errorText = await workerResponse.text();
      console.error("Failed to fetch worker:", errorText);
      throw new Error(`Failed to fetch worker: ${errorText}`);
    }

    const workerData: any = await workerResponse.json();

    if(workerData.result.script === null) {
      return c.json({ message: "No API function deployed for this site" }, 404);
    }

    const workerKey = `worker:${scriptName}`;
    const metadata = await c.env.FUNCTIONS.get(workerKey);
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};

    const siteHostname = siteInfo.custom_domain || siteInfo.domain;
    const apiUrl = `https://${siteHostname}/_api`;

    const workerDetail = {
      id: workerData.result.id,
      name: workerData.result.id,
      scriptName: scriptName,
      created_on: workerData.result.created_on,
      modified_on: workerData.result.modified_on,
      etag: workerData.result.etag,
      size: workerData.result.size,
      isDeployed: true,
      apiUrl: apiUrl,
      apiEndpoint: "/_api",
      siteId: siteId,
      siteDomain: siteInfo.domain,
      customDomain: siteInfo.custom_domain,
      ...parsedMetadata, // Include script, environment, bindings, lastUpdated, etc.
    };

    return c.json(
      {
        data: workerDetail,
        meta: {
          siteId,
          siteDomain: siteInfo.domain,
          scriptName,
        },
      },
      200
    );
  } catch (error) {
    console.error("Error fetching worker:", error);
    return c.json(
      {
        error: {
          code: "fetch_worker_failed",
          message:
            error instanceof Error ? error.message : "Failed to fetch worker",
        },
      },
      500
    );
  }
});

app.delete("/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { siteId } = c.req.param();

    // Verify site access
    let siteInfo: any;
    if (organizationData && organizationData.id) {
      siteInfo = await getSiteById(c, siteId);
      if (siteInfo.organization_id !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    } else if (user) {
      siteInfo = await canModifySite(c, siteId, user.id);
    }

    const scriptName = siteInfo.domain.split(".")[0];
    console.log(scriptName);

    // Get the deployed script name
    const workerKey = `worker:${scriptName}`;
    const metadata = await c.env.FUNCTIONS.get(workerKey);
    const parsedMetadata = metadata ? JSON.parse(metadata) : {};    

    const scriptsURI = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${c.env.DISPATCH_NAMESPACE_NAME}/scripts`;

    const deleteResponse = await fetch(
      `${scriptsURI}/${scriptName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      console.error("Delete failed:", errorText);
      throw new Error(`Failed to delete function: ${errorText}`);
    }
    // Delete from KV
    await c.env.FUNCTIONS.delete(workerKey);

    return c.json({ message: "Function deleted successfully" }, 200);
  } catch (error) {
    console.error("Error deleting function:", error);
    return c.json(
      {
        error: {
          code: "delete_worker_failed",
          message:
            error instanceof Error ? error.message : "Failed to delete function",
        },
      },
      500
    );
  }
});

export default app;
