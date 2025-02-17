import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings, Membership } from "../utils/types";
import { getUserSession } from "../middleware/auth";
import {
  acceptInvite,
  addInvite,
  addUserToOrg,
  getInviteById,
  getInviteByOrgAndUser,
  getInvitesByOrgId,
  removeInvite,
} from "../utils/db/users";
import {
  canMemberTakeAction,
  getOrgMemberStatus,
} from "../middleware/accessControls";
import { ACTIONS } from "../utils/constants";
import { sendTransactionalEmail } from "../utils/loopsEmail";
import {
  getMembersForOrg,
  getOrganizationById,
  removeMember,
} from "../utils/db/organizations";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get("/", async (c) => {
  try {
    const offset = c.req.query("offset");
    const offsetToUse = offset ? parseInt(offset, 10) : 0;
    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user.user_metadata.orgId;

    //  Verify user is a member of the org in question
    const member = await getOrgMemberStatus(c, orgId, user?.id);
    if (!member?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    //  Get the member list with pagination
    const members = await getMembersForOrg(c, orgId, offsetToUse);

    const invites = await getInvitesByOrgId(c, orgId);

    return c.json({
      data: {
        members: members.map((m: Membership) => {
          return {
            id: m.id,
            created_at: m.created_at,
            organization_id: m.organization_id,
            role: m.role,
            user: {
              name: m?.users?.display_name,
              email: m?.users?.email,
              avatar: m?.users?.avatar_url,
              id: m?.users?.id,
            },
          };
        }),
        invites: invites,
      },
    });
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/invite", async (c) => {
  try {
    const inviteEmailId = "cm685uyyr00uq80roz9ddea2r"; //  Hardcoding this as it shouldn't change often

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user.user_metadata.orgId;

    const organization = await getOrganizationById(c, orgId);

    const { email, firstName, lastName, role } = await c.req.json();

    if (!email || !firstName || !lastName || !role) {
      return c.json(
        { message: "email, firstName, lastName, and role are required" },
        400
      );
    }

    //  Verify user is a member of the org in question
    const member = await getOrgMemberStatus(c, orgId, user?.id);

    if (!member?.id) {
      console.log("No member id");
      return c.json({ message: "Unauthorized" }, 401);
    }

    //  Only admins and owners can add members
    if (!canMemberTakeAction(member.role, ACTIONS.ADD_WORKSPACE_MEMBER)) {
      return c.json(
        { message: "The MEMBER role cannot add users to an organization" },
        400
      );
    }

    //  Now make sure there isn't already a pending invite:
    const pendingInvite = await getInviteByOrgAndUser(c, orgId, email);
    if (pendingInvite && pendingInvite.id) {
      return c.json(
        { message: "This email address has already been invited" },
        400
      );
    }

    //  Add to invites table
    const inviteResult = await addInvite(
      c,
      email,
      firstName,
      lastName,
      role.toUpperCase(),
      user?.id,
      orgId
    );

    const postBody = JSON.stringify({
      transactionalId: inviteEmailId,
      email,
      dataVariables: {
        first_name: firstName,
        org_name: organization.name,
        invite_id: inviteResult.id,
      },
    });

    await sendTransactionalEmail(c, postBody);

    return c.json({ data: "Success!" });
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.delete("/:memberId", async (c) => {
  try {
    const memberId = c.req.param("memberId");

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user.user_metadata.orgId;

    //  Verify user is a member of the org in question
    const member = await getOrgMemberStatus(c, orgId, user.id);
    if (!member?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const memberToRemove = await getOrgMemberStatus(c, orgId, memberId);

    //  Only admins and owners can remove members
    if (!canMemberTakeAction(member.role, ACTIONS.REMOVE_WORKSPACE_MEMBER)) {
      return c.json(
        { message: "The MEMBER role cannot remove users from an organization" },
        400
      );
    }
    //  Check to verify that the owner is not being removed
    if (memberToRemove.role === "OWNER") {
      return c.json(
        { message: "The OWNER role cannot be removed from an organization" },
        400
      );
    }

    await removeMember(c, orgId, memberId);

    return c.json({ data: "Success!" });
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.get("/invites/:inviteId", async (c) => {
  try {
    const inviteId = c.req.param("inviteId");

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const inviteData = await getInviteById(c, inviteId);

    return c.json(
      {
        data: {
          id: inviteData.id,
          organization_id: inviteData.organization_id,
          organization_name: inviteData?.organizations?.name,
          role: inviteData.role,
        },
      },
      200
    );
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/invites/:inviteId", async (c) => {
  try {
    const inviteId = c.req.param("inviteId");

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const inviteData = await acceptInvite(c, inviteId);
    await addUserToOrg(c, user.id, inviteData.organization_id, inviteData.role);

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.delete("/invites/:inviteId", async (c) => {
  try {
    const inviteId = c.req.param("inviteId");

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    await removeInvite(c, inviteId);

    return c.json({ message: "Success!" }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

app.post("/resend_invite/:inviteId", async (c) => {
  try {
    const inviteEmailId = "cm685uyyr00uq80roz9ddea2r"; //  Hardcoding this as it shouldn't change often

    const inviteId = c.req.param("inviteId");

    const { isAuthenticated, user } = await getUserSession(c);
    if (!isAuthenticated || !user?.id) {
      console.log("Unauthorized - no user found or unauthenticated");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const orgId = user.user_metadata.orgId;
    const organization = await getOrganizationById(c, orgId);

    const inviteDetails = await getInviteById(c, inviteId);
    console.log(inviteDetails);
    //  Verify user is a member of the org in question
    const member = await getOrgMemberStatus(c, orgId, user.id);

    if (!member?.id) {
      console.log("No member id");
      return c.json({ message: "Unauthorized" }, 401);
    }

    const postBody = JSON.stringify({
      transactionalId: inviteEmailId,
      email: inviteDetails.invite_email,
      dataVariables: {
        first_name: inviteDetails.first_name,
        org_name: organization.name,
        invite_id: inviteDetails.id,
      },
    });

    await sendTransactionalEmail(c, postBody);

    return c.json({ data: "Success!" });
  } catch (error) {
    console.log(error);
    return c.json({ message: "Server error" }, 500);
  }
});

export default app;
