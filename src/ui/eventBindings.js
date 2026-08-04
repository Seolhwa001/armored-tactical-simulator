// src/ui/eventBindings.js — 새 파일

export function bindApplicationEvents({
  canvas,
  difficultySelect,
  developerModeToggle,

  getActiveScreen,
  getCamera,

  onAction,
  onCommandCategory,
  onDifficultyChange,
  onDeveloperModeChange,

  onMapTap,
  onCameraMove,
  onResize,
}) {
  function handleDocumentClick(
    event,
  ) {
    const actionButton =
      event.target.closest(
        "[data-action]",
      );

    if (actionButton) {
      onAction(
        actionButton.dataset.action,
      );

      return;
    }

    const categoryButton =
      event.target.closest(
        "[data-command-category]",
      );

    if (categoryButton) {
      onCommandCategory(
        categoryButton.dataset
          .commandCategory,
      );
    }
  }

  function handleDifficultyChange(
    event,
  ) {
    onDifficultyChange(
      event.target.value,
    );
  }

  function handleDeveloperModeChange(
    event,
  ) {
    onDeveloperModeChange(
      event.target.checked,
    );
  }

  function beginPointerDrag(
    event,
  ) {
    const camera =
      getCamera();

    camera.dragging = true;
    camera.pointerId =
      event.pointerId;

    camera.lastX =
      event.clientX;

    camera.lastY =
      event.clientY;

    camera.downX =
      event.clientX;

    camera.downY =
      event.clientY;

    camera.moved = false;

    canvas.setPointerCapture(
      event.pointerId,
    );
  }

  function continuePointerDrag(
    event,
  ) {
    const camera =
      getCamera();

    if (
      !camera.dragging ||
      event.pointerId !==
        camera.pointerId
    ) {
      return;
    }

    const totalMovement =
      Math.hypot(
        event.clientX -
          camera.downX,

        event.clientY -
          camera.downY,
      );

    if (totalMovement > 7) {
      camera.moved = true;
    }

    const deltaX =
      event.clientX -
      camera.lastX;

    const deltaY =
      event.clientY -
      camera.lastY;

    camera.x += deltaX;
    camera.y += deltaY;

    camera.lastX =
      event.clientX;

    camera.lastY =
      event.clientY;

    onCameraMove(
      camera,
    );
  }

  function endPointerDrag(
    event,
  ) {
    const camera =
      getCamera();

    if (
      event.pointerId !==
      camera.pointerId
    ) {
      return;
    }

    const wasTap =
      !camera.moved;

    camera.dragging = false;
    camera.pointerId = null;

    if (
      canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      canvas.releasePointerCapture(
        event.pointerId,
      );
    }

    if (wasTap) {
      onMapTap(
        event.clientX,
        event.clientY,
      );
    }
  }

  function handleWindowResize() {
    if (
      getActiveScreen() !==
      "battle"
    ) {
      return;
    }

    onResize();
  }

  document.addEventListener(
    "click",
    handleDocumentClick,
  );

  difficultySelect.addEventListener(
    "change",
    handleDifficultyChange,
  );

  developerModeToggle.addEventListener(
    "change",
    handleDeveloperModeChange,
  );

  canvas.addEventListener(
    "pointerdown",
    beginPointerDrag,
  );

  canvas.addEventListener(
    "pointermove",
    continuePointerDrag,
  );

  canvas.addEventListener(
    "pointerup",
    endPointerDrag,
  );

  canvas.addEventListener(
    "pointercancel",
    endPointerDrag,
  );

  window.addEventListener(
    "resize",
    handleWindowResize,
  );

  return function unbindApplicationEvents() {
    document.removeEventListener(
      "click",
      handleDocumentClick,
    );

    difficultySelect.removeEventListener(
      "change",
      handleDifficultyChange,
    );

    developerModeToggle.removeEventListener(
      "change",
      handleDeveloperModeChange,
    );

    canvas.removeEventListener(
      "pointerdown",
      beginPointerDrag,
    );

    canvas.removeEventListener(
      "pointermove",
      continuePointerDrag,
    );

    canvas.removeEventListener(
      "pointerup",
      endPointerDrag,
    );

    canvas.removeEventListener(
      "pointercancel",
      endPointerDrag,
    );

    window.removeEventListener(
      "resize",
      handleWindowResize,
    );
  };
}
