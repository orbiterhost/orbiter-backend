import { Bindings } from "../utils/types";

export async function verifyRecaptcha(env: Bindings, token: string): Promise<boolean> {
    console.log(token)
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.RECAPTCHA_SECRET_KEY!,
        response: token
      })
    });
  
    const data: any = await response.json();
    console.log(data);
    return data.score >= 0.5; // Adjust threshold as needed (0.0 to 1.0)
  }