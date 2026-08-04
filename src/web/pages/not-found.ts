import {
	renderPage,
} from "../app";
import { createElement } from "../lib/dom";

export const renderNotFoundPage = () => {
	renderPage(
		createElement(
			"section",
			{ className: "card panel page-panel" },
			createElement(
				"div",
				{ className: "page-heading" },
				createElement(
					"div",
					{},
					createElement("span", { className: "eyebrow", text: "Not Found" }),
					createElement("h1", {
						className: "page-title",
						text: "That frontend route is not registered.",
					}),
				),
			),
			createElement("p", {
				className: "page-copy",
				text: "Use the navbar to return to a known page.",
			}),
		),
	);
};
