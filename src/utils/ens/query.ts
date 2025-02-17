import { createPublicClient, http, stringToHex } from 'viem'
import { base } from 'viem/chains'
import { ResolverQuery } from './utils'
import { Context } from "hono";
import { encode } from '@ensdomains/content-hash'
import { getSiteByENS } from '../db/ens';

export async function getRecord(c: Context, query: ResolverQuery, name: string) {
  const { functionName } = query
  console.log(functionName)

  try {

    if (functionName !== 'contenthash') {
      return ''
    }
    const site = await getSiteByENS(c, name)
    const encodedContenthash = '0x' + encode('ipfs', site.cid)
    console.log("Encoded hash to return: ", encodedContenthash)
    return encodedContenthash
  } catch (err) {
    return ''
  }
}
