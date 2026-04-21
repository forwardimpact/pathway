import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFile } from "node:child_process";

const ANTHROPIC_AUTHORIZE_URL =
  process.env.ANTHROPIC_OAUTH_AUTHORIZE_URL ||
  "https://auth.anthropic.com/oauth/authorize";
const ANTHROPIC_TOKEN_URL =
  process.env.ANTHROPIC_OAUTH_TOKEN_URL ||
  "https://auth.anthropic.com/oauth/token";
const ANTHROPIC_CLIENT_ID =
  process.env.ANTHROPIC_OAUTH_CLIENT_ID || "fit-guide";

function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { verifier, challenge, state };
}

function startCallbackServer(expectedState) {
  let resolveCode, rejectCode;
  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (state !== expectedState) {
      res.writeHead(400);
      res.end("Invalid state");
      rejectCode(new Error("State mismatch"));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Login successful. You can close this tab.");
    server.close();
    resolveCode(code);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ port, codePromise });
    });
  });
}

async function exchangeCode(code, verifier, redirectUri) {
  const res = await fetch(ANTHROPIC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const body = await res.json();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

/**
 * Runs the OAuth PKCE login flow and persists the credential.
 * @param {import("@forwardimpact/libconfig").Config} config
 */
export async function login(config) {
  const pkce = createPkce();
  const { port, codePromise } = await startCallbackServer(pkce.state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const authorizeUrl = new URL(ANTHROPIC_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", ANTHROPIC_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", pkce.state);
  authorizeUrl.searchParams.set("scope", "openid offline_access");

  // Try to open browser; fall back to printing the URL
  const openUrl = authorizeUrl.toString();
  try {
    execFile("open", [openUrl]);
    process.stdout.write("Opening browser for login...\n");
  } catch {
    process.stdout.write(`Open this URL in your browser:\n\n  ${openUrl}\n\n`);
  }

  const code = await codePromise;
  const tokenData = await exchangeCode(code, pkce.verifier, redirectUri);
  await config.writeOAuthCredential(tokenData);
  process.stdout.write("Logged in successfully.\n");
}
