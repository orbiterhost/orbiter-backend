import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { canModifySite } from "../middleware/accessControls";
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

    const scriptName = siteInfo.id; //generateWorkerScriptName(siteId, organizationId, name);

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
    const workerKey = `worker:${siteInfo.domain}`;
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

// **FIXED: Get workers using dispatch namespace API**
app.get("/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");
    const organizationId = user
      ? user.user_metadata.orgId
      : organizationData.id;

    // Check site access
    const site = await c.env.DB.prepare(
      "SELECT * FROM sites WHERE id = ? AND organization_id = ?"
    )
      .bind(siteId, organizationId)
      .first();

    if (!site) {
      return c.json({ message: "Site not found or unauthorized" }, 404);
    }

    // **FIXED: Get scripts from dispatch namespace using tags**
    const scriptsURI = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${c.env.DISPATCH_NAMESPACE_NAME}/scripts`;

    const scriptsResponse = await fetch(
      `${scriptsURI}?tags=${organizationId}:yes,${siteId}:yes`,
      {
        headers: {
          Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!scriptsResponse.ok) {
      throw new Error("Failed to fetch scripts from dispatch namespace");
    }

    const scriptsData = (await scriptsResponse.json()) as {
      result: Array<{ id: string; created_on: string; modified_on: string }>;
    };
    const workers = scriptsData.result || [];

    // Enhance with local metadata
    const workerDetails = await Promise.all(
      workers.map(async (worker: any) => {
        const workerKey = `worker:${siteId}:${worker.id}`;
        const metadata = await c.env.FUNCTIONS.get(workerKey);

        return {
          id: worker.id,
          name: worker.id,
          created_on: worker.created_on,
          modified_on: worker.modified_on,
          isDeployed: true,
          dispatchUrl: `https://your-dispatch-worker.your-domain.workers.dev/dispatch/${worker.id}`,
          ...(metadata && JSON.parse(metadata)),
        };
      })
    );

    return c.json({ data: workerDetails }, 200);
  } catch (error) {
    console.error("Error fetching workers:", error);
    return c.json(
      {
        error: {
          code: "fetch_workers_failed",
          message: "Failed to fetch workers",
        },
      },
      500
    );
  }
});

// **FIXED: Delete from dispatch namespace**
app.delete("/:siteId/:workerName", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { siteId, workerName } = c.req.param();
    const organizationId = user
      ? user.user_metadata.orgId
      : organizationData.id;

    // Check site access
    const site = await c.env.DB.prepare(
      "SELECT * FROM sites WHERE id = ? AND organization_id = ?"
    )
      .bind(siteId, organizationId)
      .first();

    if (!site) {
      return c.json({ message: "Site not found or unauthorized" }, 404);
    }

    // Get the deployed script name
    const workerKey = `worker:${siteId}:${workerName}`;
    const workerData = await c.env.FUNCTIONS.get(workerKey);

    if (!workerData) {
      return c.json({ message: "Worker not found" }, 404);
    }

    const metadata = JSON.parse(workerData) as WorkerMetadata;

    // **FIXED: Delete from dispatch namespace**
    const scriptsURI = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${c.env.DISPATCH_NAMESPACE_NAME}/scripts`;

    const deleteResponse = await fetch(
      `${scriptsURI}/${metadata.deployedName}`,
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
      throw new Error(`Failed to delete worker: ${errorText}`);
    }

    // Delete from KV
    await c.env.FUNCTIONS.delete(workerKey);

    return c.json({ message: "Worker deleted successfully" }, 200);
  } catch (error) {
    console.error("Error deleting worker:", error);
    return c.json(
      {
        error: {
          code: "delete_worker_failed",
          message:
            error instanceof Error ? error.message : "Failed to delete worker",
        },
      },
      500
    );
  }
});

export default app;
