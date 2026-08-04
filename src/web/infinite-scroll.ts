type InfiniteScrollOptions<T> = {
	batchSize?: number;
	empty: () => Node;
	renderItem: (item: T, index: number) => Node;
	root: HTMLElement;
};

export class InfiniteScroll<T> {
	private readonly batchSize: number;
	private readonly empty: () => Node;
	private readonly items: T[];
	private observer: IntersectionObserver | null = null;
	private readonly renderItem: (item: T, index: number) => Node;
	private renderedCount = 0;
	private readonly root: HTMLElement;
	private sentinel: HTMLDivElement | null = null;

	constructor(options: InfiniteScrollOptions<T>, items: T[]) {
		this.batchSize = options.batchSize ?? 12;
		this.empty = options.empty;
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
		this.root.replaceChildren();
		this.renderedCount = 0;

		if (!this.items.length) {
			this.root.replaceChildren(this.empty());
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

		const fragment = document.createDocumentFragment();
		for (const [index, item] of slice.entries()) {
			fragment.append(this.renderItem(item, this.renderedCount + index));
		}

		if (this.sentinel) {
			this.root.insertBefore(fragment, this.sentinel);
		} else {
			this.root.append(fragment);
		}

		this.renderedCount += slice.length;
	}
}
