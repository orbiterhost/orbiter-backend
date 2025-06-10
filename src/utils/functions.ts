import { Context } from "hono";
import { GraphQLResponse, WorkerUsageResult } from "./types";

export async function getWorkerUsage(
  c: Context,
  scriptName: string,
  dateStart: string, // ISO 8601 format: "2025-06-09T00:00:00.000Z"
  dateEnd: string // ISO 8601 format: "2025-06-10T23:59:59.000Z"
): Promise<WorkerUsageResult> {
  const query = `
      query GetWorkersAnalytics($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!, $scriptName: String!) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            workersInvocationsAdaptive(limit: 1000, filter: {
              scriptName: $scriptName,
              datetime_geq: $datetimeStart,
              datetime_leq: $datetimeEnd
            }) {
              sum {
                subrequests
                requests
                errors
              }
              quantiles {
                cpuTimeP50
                cpuTimeP99
              }
              dimensions {
                datetime
                scriptName
                status
              }
            }
          }
        }
      }
    `;

  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        accountTag: c.env.CLOUDFLARE_ACCOUNT_ID,
        datetimeStart: dateStart,
        datetimeEnd: dateEnd,
        scriptName: scriptName,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GraphQL API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data: GraphQLResponse = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  // Aggregate the data
  let totalRequests = 0;
  let totalCpuTime = 0;

  const invocations =
    data.data.viewer.accounts[0]?.workersInvocationsAdaptive || [];

  for (const invocation of invocations) {
    // Add up all requests
    totalRequests += invocation.sum.requests;

    // For CPU time, we'll use the P50 quantile multiplied by the number of requests
    // This gives us an approximation of total CPU time used
    // Note: This is an approximation since we don't have exact per-request CPU times
    totalCpuTime += invocation.quantiles.cpuTimeP50 * invocation.sum.requests;
  }

  return {
    scriptName,
    totalRequests,
    totalCpuTime,
    dateRange: {
      start: dateStart,
      end: dateEnd,
    },
  };
}
