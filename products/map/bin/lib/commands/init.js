/**
 * Init Command
 *
 * Initializes a new framework data directory by copying starter data.
 */

import { cp, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const starterDir = join(__dirname, "..", "..", "..", "starter");

/**
 * Run the init command
 * @param {string} [targetPath] - Target directory (defaults to cwd)
 */
export async function runInit(targetPath) {
  const target = targetPath || process.cwd();
  const dataDir = join(target, "data", "pathway");

  // Check if data/pathway/ already exists
  try {
    await access(dataDir);
    console.error("Error: ./data/pathway/ already exists.");
    console.error("Remove it first or use a different directory.");
    process.exit(1);
  } catch {
    // Directory doesn't exist, proceed
  }

  // Verify starter data is available
  try {
    await access(starterDir);
  } catch {
    console.error("Error: Starter data not found in package.");
    console.error("This may indicate a corrupted package installation.");
    process.exit(1);
  }

  // Copy starter data
  console.log("Creating ./data/pathway/ with starter data...\n");
  await cp(starterDir, dataDir, { recursive: true });

  console.log(`✅ Created ./data/pathway/ with starter data.

Next steps:
  1. Edit data files to match your organization
  2. npx fit-map validate
  3. npx fit-pathway dev

Data structure:
  data/pathway/
  ├── framework.yaml        # Framework metadata
  ├── levels.yaml           # Career levels
  ├── stages.yaml           # Lifecycle stages
  ├── drivers.yaml          # Business drivers
  ├── disciplines/          # Engineering disciplines
  ├── capabilities/         # Capability areas with skills
  ├── behaviours/           # Behavioural expectations
  └── tracks/               # Track specializations
`);
}
