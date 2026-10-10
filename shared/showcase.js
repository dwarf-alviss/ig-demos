document.querySelectorAll("[data-load-studio]").forEach((button) => {
  button.addEventListener("click", () => {
    const mount = button.closest(".studio-mount"),
      frame = mount.querySelector("iframe");
    frame.src = frame.dataset.src;
    frame.hidden = false;
    mount.querySelector(".studio-placeholder").hidden = true;
    frame.focus();
  });
});
