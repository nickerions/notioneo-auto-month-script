export function getSecretValueFromLink(link: string): string | null {
  const regex = /.*\/Databases-(.*)$/; // Regex pattern to match everything after 'Databases-'
  const match = regex.exec(link);

  if (match && match[1]) {
    return match[1];
  }

  return null; // Return null if no match found
}

export const link = Deno.env.get("DATABASE_PAGE");
if (!link) {
  console.log("Secret link not found in the environment variables.");
  Deno.exit(1);
}

export const secretValue = getSecretValueFromLink(link);

if (secretValue) {
  console.log(secretValue);
} else {
  console.log("Unable to retrieve the secret value from the link.");
}