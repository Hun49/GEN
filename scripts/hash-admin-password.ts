import { hashPassword } from "better-auth/crypto";

const password = process.argv[2];

if (!password) {
	console.error("Usage: pnpm admin:hash \"your-strong-password\"");
	process.exit(1);
}

if (password.length < 12) {
	console.error("Admin password must be at least 12 characters.");
	process.exit(1);
}

const hash = await hashPassword(password);
console.log(hash);
