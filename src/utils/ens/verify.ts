import { createPublicClient, http, verifyMessage } from 'viem';
import { mainnet } from 'viem/chains';
import { Context } from 'hono';

type VerificationParams = {
  ensName: string;
  message: string;
  signature: string;
  address: string;
};

export async function verifyENSOwnership(c: Context, params: VerificationParams) {
  try {
    const { ensName, message, signature, address } = params;

    // Create a Viem public client for mainnet
    const client = createPublicClient({
      chain: mainnet,
      transport: http()
    });

    // Get the ENS owner
    const resolvedAddress = await client.getEnsAddress({
      name: ensName,
    });

    if (!resolvedAddress) {
      throw new Error('ENS name not found');
    }

    // Verify the address matches
    if (resolvedAddress.toLowerCase() !== address.toLowerCase()) {
      return false;
    }

    // Verify the signature using viem
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`
    });

    return isValid;

  } catch (error) {
    console.error('ENS verification error:', error);
    return false;
  }
}
