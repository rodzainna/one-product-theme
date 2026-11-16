// In the theme editor, selecting a question block opens its item. The event
// fires on the div Shopify wraps around the block, so the item is inside it.
document.addEventListener("shopify:block:select", (event) => {
  const item = event.target.querySelector?.(".accordion__item");
  if (item) item.open = true;
});
