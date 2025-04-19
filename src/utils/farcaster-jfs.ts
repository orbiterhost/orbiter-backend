import { ethers } from 'ethers';

interface JFSHeader {
  fid: number;
  type: 'custody';
  key: string;
}

interface JFSJSON {
  header: string;
  payload: string;
  signature: string;
}

export class FarcasterJFS {
  private static base64UrlEncode(data: string): string {
    return Buffer.from(data, 'utf-8')
      .toString('base64url');
  }

  private static base64UrlDecode(data: string): string {
    return Buffer.from(data, 'base64url')
      .toString('utf-8');
  }

  static async sign(
    fid: number,
    custodyAddress: string,
    payload: Record<string, any>,
    signer: ethers.Signer
  ): Promise<JFSJSON> {
    // Create and encode header
    const header: JFSHeader = {
      fid,
      type: 'custody',
      key: custodyAddress
    };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));

    // Encode payload
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Create signature
    const messageToSign = `${encodedHeader}.${encodedPayload}`;
    const signature = await signer.signMessage(messageToSign);
    const encodedSignature = this.base64UrlEncode(signature);

    return {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature
    };
  }

  static async verify(jfs: JFSJSON): Promise<boolean> {
    try {
      // Decode header
      const header = JSON.parse(this.base64UrlDecode(jfs.header)) as JFSHeader;

      // Verify signature
      const messageToVerify = `${jfs.header}.${jfs.payload}`;
      const signature = this.base64UrlDecode(jfs.signature);

      const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);

      // Check if recovered address matches the key in header
      return recoveredAddress.toLowerCase() === header.key.toLowerCase();

    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }
}
