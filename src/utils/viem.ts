import {
  createWalletClient,
  http,
  createPublicClient,
  decodeEventLog,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { orbiterFactory, orbiterContract } from "./contracts";
import { Context } from "hono";

type EventLogs = {
  eventName: string;
  args: {
    cloneAddress: string;
  };
};

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function createContract(
  c: Context,
): Promise<EventLogs | undefined> {
  const account = privateKeyToAccount(c.env.ORBITER_PRIVATE_KEY as "0x");

  const walletClient = createWalletClient({
    chain: base,
    transport: http(c.env.BASE_ALCHEMY_URL),
    account: account,
  });
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: c.env.CONTRACT_ADDRESS as "0x",
      abi: orbiterFactory.abi,
      functionName: "createOrbiterSite",
    });
    const tx = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
    });
    if (receipt.status !== "success") {
      throw Error("TX not confirmed");
    }

    const logs = decodeEventLog({
      abi: orbiterFactory.abi,
      data: receipt.logs[1].data,
      topics: receipt.logs[1].topics,
    });

    return logs as unknown as EventLogs;
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

export async function writeCID(
  c: Context,
  cid: string,
  contractAddress: `0x${string}`,
): Promise<string | unknown> {
  try {
    const account = privateKeyToAccount(c.env.ORBITER_PRIVATE_KEY as "0x");
    const walletClient = createWalletClient({
      chain: base,
      transport: http(),
      account: account,
    });
    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: orbiterContract.abi,
      functionName: "updateMapping",
      args: [cid],
    });
    const tx = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
    });
    if (receipt.status !== "success") {
      throw Error("TX not confirmed");
    }
    return receipt.status;
  } catch (error) {
    console.log(error);
    return error;
  }
}

export const getWalletBalance = async (c: Context) => {
  try {
    const balance = await publicClient.getBalance({
      address: c.env.ORBITER_WALLET_ADDRESS,
    });

    const balanceAsEther = formatEther(balance)
    const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD');
    const data: any = await response.json();

    let ethUsd = "0"

    if (data && data.result) {
      ethUsd = data.result.XETHZUSD.o
    }

    return {
      eth: balanceAsEther,
      usd: (parseFloat(ethUsd) * parseFloat(balanceAsEther)).toFixed(2)
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}
