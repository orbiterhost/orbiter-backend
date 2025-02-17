import { Context } from "hono";

type Range = {
    startDate: string; //unix timestamp
    endDate: string; //unix timestamp
}

export const getDailySiteStats = async(c: Context, domain: string, dateRange?: Range) => {
    try {
        let url = `https://analytics.orbiter.host/analytics/${domain}/stats`

        if(dateRange) {
            url = url + `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        }

        console.log(url);

        const res = await fetch(url, {
            headers: {
                'X-Orbiter-Analytics-Token': c.env.ORBITER_ANALYTICS_TOKEN
            }
        })

        const data: any = await res.json();
        return data?.data || null;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export const getPathData = async (c: Context, domain: string, dateRange?: Range) => {
    try {
        let url = `https://analytics.orbiter.host/analytics/${domain}/paths`

        if(dateRange) {
            url = url + `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        }

        console.log(url);

        const res = await fetch(url, {
            headers: {
                'X-Orbiter-Analytics-Token': c.env.ORBITER_ANALYTICS_TOKEN
            }
        })

        const data: any = await res.json();
        return data?.data || null;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export const getReferrerData = async (c: Context, domain: string, dateRange?: Range) => {
    try {
        let url = `https://analytics.orbiter.host/analytics/${domain}/referrers`

        if(dateRange) {
            url = url + `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        }

        console.log(url);

        const res = await fetch(url, {
            headers: {
                'X-Orbiter-Analytics-Token': c.env.ORBITER_ANALYTICS_TOKEN
            }
        })

        const data: any = await res.json();
        return data?.data || null;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export const getCountryData = async (c: Context, domain: string, dateRange?: Range) => {
    try {
        let url = `https://analytics.orbiter.host/analytics/${domain}/countries`

        if(dateRange) {
            url = url + `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        }

        console.log(url);

        const res = await fetch(url, {
            headers: {
                'X-Orbiter-Analytics-Token': c.env.ORBITER_ANALYTICS_TOKEN
            }
        })

        const data: any = await res.json();
        return data?.data || null;
    } catch (error) {
        console.log(error);
        throw error;
    }
}