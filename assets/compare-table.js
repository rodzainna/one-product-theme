// Turns on the phone switch and keeps the chosen column in data-showing, which the CSS reads.
// Without it every column shows and the table scrolls sideways.
class CompareTable extends HTMLElement {
  connectedCallback() {
    this.switcher = this.querySelector(".compare__switch");
    this.buttons = [...(this.switcher?.querySelectorAll("button") ?? [])];
    if (!this.buttons.length) return;
    this.switcher.hidden = false;
    this.switcher.addEventListener("click", this.onClick);
    this.show(this.dataset.showing ?? this.buttons[0].dataset.option);
  }

  onClick = (event) => {
    const button = event.target.closest("button");
    if (button) this.show(button.dataset.option);
  };

  show(column) {
    this.dataset.showing = column;
    for (const button of this.buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.option === column),
      );
    }
  }
}

if (!customElements.get("compare-table")) {
  customElements.define("compare-table", CompareTable);
}
