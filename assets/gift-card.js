/* Draws the QR code and copies the code. */
const MIN_SIZE = 120;
const STATUS_MS = 3000;

// The QR library loads separately and can be blocked.
if (typeof QRCode !== "undefined") {
  for (const element of document.querySelectorAll("[data-qr]")) {
    // The size comes from the stylesheet so the code and its box stay in step.
    const css = getComputedStyle(element).getPropertyValue("--qr-size");
    const size = Math.max(MIN_SIZE, parseFloat(css) || 0);
    new QRCode(element, {
      text: element.dataset.qr,
      width: size,
      height: size,
    });
  }
}

let clearStatus;

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;

  const row = button.parentElement;
  const status = row.querySelector("[data-copy-status]");
  let message = status.dataset.copied;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
  } catch {
    getSelection().selectAllChildren(row.querySelector("[data-code]"));
    message = status.dataset.failed;
  }

  status.textContent = message;
  clearTimeout(clearStatus);
  clearStatus = setTimeout(() => (status.textContent = ""), STATUS_MS);
});
