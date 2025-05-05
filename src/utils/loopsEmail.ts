import { Context } from "hono";

export const sendTransactionalEmail = async (c: Context, body: string) => {
    try {
        await fetch("https://app.loops.so/api/v1/transactional", {
            method: "POST", 
            headers: {
                'Content-Type': "application/json", 
                'Authorization': `Bearer ${c.env.LOOPS_API_KEY}`
            }, 
            body: body
        })
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export const sendNoSiteEmail = async () => {
    try {
        //  Get all of the users who have signed up 7 days ago but have not set up a site
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        
    } catch (error) {
        console.log(error);
        throw error;
    }
}