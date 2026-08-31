import { hash, verify } from "@node-rs/argon2";

// Argon2id (défaut du package) via @node-rs/argon2 — binaires précompilés,
// pas de node-gyp sur Windows (cahier des charges section 8 : "mots de
// passe hachés Argon2").
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password);
}
