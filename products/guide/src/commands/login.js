export async function runLoginCommand() {
  const { login } = await import("../lib/login.js");
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const config = await createServiceConfig("mcp");
  await login(config);
}
