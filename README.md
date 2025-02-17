## Orbiter Backend

The Orbiter API is a collection of RESTful endpoints that power all of the website hosting functionalities for Orbiter. Contributions are welcome. [Please see the API docs here](https://docs.orbiter.host).

### Running the API locally

In order to run the API locally, you need Node.js v20 or higher. Then, follow the steps below: 

1. `git clone https://github.com/orbiterhost/orbiter-backend`
2. `cd orbiter-backend`
3. `npm i`

You will need to create a `wrangler.toml` file in the root of the project and fill out the following variables: 

```
name = "orbiter-backend"
main = "src/index.ts"
compatibility_date = "2024-12-23"

compatibility_flags = [ "nodejs_compat" ]

[vars]
RECAPTCHA_SITE_KEY = "" // Get from Google Recaptcha setup
RECAPTCHA_SECRET_KEY = "" //Get from Google recaptcha setup
ZONE_ID = "" // Cloudflare Zone ID associated with the worker you will be using to power this API
HOST_ZONE_ID = "" // Get from Cloudflare
CLOUDFLARE_API_TOKEN = "" // Get from Cloudflare
SUPABASE_URL = "" 
SUPABASE_SERVICE_ROLE_KEY = ""
PINATA_JWT = ""
PINATA_GATEWAY = ""
CHANNEL_ID = "" //  Slack Channel ID for malicioud content updates
SLACK_TOKEN = ""
SLACK_SITES_CHANNEL_ID = "" // Slack Channel ID for site updates
SLACK_SUBSCRIPTIONS_CHANNEL_ID = "" //  Slack Channel ID for billing updates
ORBITER_WALLET_ADDRESS = "" // EVM wallet address for smart contract management
CONTRACT_ADDRESS = "" // IPCM contract factory address
ORBITER_PRIVATE_KEY= "" //  Private key for the EVM wallet
NGINX_SERVER_TOKEN= "" // Auth token to protect NGINX server access
NGINX_SERVER_URL = ""
NGINX_IP = ""
SITE_DOMAIN = ""
STRIPE_KEY= ""
ENDPOINT_SECRET = "" // Webhook secret for Stripe
LOOP_ENDPOINT_SECRET = "" //   Webhook secret for Loop
LOOPS_API_KEY = ""
ENS_SIGNER = "" // EVM private key signer for ENS updates
RESOLVER_ADDRESS = "" //    ENS Resolver Contract address
ORBITER_ANALYTICS_TOKEN = "" // Auth token to protect analytics server
LAUNCH_MONTHLY_PRICE_ID = ""
LAUNCH_YEARLY_PRICE_ID = ""
ORBIT_MONTHLY_PRICE_ID = ""
ORBIT_YEARLY_PRICE_ID = ""

[[kv_namespaces]]
binding = "ORBITER_SITES"
id = ""

[[kv_namespaces]]
binding = "SITE_PLANS"
id = ""

[[kv_namespaces]]
binding = "SITE_TO_ORG"
id = ""
```

To get the IDs for the `kv_namespaces` you will need to use the Cloudflare Wrangler CLI to initialize the KV. [See the docs here](https://developers.cloudflare.com/kv/get-started/). 

To run the API once you've completed the above, simply enter the following command: 

```
npm run dev
```

