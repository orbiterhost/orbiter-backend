interface WorkerInvocation {
  quantiles: {
    cpuTimeP50: number;
  };
  sum: {
    requests: number;
  };
}

interface AnalyticsResponse {
  data: {
    viewer: {
      accounts: Array<{
        workersInvocationsAdaptive: WorkerInvocation[];
      }>;
    };
  };
}

function aggregateUsage(data: AnalyticsResponse) {
  const invocations =
    data.data.viewer.accounts[0].workersInvocationsAdaptive;

  let totalRequests = 0;
  let totalCpuTime = 0;

  invocations.forEach((invocation) => {
    const requests = invocation.sum.requests;
    const cpuTimeP50 = invocation.quantiles.cpuTimeP50;

    totalRequests += requests;
    totalCpuTime += requests * cpuTimeP50;
  });

  return {
    totalRequests,
    totalCpuTime,
  };
}

export const getFunctionUsage = async (
  accountId: string,
  apiToken: string,
  dispatchNamespace: string,
  scriptName: string,
  startDate: string,
  endDate: string
) => {
  try {
    // First, let's try querying by dispatch namespace only
    const requestBody = {
      query: `query GetWorkersAnalytics($accountTag: string, $datetimeStart: string, $datetimeEnd: string, $scriptName: string) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            workersInvocations(
              limit: 1000,
              filter: {
                scriptName: $scriptName,
                date_geq: $datetimeStart,
                date_leq: $datetimeEnd
              },
              orderBy: [date_ASC]
            ) {
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
                date
                scriptName
                dispatchNamespaceName
                status
              }
            }
          }
        }
      }`,
      variables: {
        accountTag: accountId,
        datetimeStart: startDate,
        datetimeEnd: endDate,
        scriptName: scriptName,
      },
    };

    const res = await fetch(`https://api.cloudflare.com/client/v4/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Alternative version - query without dispatch namespace filter
export const getFunctionUsageByScript = async (
  accountId: string,
  apiToken: string,
  scriptName: string,
  startDate: string,
  endDate: string
) => {
  try {
    const requestBody = {
      query: `query GetWorkersAnalytics($accountTag: string, $datetimeStart: string, $datetimeEnd: string, $scriptName: string) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            workersInvocationsAdaptive(
              limit: 1000,
              filter: {
                scriptName: $scriptName,
                datetime_geq: $datetimeStart,
                datetime_leq: $datetimeEnd
              },
              orderBy: [datetime_ASC]
            ) {
              sum {
                subrequests
                requests
                errors
              }
              quantiles {
                cpuTimeP50
                cpuTimeP99
              }
              dimensions{
                datetime
                scriptName
                dispatchNamespaceName
                status
              }
            }
          }
        }
      }`,
      variables: {
        accountTag: accountId,
        datetimeStart: startDate,
        datetimeEnd: endDate,
        scriptName: scriptName,
      },
    };

    const res = await fetch(`https://api.cloudflare.com/client/v4/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data: AnalyticsResponse = await res.json();

    const formatted = await aggregateUsage(data);
    return formatted;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
