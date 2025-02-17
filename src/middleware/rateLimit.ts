import { Bindings } from "hono/types";

export async function rateLimiter(c: any, env: Bindings) {
  const ip =
    c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for");
  const key = `rate_limit:${ip}`;

  // Get current count from KV
  const currentCount = (await env.KV.get(key)) || "0";
  const count = parseInt(currentCount);

  if (count >= 5) {
    // 5 requests per hour limit
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  // Increment count with 1 hour expiry
  await env.KV.put(key, (count + 1).toString(), { expirationTtl: 3600 });

  return null; // Continue to next middleware
}
