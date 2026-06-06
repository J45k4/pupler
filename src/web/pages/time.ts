import {
	attachTimePageEvents,
	loadTimeTrackingPage,
	renderPage,
	renderSearchSelect,
} from "../app";

export const renderTimePage = () => {
	renderPage(
		`
			<section id="time-page">
				<section class="workspace time-workspace">
					<div class="time-sidebar">
						<section class="time-block" id="time-timer-panel"></section>

						<section class="time-block">
							<div class="section-header">
								<h2>Quick Actions</h2>
							</div>
							<div id="time-quick-actions" class="time-quick-actions"></div>
						</section>
					</div>

					<div class="time-main">
						<section class="time-block">
							<div class="section-header">
								<h2>Past Entries</h2>
								<div class="actions">
									<button
										class="primary"
										type="button"
										data-time-entry-create-open
									>
										Add Entry
									</button>
								</div>
							</div>
							<div id="time-status" class="status"></div>
							<div id="time-entry-results" class="time-entry-list"></div>
						</section>
					</div>
					</section>

					<div class="time-project-modal" id="time-project-modal" hidden>
						<div
							class="time-project-modal__backdrop"
							data-time-project-modal-close
						></div>
						<div
							class="time-project-modal__dialog card panel"
							role="dialog"
							aria-modal="true"
							aria-labelledby="time-project-modal-title"
						>
							<div class="section-header">
								<h2 id="time-project-modal-title">New Project</h2>
								<button
									class="secondary"
									type="button"
									aria-label="Close new project modal"
									data-time-project-modal-close
								>
									Close
								</button>
							</div>
							<form id="time-project-modal-form">
								<label>
									Project Name
									<input
										id="time-project-modal-name"
										name="project-name"
										placeholder="Project name"
										autocomplete="off"
										required
									/>
								</label>
								<div class="actions">
									<button class="primary" type="submit">Create Project</button>
									<button
										class="secondary"
										type="button"
										data-time-project-modal-close
									>
										Cancel
									</button>
							</div>
						</form>
						<div id="time-project-modal-status" class="status"></div>
					</div>
				</div>
				<div class="time-entry-create-modal" id="time-entry-create-modal" hidden>
					<div
						class="time-entry-create-modal__backdrop"
						data-time-entry-create-modal-close
					></div>
					<div
						class="time-entry-create-modal__dialog card panel"
						role="dialog"
						aria-modal="true"
						aria-labelledby="time-entry-create-modal-title"
					>
						<div class="section-header">
							<h2 id="time-entry-create-modal-title">Add Time Entry</h2>
							<button
								class="secondary"
								type="button"
								aria-label="Close add time entry modal"
								data-time-entry-create-modal-close
							>
								Close
							</button>
						</div>
						<form id="time-entry-create-form">
							<label>
								Project
								${renderSearchSelect({
									id: "time-entry-create-project",
									placeholder: "Type or choose a project",
									allowCreate: true,
									createLabelPrefix: "Create project",
									required: true,
								})}
							</label>
							<label>
								Description
								<input
									id="time-entry-create-description"
									placeholder="What did you work on?"
									autocomplete="off"
								/>
							</label>
							<div class="row">
								<label>
									Start
									<input id="time-entry-create-started-at" type="datetime-local" required />
								</label>
								<label>
									End
									<input id="time-entry-create-ended-at" type="datetime-local" />
								</label>
							</div>
							<div class="actions">
								<button class="primary" type="submit">Add Entry</button>
								<button
									class="secondary"
									type="button"
									data-time-entry-create-modal-close
								>
									Cancel
								</button>
							</div>
						</form>
						<div id="time-entry-create-status" class="status"></div>
					</div>
				</div>
			</section>
			`,
		);

	attachTimePageEvents();
	void loadTimeTrackingPage();
};
