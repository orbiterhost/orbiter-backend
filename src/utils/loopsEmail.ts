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