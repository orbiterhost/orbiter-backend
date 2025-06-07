import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { canModifySite } from "../middleware/accessControls";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

interface WorkerUpload {
  name: string;
  script: string;
  siteId: string;
  routes?: string[];
  environment?: Record<string, string>;
}

interface WorkerMetadata {
  script: string;
  routes: string[];
  environment: Record<string, string>;
  lastUpdated: string;
}

// Upload and deploy a new worker
app.post("/deploy", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const body = await c.req.json() as WorkerUpload;
    const { name, script, siteId, routes, environment } = body;

    // Validate the worker script
    if (!script || typeof script !== "string") {
      return c.json({ message: "Invalid worker script" }, 400);
    }

    // Check if user has access to the site
    const site = await c.env.DB.prepare(
      "SELECT * FROM sites WHERE id = ? AND organization_id = ?"
    )
      .bind(siteId, user ? user.user_metadata.orgId : organizationData.id)
      .first();

    if (!site) {
      return c.json({ message: "Site not found or unauthorized" }, 404);
    }

    // Check if user has permission to modify the site
    const canModify = await canModifySite(c, siteId, user?.id || organizationData?.orgOwner || "");
    if (!canModify) {
      return c.json({ message: "Unauthorized to modify this site" }, 403);
    }

    // Store the worker script in KV
    const workerKey = `worker:${siteId}:${name}`;
    const workerMetadata: WorkerMetadata = {
      script,
      routes: routes || [],
      environment: environment || {},
      lastUpdated: new Date().toISOString()
    };
    
    await c.env.WORKERS.put(workerKey, JSON.stringify(workerMetadata));

    // Deploy the worker to Cloudflare
    const deploymentResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${name}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/javascript"
      },
      body: script
    });

    if (!deploymentResponse.ok) {
      throw new Error("Failed to deploy worker to Cloudflare");
    }

    return c.json({
      message: "Worker deployed successfully",
      data: {
        name,
        siteId,
        routes,
        lastUpdated: new Date().toISOString()
      }
    }, 200);

  } catch (error) {
    console.error("Worker deployment error:", error);
    return c.json({
      error: {
        code: "worker_deployment_failed",
        message: "Failed to deploy worker"
      }
    }, 500);
  }
});

// Get all workers for a site
app.get("/:siteId", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const siteId = c.req.param("siteId");

    // Check if user has access to the site
    const site = await c.env.DB.prepare(
      "SELECT * FROM sites WHERE id = ? AND organization_id = ?"
    )
      .bind(siteId, user ? user.user_metadata.orgId : organizationData.id)
      .first();

    if (!site) {
      return c.json({ message: "Site not found or unauthorized" }, 404);
    }

    // List all workers for the site
    const workers = await c.env.WORKERS.list({ prefix: `worker:${siteId}:` });
    
    const workerDetails = await Promise.all(
      workers.keys.map(async (key: { name: string }) => {
        const worker = await c.env.WORKERS.get(key.name);
        return worker ? JSON.parse(worker) as WorkerMetadata : null;
      })
    );

    return c.json({
      data: workerDetails.filter(Boolean)
    }, 200);

  } catch (error) {
    console.error("Error fetching workers:", error);
    return c.json({
      error: {
        code: "fetch_workers_failed",
        message: "Failed to fetch workers"
      }
    }, 500);
  }
});

// Delete a worker
app.delete("/:siteId/:workerName", async (c) => {
  try {
    const { isAuthenticated, user, organizationData } = await getUserSession(c);

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const { siteId, workerName } = c.req.param();

    // Check if user has access to the site
    const site = await c.env.DB.prepare(
      "SELECT * FROM sites WHERE id = ? AND organization_id = ?"
    )
      .bind(siteId, user ? user.user_metadata.orgId : organizationData.id)
      .first();

    if (!site) {
      return c.json({ message: "Site not found or unauthorized" }, 404);
    }

    // Delete from Cloudflare
    const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`
      }
    });

    if (!deleteResponse.ok) {
      throw new Error("Failed to delete worker from Cloudflare");
    }

    // Delete from KV
    await c.env.WORKERS.delete(`worker:${siteId}:${workerName}`);

    return c.json({
      message: "Worker deleted successfully"
    }, 200);

  } catch (error) {
    console.error("Error deleting worker:", error);
    return c.json({
      error: {
        code: "delete_worker_failed",
        message: "Failed to delete worker"
      }
    }, 500);
  }
});

export default app; 