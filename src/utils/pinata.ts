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
