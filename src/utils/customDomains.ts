import { Context } from "hono";

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
        connection: 'upgrade',
        host: 'lb.orbiter.host',        
        'x-forwarded-proto': 'https',
        'content-type': 'application/json',
        authorization: `Bearer ${c.env.NGINX_SERVER_TOKEN}`,
        'user-agent': 'PostmanRuntime/7.43.0',
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br'
      },
      body: JSON.stringify({
        subdomain: subdomain,
        domain: customDomain,
      })
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
  console.log({customDomain})
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

    if(!res.ok) {
      console.log({
        status: res.status, 
        text: res.statusText
      })

      console.log(await res.json());
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

//  This is an ownership check. It verifies that the user owns the custom domain by checking that the A record is set
export const verifyDomainOwnership = async (c: Context, customDomain: string) => {
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
