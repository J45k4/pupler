import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { closeDatabase, openDatabase } from "../src/api/core";

const HELP = `Seed Pupler with demo data.

Usage:
  bun scripts/seed.ts
  bun scripts/seed.ts --reset-demo
  bun scripts/seed.ts --reset-only
  bun scripts/seed.ts --batch "Demo Custom"

Options:
  --batch <name>   Prefix used for visible seeded records.
  --reset-demo     Remove previous script-generated demo data before seeding.
  --reset-only     Remove previous script-generated demo data and exit.
  --help           Show this help.

Environment:
  DB_PATH          Database path, defaults to pupler.db.
  FILES_PATH       Files directory, defaults next to the database.
`;

type Args = {
	batch: string;
	resetDemo: boolean;
	resetOnly: boolean;
	help: boolean;
};
type SeedIngredient = { id: number; name: string; default_unit: string | null };
type SeedProduct = {
	id: number;
	name: string;
	category: string;
	ingredient_id: number | null;
	default_unit: string | null;
};
type SeedGroup = { id: number };
type SeedReceipt = { id: number };
type SeedReceiptItem = { id: number; product_id: number; receipt_id: number };
type SeedInventoryContainer = { id: number };
type SeedInventoryItem = { id: number; name: string };
type SeedRecipe = { id: number };

const parseArgs = (): Args => {
	const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
	const args = Bun.argv.slice(2);
	const parsed: Args = {
		batch: `Demo ${stamp}`,
		resetDemo: false,
		resetOnly: false,
		help: false,
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		switch (arg) {
			case "--batch": {
				const value = args[index + 1];
				if (!value) {
					throw new Error("--batch requires a value");
				}
				parsed.batch = value;
				index++;
				break;
			}
			case "--reset-demo":
				parsed.resetDemo = true;
				break;
			case "--reset-only":
				parsed.resetOnly = true;
				parsed.resetDemo = true;
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			default:
				throw new Error(`Unknown option ${arg}`);
		}
	}

	return parsed;
};

const now = new Date();
const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const iso = (days = 0, hours = 0) => {
	const date = new Date(now);
	date.setDate(date.getDate() + days);
	date.setHours(date.getHours() + hours);
	return date.toISOString();
};
const dateOnly = (days = 0) => iso(days).slice(0, 10);
const seedMarker = (batch: string) => `[seed:${batch}]`;
const slug = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
const escapeSvg = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const colorFor = (index: number) =>
	["#ba5a31", "#2d7c6f", "#7357a6", "#5f7f35", "#b9792f", "#3f6f9f"][
		index % 6
	]!;

const db = openDatabase(process.env.DB_PATH ?? "pupler.db", process.env.FILES_PATH);
const client = db.client;

const createImageFile = async (
	assetType: string,
	resourceId: number,
	label: string,
	index: number,
) => {
	const relativePath = `${assetType}/${resourceId}/seed-${stamp}-${slug(label)}.svg`;
	const absolutePath = join(db.filesPath, relativePath);
	const color = colorFor(index);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" rx="36" fill="#fbf7ef"/><rect x="54" y="54" width="792" height="492" rx="30" fill="${color}" opacity="0.9"/><circle cx="720" cy="150" r="82" fill="#fff" opacity="0.22"/><text x="90" y="315" font-family="Avenir Next, Segoe UI, sans-serif" font-size="54" font-weight="700" fill="#fff">${escapeSvg(label)}</text><text x="92" y="382" font-family="Avenir Next, Segoe UI, sans-serif" font-size="26" fill="#fff" opacity="0.82">Pupler seed data</text></svg>`;

	await mkdir(dirname(absolutePath), { recursive: true });
	await Bun.write(absolutePath, svg);
	return client.file.create({
		data: {
			path: relativePath,
			content_type: "image/svg+xml",
			filename: `${slug(label)}.svg`,
			size_bytes: new TextEncoder().encode(svg).byteLength,
			created_at: now.toISOString(),
		},
	});
};

const resetDemoData = async () => {
	const marker = "[seed:";
	const seededFiles = await client.file.findMany({
		where: { path: { contains: "/seed-" } },
		select: { id: true, path: true },
	});
	const recipes = await client.recipe.findMany({
		where: { name: { startsWith: "Demo " } },
		select: { id: true },
	});
	const recipeIds = recipes.map((recipe) => recipe.id);
	const receipts = await client.receipt.findMany({
		where: { store_name: { startsWith: "Demo " } },
		select: { id: true },
	});
	const receiptIds = receipts.map((receipt) => receipt.id);
	const receiptItems = receiptIds.length
		? await client.receiptItem.findMany({
				where: { receipt_id: { in: receiptIds } },
				select: { id: true },
			})
		: [];
	const receiptItemIds = receiptItems.map((item) => item.id);
	const products = await client.product.findMany({
		where: { name: { startsWith: "Demo " } },
		select: { id: true },
	});
	const productIds = products.map((product) => product.id);
	const ingredients = await client.ingredient.findMany({
		where: { name: { startsWith: "Demo " } },
		select: { id: true },
	});
	const ingredientIds = ingredients.map((ingredient) => ingredient.id);
	const inventoryItems = await client.inventoryItem.findMany({
		where: {
			OR: [
				{ name: { startsWith: "Demo " } },
				{ notes: { contains: marker } },
				...(productIds.length ? [{ product_id: { in: productIds } }] : []),
				...(ingredientIds.length
					? [{ ingredient_id: { in: ingredientIds } }]
					: []),
				...(receiptItemIds.length
					? [{ receipt_item_id: { in: receiptItemIds } }]
					: []),
			],
		},
		select: { id: true },
	});
	const inventoryItemIds = inventoryItems.map((item) => item.id);

	await client.todo.deleteMany({
		where: {
			OR: [
				{ title: { startsWith: "Demo " } },
				{ notes: { contains: marker } },
			],
		},
	});
	await client.shoppingListItem.deleteMany({
		where: {
			OR: [
				{ name: { startsWith: "Demo " } },
				{ notes: { contains: marker } },
				...(productIds.length ? [{ product_id: { in: productIds } }] : []),
				...(ingredientIds.length
					? [{ ingredient_id: { in: ingredientIds } }]
					: []),
				...(recipeIds.length
					? [{ source_recipe_id: { in: recipeIds } }]
					: []),
			],
		},
	});
	if (recipeIds.length) {
		await client.mealPlanItem.deleteMany({
			where: { recipe_id: { in: recipeIds } },
		});
		await client.recipeIngredient.deleteMany({
			where: { recipe_id: { in: recipeIds } },
		});
		await client.recipeImage.deleteMany({
			where: { recipe_id: { in: recipeIds } },
		});
	}
	if (inventoryItemIds.length) {
		await client.inventoryItemImage.deleteMany({
			where: { inventory_item_id: { in: inventoryItemIds } },
		});
		await client.inventoryItem.deleteMany({
			where: { id: { in: inventoryItemIds } },
		});
	}
	if (receiptIds.length) {
		await client.receiptItem.deleteMany({
			where: { id: { in: receiptItemIds } },
		});
		await client.receipt.deleteMany({
			where: { id: { in: receiptIds } },
		});
	}
	if (productIds.length) {
		await client.productLink.deleteMany({
			where: { product_id: { in: productIds } },
		});
		await client.product.deleteMany({
			where: { id: { in: productIds } },
		});
	}
	if (recipeIds.length) {
		await client.recipe.deleteMany({
			where: { id: { in: recipeIds } },
		});
	}
	const containers = await client.inventoryContainer.findMany({
		where: { name: { startsWith: "Demo " } },
		orderBy: { id: "desc" },
		select: { id: true },
	});
	for (const container of containers) {
		await client.inventoryContainer.delete({ where: { id: container.id } });
	}
	await client.group.deleteMany({
		where: { name: { startsWith: "Demo " } },
	});
	await client.ingredient.deleteMany({
		where: { id: { in: ingredientIds } },
	});
	if (seededFiles.length) {
		await client.file.deleteMany({
			where: { id: { in: seededFiles.map((file) => file.id) } },
		});
	}
	await Promise.all(
		seededFiles.map((file) =>
			rm(join(db.filesPath, file.path), { force: true }).catch(() => undefined),
		),
	);

	return {
		files: seededFiles.length,
		recipes: recipeIds.length,
		inventoryItems: inventoryItemIds.length,
		receipts: receiptIds.length,
		receiptItems: receiptItemIds.length,
		products: productIds.length,
		ingredients: ingredientIds.length,
	};
};

const seedDemoData = async (batch: string) => {
	const marker = seedMarker(batch);
	const ingredientInputs = [
		["Milk", "l"],
		["Eggs", "pcs"],
		["Oats", "g"],
		["Chicken breast", "g"],
		["Rice", "g"],
		["Tomato", "pcs"],
		["Onion", "pcs"],
		["Garlic", "clove"],
		["Coffee beans", "g"],
		["Greek yogurt", "g"],
		["Banana", "pcs"],
		["Olive oil", "ml"],
		["Pasta", "g"],
		["Parmesan", "g"],
		["Spinach", "g"],
		["Lentils", "g"],
	] as const;
	const ingredients: SeedIngredient[] = [];
	for (const [name, unit] of ingredientInputs) {
		ingredients.push(
			await client.ingredient.create({
				data: {
					name: `${batch} ${name}`,
					default_unit: unit,
					created_at: iso(-20),
					updated_at: iso(-1),
				},
			}),
		);
	}
	const ingredientByBase = new Map(
		ingredientInputs.map(([name], index) => [name, ingredients[index]!]),
	);

	const productInputs = [
		["Whole Milk", "dairy", "Milk", "l", true],
		["Free Range Eggs", "dairy", "Eggs", "pcs", true],
		["Rolled Oats", "pantry", "Oats", "g", false],
		["Chicken Fillets", "meat", "Chicken breast", "g", true],
		["Jasmine Rice", "pantry", "Rice", "g", false],
		["Cherry Tomatoes", "produce", "Tomato", "pcs", true],
		["Yellow Onions", "produce", "Onion", "pcs", false],
		["Garlic Bulb", "produce", "Garlic", "clove", false],
		["House Coffee", "pantry", "Coffee beans", "g", false],
		["Greek Yogurt", "dairy", "Greek yogurt", "g", true],
		["Bananas", "produce", "Banana", "pcs", true],
		["Extra Virgin Olive Oil", "pantry", "Olive oil", "ml", false],
		["Rigatoni", "pantry", "Pasta", "g", false],
		["Parmesan Wedge", "dairy", "Parmesan", "g", true],
		["Baby Spinach", "produce", "Spinach", "g", true],
		["Red Lentils", "pantry", "Lentils", "g", false],
	] as const;
	const products: SeedProduct[] = [];
	for (const [name, category, ingredientName, unit, perishable] of productInputs) {
		const product = await client.product.create({
			data: {
				ingredient_id: ingredientByBase.get(ingredientName)?.id ?? null,
				name: `${batch} ${name}`,
				category,
				barcode: `${stamp}${String(products.length + 1).padStart(4, "0")}`,
				default_unit: unit,
				is_perishable: perishable,
				created_at: iso(-18),
				updated_at: iso(-1),
			},
		});
		const picture = await createImageFile(
			"product-pictures",
			product.id,
			name,
			products.length,
		);
		products.push(
			await client.product.update({
				where: { id: product.id },
				data: { picture_file_id: picture.id },
			}),
		);
		await client.productLink.create({
			data: {
				product_id: product.id,
				label: "Supplier page",
				url: `https://example.com/products/${slug(name)}`,
				created_at: iso(-17),
			},
		});
	}

	const groups: SeedGroup[] = [];
	for (const name of [
		"Weekly groceries",
		"Bulk pantry",
		"Farmers market",
		"Online delivery",
	]) {
		groups.push(
			await client.group.create({
				data: {
					name: `${batch} ${name}`,
					created_at: iso(-16),
					updated_at: iso(-1),
				},
			}),
		);
	}

	const receiptItems: SeedReceiptItem[] = [];
	const receipts: SeedReceipt[] = [];
	const stores = [
		"Prisma",
		"K-Citymarket",
		"Lidl",
		"Local Market",
		"Online Pantry",
		"Corner Shop",
		"Farm Stall",
		"Asian Market",
	];
	for (let receiptIndex = 0; receiptIndex < stores.length; receiptIndex++) {
		const store = stores[receiptIndex]!;
		const receipt = await client.receipt.create({
			data: {
				group_id: groups[receiptIndex % groups.length]!.id,
				store_name: `${batch} ${store}`,
				purchased_at: iso(-14 + receiptIndex),
				currency: "EUR",
				total_amount: null,
				created_at: iso(-14 + receiptIndex),
				updated_at: iso(-14 + receiptIndex),
			},
		});
		const picture = await createImageFile(
			"receipt-pictures",
			receipt.id,
			`${store} receipt`,
			receiptIndex,
		);
		await client.receipt.update({
			where: { id: receipt.id },
			data: { picture_file_id: picture.id },
		});
		let total = 0;
		for (let itemIndex = 0; itemIndex < 5; itemIndex++) {
			const product = products[(receiptIndex * 2 + itemIndex) % products.length]!;
			const quantity =
				product.default_unit === "pcs"
					? 1 + ((receiptIndex + itemIndex) % 6)
					: [0.5, 1, 1.5, 2][(receiptIndex + itemIndex) % 4]! *
						(product.default_unit === "ml" ? 250 : 1);
			const unitPrice = Number(
				(1.25 + ((receiptIndex + itemIndex) % 7) * 0.85).toFixed(2),
			);
			const lineTotal = Number(
				(
					unitPrice *
					(product.default_unit === "pcs"
						? quantity
						: Math.max(1, quantity / 500))
				).toFixed(2),
			);
			total += lineTotal;
			receiptItems.push(
				await client.receiptItem.create({
					data: {
						receipt_id: receipt.id,
						product_id: product.id,
						quantity,
						unit: product.default_unit ?? "pcs",
						unit_price: unitPrice,
						line_total: lineTotal,
						created_at: iso(-14 + receiptIndex),
					},
				}),
			);
		}
		await client.receipt.update({
			where: { id: receipt.id },
			data: { total_amount: Number(total.toFixed(2)) },
		});
		receipts.push(receipt);
	}

	const kitchen = await client.inventoryContainer.create({
		data: {
			name: `${batch} Kitchen`,
			parent_container_id: null,
			notes: `${marker} Seeded root container`,
			created_at: iso(-12),
			updated_at: iso(-1),
		},
	});
	const pantry = await client.inventoryContainer.create({
		data: {
			name: `${batch} Pantry`,
			parent_container_id: kitchen.id,
			notes: `${marker} Dry goods and cans`,
			created_at: iso(-12),
			updated_at: iso(-1),
		},
	});
	const fridge = await client.inventoryContainer.create({
		data: {
			name: `${batch} Fridge`,
			parent_container_id: kitchen.id,
			notes: `${marker} Fresh food`,
			created_at: iso(-12),
			updated_at: iso(-1),
		},
	});
	const freezer = await client.inventoryContainer.create({
		data: {
			name: `${batch} Freezer`,
			parent_container_id: kitchen.id,
			notes: `${marker} Frozen backups`,
			created_at: iso(-12),
			updated_at: iso(-1),
		},
	});
	const office = await client.inventoryContainer.create({
		data: {
			name: `${batch} Office shelf`,
			parent_container_id: null,
			notes: `${marker} Non-food household stash`,
			created_at: iso(-10),
			updated_at: iso(-1),
		},
	});
	const containers: SeedInventoryContainer[] = [pantry, fridge, freezer, office];

	const inventoryItems: SeedInventoryItem[] = [];
	for (let index = 0; index < 32; index++) {
		const product = products[index % products.length]!;
		const linkedReceiptItem = receiptItems.find(
			(item) => item.product_id === product.id,
		);
		const isConsumed = index % 9 === 0;
		const isPerishable = ["dairy", "produce", "meat"].includes(product.category);
		const expiresIn = isPerishable ? (index % 7) - 2 : 30 + (index % 20);
		const item = await client.inventoryItem.create({
			data: {
				name: `${batch} ${product.name.replace(`${batch} `, "")} stock ${index + 1}`,
				ingredient_id: product.ingredient_id,
				product_id: product.id,
				receipt_item_id: linkedReceiptItem?.id ?? null,
				container_id: containers[index % containers.length]!.id,
				quantity:
					product.default_unit === "pcs"
						? 1 + (index % 8)
						: [0.25, 0.5, 1, 1.5, 2][index % 5]! *
							(product.default_unit === "ml" ? 500 : 1),
				unit: product.default_unit ?? "pcs",
				purchased_at: iso(-13 + (index % 10)),
				expires_at: isConsumed ? null : iso(expiresIn),
				consumed_at: isConsumed ? iso(-1 - (index % 5)) : null,
				notes:
					index % 4 === 0
						? `${marker} Opened package`
						: index % 5 === 0
							? `${marker} Move to front soon`
							: marker,
				created_at: iso(-13 + (index % 10)),
				updated_at: iso(-1),
			},
		});
		inventoryItems.push(item);
		if (index < 8) {
			const image = await createImageFile(
				"inventory-item-images",
				item.id,
				item.name,
				index,
			);
			await client.inventoryItemImage.create({
				data: {
					inventory_item_id: item.id,
					file_id: image.id,
					created_at: iso(-3),
				},
			});
		}
	}

	const recipeInputs = [
		[
			"Tomato Chicken Rice Bowl",
			"Weeknight rice bowl",
			"Cook rice. Sear chicken. Simmer tomatoes, onion, and garlic. Serve together.",
			4,
			["Chicken breast", "Rice", "Tomato", "Onion", "Garlic"],
		],
		[
			"Creamy Yogurt Oats",
			"Breakfast prep",
			"Mix oats, yogurt, milk, and banana. Chill overnight.",
			2,
			["Oats", "Greek yogurt", "Milk", "Banana"],
		],
		[
			"Garlic Spinach Pasta",
			"Fast pasta dinner",
			"Boil pasta. Wilt spinach with garlic and olive oil. Finish with parmesan.",
			3,
			["Pasta", "Spinach", "Garlic", "Olive oil", "Parmesan"],
		],
		[
			"Red Lentil Soup",
			"Pantry soup",
			"Simmer lentils with onion, garlic, tomato, and olive oil until soft.",
			6,
			["Lentils", "Onion", "Garlic", "Tomato", "Olive oil"],
		],
		[
			"Coffee Banana Smoothie",
			"Cold breakfast drink",
			"Blend coffee, banana, yogurt, and milk.",
			2,
			["Coffee beans", "Banana", "Greek yogurt", "Milk"],
		],
	] as const;
	const recipes: SeedRecipe[] = [];
	let recipeIngredientCount = 0;
	for (let recipeIndex = 0; recipeIndex < recipeInputs.length; recipeIndex++) {
		const [name, description, instructions, servings, ingredientNames] =
			recipeInputs[recipeIndex]!;
		const recipe = await client.recipe.create({
			data: {
				name: `${batch} ${name}`,
				description: `${marker} ${description}`,
				instructions,
				servings,
				is_active: recipeIndex !== 4,
				created_at: iso(-9 + recipeIndex),
				updated_at: iso(-1),
			},
		});
		const recipeImage = await createImageFile(
			"recipe-images",
			recipe.id,
			name,
			recipeIndex,
		);
		await client.recipeImage.create({
			data: {
				recipe_id: recipe.id,
				file_id: recipeImage.id,
				created_at: iso(-8 + recipeIndex),
			},
		});
		for (const [ingredientIndex, ingredientName] of ingredientNames.entries()) {
			const ingredient = ingredientByBase.get(ingredientName)!;
			const product = products.find(
				(entry) => entry.ingredient_id === ingredient.id,
			);
			await client.recipeIngredient.create({
				data: {
					recipe_id: recipe.id,
					ingredient_id: ingredient.id,
					product_id: product?.id ?? null,
					name: `${batch} ${ingredient.name.replace(`${batch} `, "")}`,
					quantity: [1, 2, 3, 250, 500][ingredientIndex % 5]!,
					unit: ingredient.default_unit ?? "pcs",
					is_optional:
						ingredientIndex === ingredientNames.length - 1 &&
						recipeIndex % 2 === 0,
					notes: ingredientIndex === 0 ? `${marker} Main ingredient` : marker,
					created_at: iso(-8 + recipeIndex),
				},
			});
			recipeIngredientCount++;
		}
		recipes.push(recipe);
	}

	for (let index = 0; index < 14; index++) {
		await client.mealPlanItem.create({
			data: {
				recipe_id: recipes[index % recipes.length]!.id,
				planned_date: dateOnly(index - 2),
				meal_type: ["breakfast", "lunch", "dinner", "snack"][index % 4]!,
				servings: 1 + (index % 5),
				status: ["planned", "prepped", "cooked", "skipped"][index % 4]!,
				created_at: iso(-7),
				updated_at: iso(-1),
			},
		});
	}

	for (let index = 0; index < 24; index++) {
		const product = products[(index * 3) % products.length]!;
		await client.shoppingListItem.create({
			data: {
				name: `${batch} ${product.name.replace(`${batch} `, "")}`,
				ingredient_id: product.ingredient_id,
				product_id: index % 3 === 0 ? product.id : null,
				quantity:
					product.default_unit === "pcs"
						? 1 + (index % 4)
						: [250, 500, 750, 1000][index % 4]!,
				unit: product.default_unit ?? "pcs",
				done: index % 5 === 0,
				source_recipe_id:
					index % 2 === 0 ? recipes[index % recipes.length]!.id : null,
				notes: index % 4 === 0 ? `${marker} Needed for meal plan` : marker,
				created_at: iso(-3 + (index % 3)),
				updated_at: iso(-1),
			},
		});
	}

	const todoInputs = [
		["Check expiring fridge items", 1, -1, null],
		["Plan weekend batch cooking", 1, 2, null],
		["Archive old pantry receipts", 2, -2, -1],
		["Compare rice prices", 1, 5, null],
		["Clean freezer drawer", 1, 1, null],
		["Restock coffee filters", 1, 4, null],
		["Review meal plan", 2, -1, -1],
		["Donate duplicate pantry goods", 1, 7, null],
		["Old reminder example", 3, null, null],
		["Photograph new inventory labels", 1, 3, null],
		["Update product links", 1, 6, null],
		["Test todos modal", 2, 0, 0],
	] as const;
	for (const [title, status, dueDays, completedDays] of todoInputs) {
		await client.todo.create({
			data: {
				title: `${batch} ${title}`,
				notes:
					status === 3
						? `${marker} Archived seeded todo`
						: `${marker} Seeded task for UI testing`,
				status,
				due_at: typeof dueDays === "number" ? iso(dueDays) : null,
				completed_at:
					typeof completedDays === "number" ? iso(completedDays) : null,
				created_at: iso(-5),
				updated_at: iso(-1),
			},
		});
	}

	return {
		ingredients: ingredients.length,
		products: products.length,
		productLinks: products.length,
		groups: groups.length,
		receipts: receipts.length,
		receiptItems: receiptItems.length,
		inventoryContainers: 5,
		inventoryItems: inventoryItems.length,
		inventoryItemImages: 8,
		recipes: recipes.length,
		recipeImages: recipes.length,
		recipeIngredients: recipeIngredientCount,
		mealPlanItems: 14,
		shoppingListItems: 24,
		todos: todoInputs.length,
		files: products.length + receipts.length + 8 + recipes.length,
	};
};

try {
	const args = parseArgs();
	if (args.help) {
		console.log(HELP);
	} else {
		const reset = args.resetDemo ? await resetDemoData() : null;
		const counts = args.resetOnly ? null : await seedDemoData(args.batch);
		console.log(
			JSON.stringify(
				{
					batch: args.resetOnly ? null : args.batch,
					dbPath: db.dbPath,
					filesPath: db.filesPath,
					reset,
					counts,
				},
				null,
				2,
			),
		);
	}
} finally {
	await closeDatabase(db);
}
