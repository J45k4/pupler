type InfiniteScrollOptions<T> = {
	batchSize?: number;
	emptyHtml: string;
	renderItem: (item: T, index: number) => string;
	root: HTMLElement;
};

export class InfiniteScroll<T> {
	private readonly batchSize: number;
	private readonly emptyHtml: string;
	private readonly items: T[];
	private observer: IntersectionObserver | null = null;
	private readonly renderItem: (item: T, index: number) => string;
	private renderedCount = 0;
	private readonly root: HTMLElement;
	private sentinel: HTMLDivElement | null = null;

	constructor(options: InfiniteScrollOptions<T>, items: T[]) {
		this.batchSize = options.batchSize ?? 12;
		this.emptyHtml = options.emptyHtml;
		this.items = items;
		this.renderItem = options.renderItem;
		this.root = options.root;
	}

	destroy() {
		this.observer?.disconnect();
		this.observer = null;
		this.sentinel?.remove();
		this.sentinel = null;
	}

	render() {
		this.destroy();
		this.root.innerHTML = "";
		this.renderedCount = 0;

		if (!this.items.length) {
			this.root.innerHTML = this.emptyHtml;
			return;
		}

		this.appendNextBatch();
		if (this.renderedCount >= this.items.length) {
			return;
		}

		this.sentinel = document.createElement("div");
		this.sentinel.className = "infinite-scroll__sentinel";
		this.root.append(this.sentinel);

		this.observer = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) {
				return;
			}

			this.appendNextBatch();
			if (this.renderedCount >= this.items.length) {
				this.destroy();
			}
		});

		this.observer.observe(this.sentinel);
	}

	private appendNextBatch() {
		const slice = this.items.slice(
			this.renderedCount,
			this.renderedCount + this.batchSize,
		);
		if (!slice.length) {
			return;
		}

		const fragment = document.createRange().createContextualFragment(
			slice
				.map((item, index) =>
					this.renderItem(item, this.renderedCount + index),
				)
				.join(""),
		);

		if (this.sentinel) {
			this.root.insertBefore(fragment, this.sentinel);
		} else {
			this.root.append(fragment);
		}

		this.renderedCount += slice.length;
	}
}
