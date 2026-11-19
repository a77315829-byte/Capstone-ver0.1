import "dotenv/config";
export const aiMode = () => process.env.AI_MODE === "rules" ? "rules" : "auto";
export function timeoutMs(name: string, fallback: number): number {
 const value = Number(process.env[name]);
 return Number.isFinite(value) && value >= 100 && value <= 180000 ? value : fallback;
}
export const serviceHeaders = () => ({ "X-Service-Key": process.env.EXHIBITION_SERVICE_KEY || "" });
export async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
 let timer: ReturnType<typeof setTimeout>;
 try {
  return await Promise.race([work, new Promise<never>((_, reject) => {
   timer = setTimeout(() => reject(new Error("Dependency timeout")), ms);
  })]);
 } finally { clearTimeout(timer!); }
}
