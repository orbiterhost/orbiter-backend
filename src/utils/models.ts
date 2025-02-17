import { isAddress, isHex } from 'viem'
import z from 'zod'

export const ZodName = z.object({
  name: z.string().regex(/^[a-z0-9-.]+$/),
  owner: z.string().refine((owner) => isAddress(owner)),
  addresses: z.record(z.string().refine((addr) => isHex(addr))).optional(),
  texts: z.record(z.string()).optional(),
  contenthash: z
    .string()
    .refine((contenthash) => isHex(contenthash))
    .optional(),
})

export const ZodNameWithSignature = z.object({
  signature: z.object({
    hash: z.string().refine((hash) => isHex(hash)),
    message: ZodName,
  }),
  expiration: z.number(),
})

export type Name = z.infer<typeof ZodName>
export type NameWithSignature = z.infer<typeof ZodNameWithSignature>
