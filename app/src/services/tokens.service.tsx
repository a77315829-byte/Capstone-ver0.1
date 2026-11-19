// Shared exhibition PCs should not retain login credentials across browser sessions.
function clearToken(): void {
 const username = sessionStorage.getItem("username") || localStorage.getItem("username");
 sessionStorage.removeItem("jwt");
 sessionStorage.removeItem("username");
 localStorage.removeItem("jwt");
 localStorage.removeItem("username");
 localStorage.removeItem("profileImageUrl");
 if (username) localStorage.removeItem("antitude:quiz-progress:" + username);
 sessionStorage.removeItem("antitude:selectedStock");
}
function getToken(): string | null {
 const token = sessionStorage.getItem("jwt");
 if (!token) return null;
 try {
  const encoded = token.split(".")[1];
  if (!encoded) { clearToken(); return null; }
  const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) { clearToken(); return null; }
  return token;
 } catch { clearToken(); return null; }
}
function getUsername(): string | null { return getToken() ? sessionStorage.getItem("username") : null; }
function isAuthenticated(): boolean { return !!getToken() && !!getUsername(); }
function setTokenAndUsername(accessToken: string, username: string): void {
 localStorage.removeItem("jwt");
 localStorage.removeItem("username");
 sessionStorage.setItem("jwt", accessToken);
 sessionStorage.setItem("username", username);
}
export default { getUsername, getToken, isAuthenticated, setTokenAndUsername, clearToken };
