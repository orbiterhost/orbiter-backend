import { Hex } from "viem";
import { ACTIONS } from "./constants";

export type Bindings = {
  ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  RECAPTCHA_SECRET_KEY: string;
  RECAPTCHA_SITE_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PINATA_JWT: string;
  PINATA_GATEWAY: string;
  ORBITER_SITES: KVNamespace;
  SITE_PLANS: KVNamespace;
  SITE_CONTRACT: KVNamespace;
  SITE_TO_ORG: KVNamespace;
  CONTRACT_ADDRESS: string;
  ORBITER_PRIVATE_KEY: string;
  CHANNEL_ID: string;
  SLACK_TOKEN: string;
  SLACK_SITES_CHANNEL_ID: string;
  SLACK_SUBSCRIPTIONS_CHANNEL_ID: string;
  HOST_ZONE_ID: string;
  NGINX_SERVER_TOKEN: string;
  NGINX_IP: string;
  STRIPE_KEY: string;
  SITE_DOMAIN: string;
  ENDPOINT_SECRET: string;
  NGINX_SERVER_URL: string;
  ORBITER_WALLET_ADDRESS: string;
  LOOP_ENDPOINT_SECRET: string;
  LOOP_TEST_ENDPOINT_SECRET: string;
  SUPABASE_WEBHOOK_SECRET: string;
  LOOPS_API_KEY: string;
  ENS_SIGNER: Hex;
  RESOLVER_ADDRESS: Hex;
  ORBITER_ANALYTICS_TOKEN: string;
  LAUNCH_MONTHLY_PRICE_ID: string;
  LAUNCH_YEARLY_PRICE_ID: string;
  ORBIT_MONTHLY_PRICE_ID: string;
  ORBIT_YEARLY_PRICE_ID: string;
};

export type Organization = {
  id: string;
  created_at: string;
  name: string;
  owner_id: string;
  stripe_customer_id?: string;
};

export type Membership = {
  id: number;
  created_at: string;
  role: string;
  user_id: string;
  organization_id: string;
  organizations?: Organization[];
  users?: User;
};

export type Site = {
  id: string;
  created_at: string;
  organization_id: string;
  cid: string;
  domain: string;
  site_contract: string;
  updated_at?: string;
  custom_domain?: string;
  domain_ownership_verified?: boolean;
  ssl_issued?: boolean;
  ens?: string;
  resolverSet?: boolean;
};

export type SubdomainValidation = {
  isValid: boolean;
  errors: any[];
};

export type SiteLimits = {
  free: number;
  launch: number;
  orbit: number;
};

export type SessionResponse = {
  type: string;
  url: string;
};

export type SiteVersions = {
  id: string;
  site_id: string;
  created_at: string;
  organization_id: string;
  cid: string;
  domain: string;
  site_contract: string;
  version_number: number;
  deployed_by: string;
};

export type SiteVersionLookupType = {
  field: "site_id" | "domain";
  value: string;
};

export type User = {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceActions = (typeof ACTIONS)[keyof typeof ACTIONS];

export type Invite = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  email: string;
  invite_email: string;
  role: string;
  status: string;
  first_name: string;
  last_name: string;
  organizations?: Organization
};

export type Key = {
  id: string;
  created_at: string;
  key_name: string;
  organization_id: string;
  key_hash: string;
  scope: string;
  organizations?: Organization;
}

export interface PlanMapping {
  [key: string]: "orbit" | "launch";
}