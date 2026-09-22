import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const version = process.env.PUPLER_VERSION ?? "dev"
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) throw new Error("Invalid release version")
const platform = process.platform
const arch = process.arch
const nativeTarget = platform === "linux" ? `linux-${arch}-gnu` : platform === "darwin" ? `darwin-${arch}` : `win32-${arch}-msvc`
const nativePath = fileURLToPath(import.meta.resolve(`@libsql/${nativeTarget}`))
const output = resolve("dist/release")
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

for (const [name, entry] of Object.entries({
	"pupler-server": "src/main.ts",
	"pupler-cli": "cli/cli.ts",
	"pupler-migrate": "scripts/migrate.ts",
	"pupler-create-user": "scripts/create-user.ts",
})) {
	const result = await Bun.build({
		entrypoints: [entry],
		compile: { outfile: `${output}/${name}${platform === "win32" ? ".exe" : ""}`, ...(platform === "linux" && arch === "x64" ? { target: "bun-linux-x64-baseline" as const } : {}) },
		define: { PUPLER_BUILD_VERSION: JSON.stringify(version), "process.env.NODE_ENV": JSON.stringify("production") },
		plugins: [{
			name: "embed-libsql-native-addon",
			setup(build) {
				build.onLoad({ filter: /[\\/]libsql[\\/]index\.js$/ }, async ({ path }) => {
					const source = await readFile(path, "utf8")
					const dynamic = 'require(`@libsql/${target}`)'
					if (!source.includes(dynamic)) throw new Error("libsql loader changed; review native addon bundling")
					return { contents: source.replace(dynamic, `require(${JSON.stringify(nativePath)})`), loader: "js" }
				})
			},
		}],
	})
	if (!result.success) throw new AggregateError(result.logs, `Failed to build ${name}`)
}
await writeFile(`${output}/VERSION`, `${version}\n`)
