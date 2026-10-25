import { readdir, readFile } from "node:fs/promises";
const root = new URL("../.next/static/", import.meta.url);
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(
      entry.name + (entry.isDirectory() ? "/" : ""),
      directory,
    );
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith(".js")) {
      const text = await readFile(path, "utf8");
      if (
        /p(?:fd|fk)_[a-f0-9]{64}|PAIFLOW_API_TOKEN|BUKIDPAY_PASS_SIGNING_PRIVATE_KEY|PaiflowTransport|class PaiflowApiError/.test(
          text,
        )
      ) {
        throw new Error(
          "Server credential, signing key marker or SDK runtime found in browser bundle.",
        );
      }
    }
  }
}
await scan(root);
console.log(
  "Browser bundle contains no credential markers or Paiflow SDK runtime.",
);
