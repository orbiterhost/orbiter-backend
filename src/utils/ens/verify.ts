import { http, createPublicClient, isAddressEqual } from 'viem';
import { mainnet } from 'viem/chains';
import { createEnsPublicClient } from '@ensdomains/ensjs'
import { Context } from 'hono';

type VerificationParams = {
  ensName: string;
  message: string;
  signature: string;
  address: `0x`;
};

export async function verifyENSOwnership(c: Context, params: VerificationParams) {
  try {
    const { ensName, message, signature, address } = params;

    // Create a Viem public client for mainnet
    const publicClient = createEnsPublicClient({
      chain: mainnet,
      transport: http(c.env.ALCHEMY_URL)
    });

    const viemClient = createPublicClient({
      chain: mainnet,
      transport: http(c.env.ALCHEMY_URL)
    })

    // @ts-expect-error library does not return correct types
    const { owner: resolvedAddress } = await publicClient.getOwner({
      name: ensName
    })

    if (!resolvedAddress) {
      throw new Error('ENS name not found');
      return false
    }

    const match = isAddressEqual(resolvedAddress, address)

    // Verify the address matches
    if (!match) {
      throw new Error('ENS owner and address do not match');
      return false;
    }

    // Verify the signature using viem
    const isValid = await viemClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`
    });

    if (!isValid) {
      throw new Error('Signature invalid')
    }

    return true;

  } catch (error) {
    console.error('ENS verification error:', error);
    return false;
  }
}
