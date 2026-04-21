export async function runLogoutCommand() {
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const config = await createServiceConfig("mcp");
  await config.clearOAuthCredential();
  process.stdout.write("Logged out. Stored credential removed.\n");
}
