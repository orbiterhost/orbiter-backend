import { Context } from "hono";
import { User } from "./types";

export const postNewSiteToSlack = async (c: Context, siteDomain: string, userDetails: User, cid: string) => {
    try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.SLACK_TOKEN}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                channel: c.env.SLACK_SITES_CHANNEL_ID,
                text: `New site: https://${siteDomain}.orbiter.website\nCreated by ${userDetails.email}\nCID: ${cid}`,
            }),
        });
    } catch (error) {
        console.log(error);
    }
}

export const postUpdatedSiteToSlack = async (c: Context, siteDomain: string, userDetails: User, cid: string) => {
    try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.SLACK_TOKEN}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                channel: c.env.SLACK_SITES_CHANNEL_ID,
                text: `Site updated: https://${siteDomain}.orbiter.website\nUpdated by ${userDetails.email}\nCID: ${cid}`,
            }),
        });
    } catch (error) {
        console.log(error);
    }
}

export const postMaliciousContentDetectionToSlack = async (c: Context, message: string) => {
    try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.SLACK_TOKEN}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                channel: c.env.CHANNEL_ID,
                text: message,
            }),
        });

        const slackData = await res.json()
        console.log({slackData: JSON.stringify(slackData)})
    } catch (error) {
        console.log(error);        
    }
}

export const postSubscriptionChanges = async (c: Context, message: string) => {
    try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c.env.SLACK_TOKEN}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                channel: c.env.SLACK_SUBSCRIPTIONS_CHANNEL_ID,
                text: message,
            }),
        });
    } catch (error) {
        console.log(error);
    }
}