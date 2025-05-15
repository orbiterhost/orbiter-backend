import { Context } from "hono";
import { PinataSDK } from "pinata-web3";

export const generateOneTimeKey = async (c: Context) => {
  const pinata = new PinataSDK({
    pinataJwt: c.env.PINATA_JWT,
    pinataGateway: c.env.PINATA_GATEWAY,
  });

  const key = await pinata.keys.create({
    keyName: Date.now().toString(),
    permissions: {
      endpoints: {
        pinning: {
          pinFileToIPFS: true,
          pinJSONToIPFS: true,
        },
      },
    },
  });

  const { JWT } = key;
  return JWT;
};

export const getSiteData = async (c: Context, cid: string) => {
  try {
    const pinata = new PinataSDK({
      pinataJwt: c.env.PINATA_JWT,
      pinataGateway: c.env.PINATA_GATEWAY,
    });
    console.log(cid);
    const data = await pinata.gateways.get(cid);
    console.log(data)
    return data.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const getRedirectsFile = async (c: Context, cid: string) => {
  try {
    const data = await fetch(`https://${c.env.PINATA_GATEWAY}/ipfs/${cid}/_redirects`);
    if (!data.ok) {
      console.log(`Failed to fetch _redirects file: ${data.status} ${data.statusText}`);
      return null;
    }
    const text = await data.text();    
    return text;
  } catch (error) {
    console.log(error);
    return null;
  }
}
