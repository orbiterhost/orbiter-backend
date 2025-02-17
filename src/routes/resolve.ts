import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "../utils/types";
import { HttpRequestError, isAddress, isHex } from 'viem'
import { decodeEnsOffchainRequest, encodeEnsOffchainResponse } from '../utils/ens/utils'
import { getRecord } from '../utils/ens/query'
import { z } from 'zod'

const schema = z.object({
  sender: z.string().refine((data) => isAddress(data)),
  data: z.string().refine((data) => isHex(data)),
})


const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.get('/:sender/:data', async (c) => {
  const { sender, data } = c.req.param()

  const safeParse = schema.safeParse({ sender, data })

  if (!safeParse.success) {
    return c.json({ error: safeParse.error }, 400)
  }

  let result: string

  try {
    const { name, query } = decodeEnsOffchainRequest(safeParse.data)
    console.log("ENS Query: ", query)
    result = await getRecord(c, query, name)
  } catch (error) {
    const isHttpRequestError = error instanceof HttpRequestError
    const errMessage = isHttpRequestError ? error.message : 'Unable to resolve'
    return c.json({ message: errMessage }, 400)
  }

  const encodedResponse = await encodeEnsOffchainResponse(
    safeParse.data,
    result,
    c.env.ENS_SIGNER
  )

  console.log("Full response to resolver: ", encodedResponse)
  return c.json({ data: encodedResponse }, 200)
})



export default app;
