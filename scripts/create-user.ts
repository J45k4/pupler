import { closeDatabase, openDatabase } from "../src/api/core"
import { resolveDatabasePath, resolveFilesPath } from "../src/config"

const HELP = `Create a Pupler user directly in the local database.

Usage:
  pupler-create-user --name <name> --username <username> --password <password> [--email <email>] [--no-admin]

Options:
  --name <name>        Display name (required).
  --username <name>    Login name (required, must be unique).
  --password <pass>    Password, at least 8 characters (required).
  --email <email>      Email address (optional).
  --admin              Create an administrator (default).
  --no-admin           Create a regular user.
  --help               Show this help.

Environment:
  DATA_PATH        Data directory containing pupler.db and files/.
  DB_PATH          Override the database path.
  FILES_PATH       Files directory, defaults next to the database.
`

type Args = {
	name?: string
	username?: string
	password?: string
	email?: string
	admin: boolean
	help: boolean
}

const parseArgs = (): Args => {
	const raw = Bun.argv.slice(2)
	const parsed: Args = { admin: true, help: false }

	for (let index = 0; index < raw.length; index++) {
		const arg = raw[index]
		switch (arg) {
			case "--name":
			case "--username":
			case "--password":
			case "--email": {
				const value = raw[index + 1]
				if (!value) {
					throw new Error(`${arg} requires a value`)
				}
				parsed[arg.slice(2) as "name" | "username" | "password" | "email"] = value
				index++
				break
			}
			case "--admin":
				parsed.admin = true
				break
			case "--no-admin":
				parsed.admin = false
				break
			case "--help":
			case "-h":
				parsed.help = true
				break
			default:
				throw new Error(`Unknown option ${arg}`)
		}
	}

	return parsed
}

const db = openDatabase(
	resolveDatabasePath(),
	process.env.FILES_PATH ?? resolveFilesPath(resolveDatabasePath()),
)

try {
	const args = parseArgs()
	if (args.help) {
		console.log(HELP)
	} else {
		const name = args.name?.trim()
		const username = args.username?.trim()
		const password = args.password ?? ""
		const email = args.email?.trim() || null
		if (!name || !username) {
			throw new Error("Name and username are required")
		}
		if (password.length < 8) {
			throw new Error("Password must be at least 8 characters")
		}
		const existing = await db.client.user.findUnique({
			where: { username },
		})
		if (existing) {
			throw new Error(`Username \`${username}\` is already taken`)
		}
		const now = new Date().toISOString()
		const user = await db.client.user.create({
			data: {
				name,
				username,
				email,
				password_hash: await Bun.password.hash(password),
				is_admin: args.admin,
				created_at: now,
				updated_at: now,
			},
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				is_admin: true,
				created_at: true,
				updated_at: true,
			},
		})
		console.log(JSON.stringify(user, null, 2))
	}
} finally {
	await closeDatabase(db)
}
