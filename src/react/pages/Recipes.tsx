import { useEffect, useRef, useState } from "react"
import { apiFetch } from "../api"
import { Empty, Modal, Status, formatReceiptDateTime, useApi, type Recipe } from "../lib"
import { UnitSelect } from "../catalog"
import { findOrCreateIngredientByName } from "../catalog"

export type RecipeIngredient = {
	id: number
	recipe_id: number
	ingredient_id: number | null
	product_id: number | null
	name: string
	quantity: number
	unit: string
	is_optional: boolean
	notes: string | null
	created_at: string
	ingredient?: { id: number; name: string; default_unit: string | null } | null
	product?: { id: number; name: string; ingredient_id: number | null } | null
}

export type RecipeImage = {
	id: number
	recipe_id: number
	file_id: number
	created_at: string
	file: { id: number; content_type: string; filename: string | null; size_bytes: number; created_at: string }
}

export type RecipeDetail = Recipe & {
	ingredients?: RecipeIngredient[]
	recipe_images?: RecipeImage[]
}

export const RecipeCard = ({ recipe, link }: { recipe: Recipe; link: (p: string) => string }) => {
	const status = recipe.is_active ? "Active" : "Inactive"
	const meta = [
		recipe.servings === null ? null : recipe.servings === 1 ? "1 serving" : `${recipe.servings} servings`,
		status,
	].filter((v): v is string => v !== null)
	return (
		<a className="recipe-card" href={link(`/recipes/${recipe.id}`)} data-link="">
			<div className="recipe-card__header">
				<h2>{recipe.name}</h2>
				<span className="tag tag--neutral">{status}</span>
			</div>
			{recipe.description ? <p className="recipe-card__description">{recipe.description}</p> : null}
			<div className="recipe-card__meta">{meta.join(" • ")}</div>
		</a>
	)
}

export const RecipesPage = ({ link }: { link: (p: string) => string }) => {
	const { data, loading, error } = useApi<Recipe[]>("/api/recipes?sort=name&order=asc")
	const recipes = data ?? []

	return (
		<section className="card panel page-panel">
			<div className="page-heading">
				<div>
					<p className="page-copy">Build recipe basics, ingredient lists, and photos in one place.</p>
				</div>
				<a className="primary action-link" href={link("/recipes/new")} data-link="">
					Add Recipe
				</a>
			</div>
			<Status
				message={loading ? "Loading…" : error ?? (recipes.length ? `Loaded ${recipes.length} recipe(s).` : "No recipes yet.")}
				error={!!error}
			/>
			{!loading && !error ? (
				recipes.length === 0 ? (
					<Empty message="No recipes yet. Add the first one to start building your meal library." />
				) : (
					<div id="recipe-results" className="recipe-results">
						{recipes.map((r) => (
							<RecipeCard key={r.id} recipe={r} link={link} />
						))}
					</div>
				)
			) : null}
		</section>
	)
}

export const RecipeCreatePage = ({
	link,
	navigate,
}: {
	link: (p: string) => string
	navigate: (p: string) => void
}) => {
	const [name, setName] = useState("")
	const [servings, setServings] = useState("")
	const [isActive, setIsActive] = useState(true)
	const [description, setDescription] = useState("")
	const [instructions, setInstructions] = useState("")
	const [drafts, setDrafts] = useState<Array<{ name: string; quantity: number; unit: string }>>([])
	const [draftName, setDraftName] = useState("")
	const [draftQuantity, setDraftQuantity] = useState("")
	const [draftUnit, setDraftUnit] = useState("tsp")
	const [status, setStatus] = useState("")
	const [statusError, setStatusError] = useState(false)

	const addDraft = () => {
		const trimmed = draftName.trim()
		const quantity = Number.parseFloat(draftQuantity)
		const unit = draftUnit.trim()
		if (!trimmed) {
			setStatus("Ingredient name is required")
			setStatusError(true)
			return
		}
		if (!Number.isFinite(quantity) || quantity <= 0) {
			setStatus("Ingredient quantity must be greater than zero")
			setStatusError(true)
			return
		}
		if (!unit) {
			setStatus("Ingredient unit is required")
			setStatusError(true)
			return
		}
		setDrafts((d) => [...d, { name: trimmed, quantity, unit }])
		setDraftName("")
		setDraftQuantity("")
		setStatus("")
		setStatusError(false)
	}

	const create = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = name.trim()
		if (!trimmed) {
			setStatus("Recipe name is required")
			setStatusError(true)
			return
		}
		const parsedServings = servings.trim() ? Number.parseInt(servings, 10) : null
		if (parsedServings !== null && (!Number.isInteger(parsedServings) || parsedServings < 1)) {
			setStatus("Servings must be a whole number greater than zero")
			setStatusError(true)
			return
		}
		try {
			const recipe = await apiFetch<Recipe>("/api/recipes", {
				method: "POST",
				body: JSON.stringify({
					name: trimmed,
					description: description.trim() || null,
					instructions: instructions.trim() || null,
					servings: parsedServings,
					is_active: isActive,
				}),
			})
			for (const ingredient of drafts) {
				await apiFetch("/api/recipe-ingredients", {
					method: "POST",
					body: JSON.stringify({
						recipe_id: recipe.id,
						ingredient_id: null,
						product_id: null,
						name: ingredient.name,
						quantity: ingredient.quantity,
						unit: ingredient.unit,
						is_optional: false,
						notes: null,
					}),
				})
			}
			setStatus(`Created recipe #${recipe.id}: ${recipe.name}`)
			setStatusError(false)
			navigate(link(`/recipes/${recipe.id}`))
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to create recipe")
			setStatusError(true)
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<div>
					<span className="eyebrow">Recipes</span>
					<p className="page-copy">Add the recipe basics, ingredients, and cooking steps in one place.</p>
				</div>
				<a className="secondary action-link" href={link("/recipes")} data-link="">
					Back To Recipes
				</a>
			</section>
			<section className="workspace workspace--single">
				<div className="card panel">
					<form id="recipe-create-form" onSubmit={create}>
						<label htmlFor="recipe-name">
							Name
							<input id="recipe-name" name="name" placeholder="Creamy tomato pasta" autoComplete="off" required value={name} onChange={(e) => setName(e.target.value)} />
						</label>
						<div className="row">
							<label htmlFor="recipe-servings">
								Servings
								<input id="recipe-servings" name="servings" type="number" inputMode="numeric" min="1" step="1" placeholder="4" value={servings} onChange={(e) => setServings(e.target.value)} />
							</label>
							<label className="checkbox-toggle recipe-form__toggle" htmlFor="recipe-is-active">
								<input id="recipe-is-active" name="is_active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
								<span>Active recipe</span>
							</label>
						</div>
						<label htmlFor="recipe-description">
							Description
							<textarea id="recipe-description" name="description" rows={3} placeholder="A quick weeknight pasta with pantry ingredients." value={description} onChange={(e) => setDescription(e.target.value)} />
						</label>
						<section className="recipe-create-ingredients">
							<div className="recipe-create-ingredient-form">
								<label htmlFor="recipe-ingredient-draft-name">
									Ingredient
									<input id="recipe-ingredient-draft-name" placeholder="Salt" autoComplete="off" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
								</label>
								<label htmlFor="recipe-ingredient-draft-quantity">
									Quantity
									<input id="recipe-ingredient-draft-quantity" type="number" inputMode="decimal" min="0.001" step="0.001" placeholder="2" value={draftQuantity} onChange={(e) => setDraftQuantity(e.target.value)} />
								</label>
								<UnitSelect id="recipe-ingredient-draft-unit" name="ingredient_unit" label="Unit" value={draftUnit} onChange={setDraftUnit} />
								<button id="add-recipe-ingredient-draft-button" className="secondary" type="button" onClick={addDraft}>
									Add
								</button>
							</div>
							<div id="recipe-ingredient-preview" className={drafts.length ? "recipe-create-ingredient-preview" : "recipe-create-ingredient-preview empty"}>
								{drafts.length === 0 ? (
									"No ingredients added yet."
								) : (
									drafts.map((ingredient, index) => (
										<div key={index} className="recipe-create-ingredient-preview__item">
											<span>{ingredient.name}</span>
											<div className="recipe-create-ingredient-preview__meta">
												<strong>{`${ingredient.quantity} ${ingredient.unit}`}</strong>
												<button className="secondary" type="button" onClick={() => setDrafts((d) => d.filter((_, i) => i !== index))}>
													Remove
												</button>
											</div>
										</div>
									))
								)}
							</div>
						</section>
						<label htmlFor="recipe-instructions">
							Instructions
							<textarea id="recipe-instructions" name="instructions" rows={8} placeholder={"1. Boil the pasta.\n2. Simmer the sauce.\n3. Toss together and serve."} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
						</label>
						<div className="actions">
							<button className="primary" type="submit">
								Create Recipe
							</button>
							<a className="secondary action-link" href={link("/recipes")} data-link="">
								Cancel
							</a>
						</div>
					</form>
					<Status message={status} error={statusError} />
				</div>
			</section>
		</>
	)
}

export const RecipeDetailPage = ({ id, link }: { id: string; link: (p: string) => string }) => {
	const recipeId = Number.parseInt(id, 10)
	const valid = Number.isInteger(recipeId)
	const { data: recipe, loading, error, reload } = useApi<RecipeDetail>(valid ? `/api/recipes/${recipeId}` : null)

	const [name, setName] = useState<string | null>(null)
	const [servings, setServings] = useState<string | null>(null)
	const [isActive, setIsActive] = useState<boolean | null>(null)
	const [description, setDescription] = useState<string | null>(null)
	const [instructions, setInstructions] = useState<string | null>(null)
	const [detailStatus, setDetailStatus] = useState("")
	const [detailError, setDetailError] = useState(false)
	const [ingredientStatus, setIngredientStatus] = useState("")
	const [pictureStatus, setPictureStatus] = useState("")
	const [modalOpen, setModalOpen] = useState(false)
	const [editing, setEditing] = useState<RecipeIngredient | null>(null)
	const [ingName, setIngName] = useState("")
	const [ingQuantity, setIngQuantity] = useState("1")
	const [ingUnit, setIngUnit] = useState("pcs")
	const [ingOptional, setIngOptional] = useState(false)
	const [ingNotes, setIngNotes] = useState("")
	const [modalStatus, setModalStatus] = useState("")
	const [files, setFiles] = useState<FileList | null>(null)

	useEffectInit(recipe, (r) => {
		setName(r.name)
		setServings(r.servings === null ? "" : String(r.servings))
		setIsActive(r.is_active)
		setDescription(r.description ?? "")
		setInstructions(r.instructions ?? "")
	})

	if (!valid) return <div className="card panel page-panel"><p className="page-copy">Recipe id is invalid.</p></div>
	if (loading) return <p className="page-copy">Loading…</p>
	if (error || !recipe) return <Status message={error ?? "Failed to load recipe."} error />

	const ingredients = recipe.ingredients ?? []
	const images = recipe.recipe_images ?? []

	const saveDetail = async (event: React.FormEvent) => {
		event.preventDefault()
		try {
			const parsed = (servings ?? "").trim() ? Number.parseInt(servings ?? "", 10) : null
			await apiFetch(`/api/recipes/${recipe.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					name: (name ?? "").trim(),
					servings: parsed,
					is_active: isActive ?? true,
					description: (description ?? "").trim() || null,
					instructions: (instructions ?? "").trim() || null,
				}),
			})
			setDetailStatus("Saved recipe.")
			setDetailError(false)
			reload()
		} catch (err) {
			setDetailStatus(err instanceof Error ? err.message : "Failed to save recipe.")
			setDetailError(true)
		}
	}

	const openAdd = () => {
		setEditing(null)
		setIngName("")
		setIngQuantity("1")
		setIngUnit("pcs")
		setIngOptional(false)
		setIngNotes("")
		setModalStatus("")
		setModalOpen(true)
	}

	const openEdit = (ingredient: RecipeIngredient) => {
		setEditing(ingredient)
		setIngName(ingredient.name)
		setIngQuantity(String(ingredient.quantity))
		setIngUnit(ingredient.unit)
		setIngOptional(ingredient.is_optional)
		setIngNotes(ingredient.notes ?? "")
		setModalStatus("")
		setModalOpen(true)
	}

	const saveIngredient = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = ingName.trim()
		const quantity = Number.parseFloat(ingQuantity)
		if (!trimmed) {
			setModalStatus("Ingredient name is required")
			return
		}
		if (!Number.isFinite(quantity) || quantity <= 0) {
			setModalStatus("Quantity must be greater than zero")
			return
		}
		try {
			const found = await findOrCreateIngredientByName(trimmed, ingUnit.trim() || "pcs")
			const unit = ingUnit.trim() || found.default_unit || "pcs"
			if (editing) {
				await apiFetch(`/api/recipe-ingredients/${editing.id}`, {
					method: "PATCH",
					body: JSON.stringify({
						name: trimmed,
						ingredient_id: found.id,
						product_id: null,
						quantity,
						unit,
						is_optional: ingOptional,
						notes: ingNotes.trim() || null,
					}),
				})
				setIngredientStatus(`Saved ${trimmed} in ${recipe.name}.`)
			} else {
				await apiFetch("/api/recipe-ingredients", {
					method: "POST",
					body: JSON.stringify({
						recipe_id: recipe.id,
						name: trimmed,
						ingredient_id: found.id,
						product_id: null,
						quantity,
						unit,
						is_optional: ingOptional,
						notes: ingNotes.trim() || null,
					}),
				})
				setIngredientStatus(`Added ${trimmed} to ${recipe.name}.`)
			}
			setModalOpen(false)
			reload()
		} catch (err) {
			setModalStatus(err instanceof Error ? err.message : "Failed to save recipe ingredient")
		}
	}

	const removeIngredient = async (ingredient: RecipeIngredient) => {
		try {
			await apiFetch(`/api/recipe-ingredients/${ingredient.id}`, { method: "DELETE" })
			setIngredientStatus(`Removed ${ingredient.name}.`)
			reload()
		} catch (err) {
			setIngredientStatus(err instanceof Error ? err.message : "Failed to remove ingredient.")
		}
	}

	const upload = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!files?.length) {
			setPictureStatus("Choose one or more images before uploading.")
			return
		}
		try {
			for (const file of Array.from(files)) {
				const formData = new FormData()
				formData.set("file", file)
				const response = await fetch(`/api/recipes/${recipe.id}/pictures`, { method: "POST", body: formData })
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as { error?: string } | null
					throw new Error(body?.error ?? "Failed to upload image")
				}
			}
			setFiles(null)
			setPictureStatus("Uploaded images.")
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to upload images.")
		}
	}

	const removeImage = async (imageId: number) => {
		try {
			const response = await fetch(`/api/recipes/${recipe.id}/pictures/${imageId}`, { method: "DELETE" })
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null
				throw new Error(body?.error ?? "Failed to remove image")
			}
			setPictureStatus("Removed image.")
			reload()
		} catch (err) {
			setPictureStatus(err instanceof Error ? err.message : "Failed to remove image.")
		}
	}

	return (
		<>
			<section className="page-heading page-heading--compact">
				<a className="secondary action-link" href={link("/recipes")} data-link="">
					Back To Recipes
				</a>
			</section>
			<section className="workspace recipe-detail-grid">
				<div className="card panel">
					<h2>Images</h2>
					{images.length ? (
						<div className="recipe-image-gallery">
							{images.map((image) => (
								<article key={image.id} className="recipe-image-card">
									<img
										className="recipe-image-card__image"
										src={`/api/recipes/${recipe.id}/pictures/${image.id}?updated=${encodeURIComponent(image.created_at)}`}
										alt={image.file.filename ?? recipe.name}
									/>
									<div className="recipe-image-card__meta">
										<div>
											<strong>{image.file.filename ?? `Image #${image.id}`}</strong>
											<div className="section-copy">{formatReceiptDateTime(image.created_at)}</div>
										</div>
										<button className="secondary" type="button" onClick={() => void removeImage(image.id)}>
											Remove
										</button>
									</div>
								</article>
							))}
						</div>
					) : (
						<Empty message="No recipe images uploaded yet." />
					)}
					<form id="recipe-picture-form" className="recipe-picture__form" onSubmit={upload}>
						<label>
							Images
							<input id="recipe-picture-input" name="picture" type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} />
						</label>
						<div className="actions">
							<button className="secondary" type="submit">
								Upload Images
							</button>
						</div>
					</form>
					<h2>Summary</h2>
					<dl className="receipt-metadata">
						<div>
							<dt>Status</dt>
							<dd>{recipe.is_active ? "Active" : "Inactive"}</dd>
						</div>
						<div>
							<dt>Servings</dt>
							<dd>{recipe.servings === null ? "-" : recipe.servings === 1 ? "1 serving" : `${recipe.servings} servings`}</dd>
						</div>
						<div>
							<dt>Created</dt>
							<dd>{formatReceiptDateTime(recipe.created_at)}</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>{formatReceiptDateTime(recipe.updated_at)}</dd>
						</div>
					</dl>
					<Status message={pictureStatus} error={!!pictureStatus && pictureStatus !== "Uploaded images." && pictureStatus !== "Removed image."} />
				</div>
				<div className="recipe-detail-stack">
					<div className="card panel">
						<section className="recipe-detail-section">
							<h2>Recipe Details</h2>
							<form id="recipe-detail-form" onSubmit={saveDetail}>
								<label htmlFor="recipe-detail-name">
									Name
									<input id="recipe-detail-name" name="name" required value={name ?? ""} onChange={(e) => setName(e.target.value)} />
								</label>
								<div className="row">
									<label htmlFor="recipe-detail-servings">
										Servings
										<input id="recipe-detail-servings" name="servings" type="number" inputMode="numeric" min="1" step="1" placeholder="4" value={servings ?? ""} onChange={(e) => setServings(e.target.value)} />
									</label>
									<label className="checkbox-toggle recipe-form__toggle" htmlFor="recipe-detail-is-active">
										<input id="recipe-detail-is-active" name="is_active" type="checkbox" checked={isActive ?? true} onChange={(e) => setIsActive(e.target.checked)} />
										<span>Active recipe</span>
									</label>
								</div>
								<label htmlFor="recipe-detail-description">
									Description
									<textarea id="recipe-detail-description" name="description" rows={4} placeholder="Short summary of the recipe" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
								</label>
								<label htmlFor="recipe-detail-instructions">
									Instructions
									<textarea id="recipe-detail-instructions" name="instructions" rows={10} placeholder="Describe the cooking steps" value={instructions ?? ""} onChange={(e) => setInstructions(e.target.value)} />
								</label>
								<div className="actions">
									<button className="primary" type="submit">
										Save Recipe
									</button>
								</div>
							</form>
							<Status message={detailStatus} error={detailError} />
						</section>
					</div>
					<div className="card panel">
						<section className="recipe-detail-section">
							<div className="section-header recipe-detail-section__header">
								<div className="recipe-ingredient-summary">
									<h2>Ingredients</h2>
									<span className="tag tag--neutral">{`${ingredients.length} ${ingredients.length === 1 ? "item" : "items"}`}</span>
								</div>
								<button id="open-recipe-ingredient-modal-button" className="primary" type="button" onClick={openAdd}>
									Add Ingredient
								</button>
							</div>
							{ingredients.length === 0 ? (
								<Empty message="No ingredients added yet." />
							) : (
								<div className="recipe-ingredient-list">
									{ingredients.map((ingredient) => (
										<article key={ingredient.id} className="recipe-ingredient-item">
											<button className="recipe-ingredient-item__select" type="button" onClick={() => openEdit(ingredient)}>
												<div className="recipe-ingredient-item__main">
													<div className="recipe-ingredient-item__header">
														<strong>{ingredient.name}</strong>
														{ingredient.is_optional ? <span className="tag tag--neutral">Optional</span> : null}
													</div>
													<div className="recipe-ingredient-item__meta">
														<span>{`${ingredient.quantity} ${ingredient.unit}`}</span>
													</div>
													{ingredient.notes ? <div className="section-copy">{ingredient.notes}</div> : null}
												</div>
											</button>
											<button className="secondary" type="button" onClick={() => void removeIngredient(ingredient)}>
												Remove
											</button>
										</article>
									))}
								</div>
							)}
							<Status message={ingredientStatus} error={false} />
						</section>
					</div>
				</div>
			</section>
			<Modal
				id="recipe-ingredient-modal"
				title={editing ? "Edit Ingredient" : "Add Ingredient"}
				open={modalOpen}
				onClose={() => setModalOpen(false)}
			>
				<form id="recipe-ingredient-modal-form" className="recipe-ingredient-form" onSubmit={saveIngredient}>
					<label htmlFor="recipe-ingredient-name">
						Ingredient
						<input id="recipe-ingredient-name" name="name" placeholder="Tomatoes" required value={ingName} onChange={(e) => setIngName(e.target.value)} />
					</label>
					<div className="recipe-ingredient-form__row">
						<label htmlFor="recipe-ingredient-quantity">
							Quantity
							<input id="recipe-ingredient-quantity" name="quantity" type="number" inputMode="decimal" min="0.01" step="0.01" required value={ingQuantity} onChange={(e) => setIngQuantity(e.target.value)} />
						</label>
						<UnitSelect id="recipe-ingredient-unit" name="unit" label="Unit" value={ingUnit} onChange={setIngUnit} />
						<label className="checkbox-toggle recipe-ingredient-form__toggle" htmlFor="recipe-ingredient-optional">
							<input id="recipe-ingredient-optional" name="is_optional" type="checkbox" checked={ingOptional} onChange={(e) => setIngOptional(e.target.checked)} />
							<span>Optional</span>
						</label>
					</div>
					<label htmlFor="recipe-ingredient-notes">
						Notes
						<input id="recipe-ingredient-notes" name="notes" placeholder="Finely chopped or room temperature" value={ingNotes} onChange={(e) => setIngNotes(e.target.value)} />
					</label>
					<div className="actions">
						<button id="recipe-ingredient-modal-submit" className="primary" type="submit">
							{editing ? "Save Ingredient" : "Add Ingredient"}
						</button>
					</div>
				</form>
				<Status message={modalStatus} error={!!modalStatus} />
			</Modal>
		</>
	)
}

const useEffectInit = (recipe: RecipeDetail | null, init: (r: RecipeDetail) => void) => {
	const initialized = useRef<number | null>(null)
	useEffect(() => {
		if (!recipe || initialized.current === recipe.id) return
		initialized.current = recipe.id
		init(recipe)
	}, [recipe])
}
