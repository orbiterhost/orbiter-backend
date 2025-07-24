import { Context } from "hono";
import {
  Bindings,
  CloudflareApiResponse,
  CloudflareCustomHostname,
  CloudflareWorkerRoute,
} from "./types";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export const issueSSLCertAndProxyCustomDomain = async (
  c: Context,
  subdomain: string,
  customDomain: string
) => {
  try {
    console.log("Issuing cert..");
    console.log({
      customDomain,
      subdomain,
      // Removed token logging for security
    });

    const requestInit = {
      method: "POST",
      headers: {
        connection: "upgrade",
        host: "lb.orbiter.host",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
        authorization: `Bearer ${c.env.NGINX_SERVER_TOKEN}`,
        "user-agent": "PostmanRuntime/7.43.0",
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br",
      },
      body: JSON.stringify({
        subdomain: subdomain,
        domain: customDomain,
      }),
    };

    const url = `${c.env.NGINX_SERVER_URL}/custom-domains`;
    const res = await fetch(url, requestInit);

    console.log("Initial response:", {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      url: res.url,
    });

    if (res.status === 301 || res.status === 302) {
      const redirectUrl = res.headers.get("location");
      console.log("Following redirect to:", redirectUrl);

      const redirectRes = await fetch(redirectUrl!, requestInit);
      console.log("Redirect response:", {
        status: redirectRes.status,
        statusText: redirectRes.statusText,
        headers: redirectRes.headers,
        url: redirectRes.url,
      });

      if (!redirectRes.ok) {
        const errorText = await redirectRes.text();
        throw new Error(
          `HTTP error! status: ${redirectRes.status}, message: ${errorText}`
        );
      }

      const successMessage = await redirectRes.json();
      console.log({ successMessage });
      return successMessage;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `HTTP error! status: ${res.status}, message: ${errorText}`
      );
    } else {
      console.log("Cert issued!");
      const successMessage = await res.json();
      console.log({ successMessage });
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const removeSSLCertAndProxyForDomain = async (
  c: Context,
  customDomain: string
) => {
  console.log({ customDomain });
  try {
    const res = await fetch(`${c.env.NGINX_SERVER_URL}/custom-domains`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${c.env.NGINX_SERVER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: customDomain,
      }),
    });

    if (!res.ok) {
      console.log({
        status: res.status,
        text: res.statusText,
      });

      console.log(await res.json());
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

//  This is an ownership check. It verifies that the user owns the custom domain by checking that the A record is set
export const verifyDomainOwnership = async (
  c: Context,
  customDomain: string
) => {
  try {
    const aResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${customDomain}&type=A`,
      {
        headers: {
          accept: "application/dns-json",
        },
      }
    );

    const aData: any = await aResponse.json();
    console.log(aData);
    const validARecord = aData.Answer?.some(
      (record: any) =>
        record.type === 1 && // A record type
        record.data === c.env.NGINX_IP // Our IP address for the nginx server
    );

    if (validARecord) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("DNS lookup failed:", error);
    return false;
  }
};

export async function createCloudflareCustomHostname(
  domain: string,
  env: Bindings
): Promise<CloudflareCustomHostname> {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${env.ZONE_ID}/custom_hostnames`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_PROXY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hostname: domain,
        ssl: {
          method: "http",
          type: "dv",
          settings: {
            http2: "on",
            min_tls_version: "1.2",
            tls_1_3: "on",
            early_hints: "on",
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare API error: ${error}`);
  }

  const result =
    (await response.json()) as CloudflareApiResponse<CloudflareCustomHostname>;

  if (!result.success) {
    throw new Error(
      `Cloudflare error: ${result.errors?.[0]?.message || "Unknown error"}`
    );
  }

  return result.result;
}

export async function createWorkerRoute(
  domain: string,
  env: Bindings
): Promise<CloudflareWorkerRoute> {
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${env.ZONE_ID}/workers/routes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_PROXY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pattern: `${domain}/*`,
        script: env.WORKER_NAME,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker route creation error: ${error}`);
  }

  const result =
    (await response.json()) as CloudflareApiResponse<CloudflareWorkerRoute>;

  if (!result.success) {
    throw new Error(
      `Worker route error: ${result.errors?.[0]?.message || "Unknown error"}`
    );
  }

  return result.result;
}

export async function getCustomHostnameStatus(customHostnameId: string, env: Bindings): Promise<CloudflareCustomHostname> {
	const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${env.ZONE_ID}/custom_hostnames/${customHostnameId}`, {
		headers: {
			'Authorization': `Bearer ${env.CLOUDFLARE_PROXY_API_TOKEN}`,
		}
	});
	
	const data = await response.json() as CloudflareApiResponse<CloudflareCustomHostname>;
  console.log(data);
	return data.result;
}

export async function checkSSLValidation(
  customHostnameId: string,
  env: Bindings
): Promise<boolean> {
  console.log(
    `Waiting for SSL validation for custom hostname: ${customHostnameId}`
  );

  const customHostname = await getCustomHostnameStatus(customHostnameId, env);
  const sslStatus = customHostname.ssl.status;

  console.log("SSL status: ", sslStatus)

  if (sslStatus === "active") {
    console.log("SSL validation successful!");
    return true;
  }

  if (sslStatus === "failed") {
    console.log("SSL validation errors:", customHostname.ssl.validation_errors);
    throw new Error(
      `SSL validation failed: ${JSON.stringify(
        customHostname.ssl.validation_errors
      )}`
    );
  }

  return false;
}

export async function deleteWorkerRoute(routeId: string, env: Bindings): Promise<void> {
	const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${env.ZONE_ID}/workers/routes/${routeId}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${env.CLOUDFLARE_PROXY_API_TOKEN}`,
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to delete worker route: ${error}`);
	}
}

export async function deleteCloudflareCustomHostname(customHostnameId: string, env: Bindings): Promise<void> {
	const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${env.ZONE_ID}/custom_hostnames/${customHostnameId}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${env.CLOUDFLARE_PROXY_API_TOKEN}`,
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to delete Cloudflare custom hostname: ${error}`);
	}
}