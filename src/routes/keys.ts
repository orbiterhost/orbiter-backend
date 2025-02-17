import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import { verifyRecaptcha } from "../middleware/captcha";
import { generateOneTimeKey } from "../utils/pinata";
import { createApiKey, deleteApiKey, getApiKeysByOrgId } from "../utils/db/keys";
import { ACTIONS, SCOPES } from "../utils/constants";
import { canMemberTakeAction, getOrgMemberStatus } from "../middleware/accessControls";
import { generateApiKey, hashApiKey } from "../utils/apiKeys";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/", async (c) => {
  try {
    const offsetQuery = c.req.query("offset");
    const offset = offsetQuery ? parseInt(offsetQuery, 10) : 0;

    const { isAuthenticated, user, organizationData } = await getUserSession(
      c
    );

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user ? user.user_metadata.orgId : organizationData.id;

    const keys = await getApiKeysByOrgId(c, orgId, offset);
    return c.json({
      data: keys,
      nextOffset: keys.length === 10 ? offset + 10 : null,
    });
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const { name, scope } = await c.req.json();
    console.log({ name, scope });
    if (!name || !SCOPES.includes(scope)) {
      return c.json({ message: "Invalid name or scope" }, 400);
    }
    const { isAuthenticated, user, organizationData } = await getUserSession(
      c
    );

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user ? user.user_metadata.orgId : organizationData.id;

    if (organizationData) {
      if (orgId !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
      const allowed = canMemberTakeAction(
        organizationData.scope.toUpperCase(),
        ACTIONS.CREATE_API_KEY
      );
      if (!allowed) {
        return c.json(
          { message: "Only owners and admins can create API keys" },
          401
        );
      }
    }

    if (user) {
      const userData = await getOrgMemberStatus(c, orgId, user.id);
      const allowed = canMemberTakeAction(
        userData.role,
        ACTIONS.CREATE_API_KEY
      );
      if (!allowed) {
        return c.json(
          { message: "Only owners and admins can create API keys" },
          401
        );
      }
    }

    const key = await generateApiKey();
    const hashedKey = await hashApiKey(key);

    await createApiKey(c, orgId, name, scope, hashedKey);
    return c.json(
      {
        name,
        scope,
        apiKey: key,
      },
      200
    );
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.delete("/:keyId", async (c) => {
  try {
    const keyId = c.req.param("keyId");

    const { isAuthenticated, user, organizationData } = await getUserSession(
      c
    );

    if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user ? user.user_metadata.orgId : organizationData.id;

    if (organizationData) {
      if (orgId !== organizationData.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }
      const allowed = canMemberTakeAction(
        organizationData.scope,
        ACTIONS.CREATE_API_KEY
      );
      if (!allowed) {
        return c.json(
          { message: "Only owners and admins can delete API keys" },
          401
        );
      }
    }

    if (user) {
      const userData = await getOrgMemberStatus(c, orgId, user.id);
      const allowed = canMemberTakeAction(
        userData.role,
        ACTIONS.CREATE_API_KEY
      );
      if (!allowed) {
        return c.json(
          { message: "Only owners and admins can create API keys" },
          401
        );
      }
    }

    await deleteApiKey(c, keyId);
    return c.json({ message: "Success" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/upload_key", async (c) => {
  try {    
    const { token } = await c.req.json();
    let userId = "";
    if (!token) {
      console.log("HERE")
      const { isAuthenticated, user, organizationData } =
        await getUserSession(c);

      if (!isAuthenticated || (!user?.id && !organizationData?.id)) {
        console.log("Unauthorized - no user found or unauthenticated");
        return c.json({ message: "Unauthorized" }, 401);
      }
      userId = user ? user.id : organizationData?.orgOwner!;
    } else {
      const verified = await verifyRecaptcha(c.env, token);
      if (!verified) {
        return c.json({ message: "Unauthorized" }, 401);
      }
    }

    const JWT = await generateOneTimeKey(c);

    return c.json({ data: JWT }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
