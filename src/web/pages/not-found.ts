import {
	renderPage,
} from "../app";

export const renderNotFoundPage = () => {
	renderPage(
		`
			<section class="card panel page-panel">
				<div class="page-heading">
					<div>
						<span class="eyebrow">Not Found</span>
						<h1 class="page-title">That frontend route is not registered.</h1>
					</div>
				</div>
				<p class="page-copy">
					Use the navbar to return to a known page.
				</p>
			</section>
		`,
	);
};
