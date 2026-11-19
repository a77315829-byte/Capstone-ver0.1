import { useEffect, useState } from "react";
import api from "../services/api.service";
export function useAuthConfig() {
 const [config, setConfig] = useState<{ captchaEnabled: boolean; captchaSiteKey: string } | null>(null);
 const [error, setError] = useState("");
 useEffect(() => {
  const controller = new AbortController();
  api.get("/auth/config", { signal: controller.signal, timeout: 10000 })
   .then(response => setConfig(response.data))
   .catch(() => { if (!controller.signal.aborted) setError("서버 연결을 확인한 후 페이지를 새로고침해주세요."); });
  return () => controller.abort();
 }, []);
 return { config, error };
}
