// ============================================================
// ATS PROJECT
// File      : src/controllers/commandController.js
// Sprint    : 3.9.2
// Revision  : R2
// Build     : 2026-08-05
// Type      : PARTIAL PATCH
// Purpose   : Fire and recon-by-fire target selection routing
// ============================================================

export function createCommandController({
  state,
  commandOptions,
  commandCategorySelector = ".command-category",
  getSelectedUnit,
  commandPanel,
  firePanel,
  setMessage,
  refreshFogAndRender,
  updateSummary,
  render,
}) {
  function updateSelectedCommandButton(
    selectedButton,
  ) {
    commandOptions
      .querySelectorAll(
        ".command-option",
      )
      .forEach((button) => {
        button.classList.toggle(
          "is-selected",
          button === selectedButton,
        );
      });
  }

  function updateActiveCategoryButton(
    category,
  ) {
    document
      .querySelectorAll(
        commandCategorySelector,
      )
      .forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset
            .commandCategory ===
            category,
        );
      });
  }

  function handleCommandSelection(
    command,
    selectedButton,
  ) {
    const unit = getSelectedUnit();

    if (!unit) {
      return false;
    }

    if (unit.destroyed) {
      setMessage(
        "격파된 전차는 명령을 수행할 수 없습니다.",
      );

      return false;
    }

    if (
      typeof command.execute ===
        "function" &&
      !command.needsTarget
    ) {
      command.execute({
        unit,
        turn: state.turn,
      });

      updateSummary();
      render();

      return true;
    }

    state.selectedCommand = command;

    updateSelectedCommandButton(
      selectedButton,
    );

    if (command.needsTarget) {
      setMessage(
        `${command.label}: 지도에서 목표 헥스를 선택하세요.`,
      );

      return true;
    }

    unit.command = command.label;

    updateSummary();
    render();

    return true;
  }

  function selectCategory(category) {
    state.activeCategory = category;
    state.selectedCommand = null;

    updateActiveCategoryButton(
      category,
    );

    if (
      category === "fire" ||
      category === "combat"
    ) {
      firePanel.render();
    } else {
      commandPanel.render(
        category,
      );
    }
  }

  function beginFireTargetSelection() {
    const unit = getSelectedUnit();

    if (
      !unit ||
      unit.destroyed
    ) {
      setMessage(
        "사격 목표를 지정할 수 없습니다.",
      );

      return false;
    }

    state.selectedCommand = {
      id: "fire-target",
      label: "표적 지정",
      needsTarget: true,
    };

    return true;
  }

  function beginReconByFireTargetSelection() {
    const unit = getSelectedUnit();

    if (
      !unit ||
      unit.destroyed
    ) {
      setMessage(
        "화력수색 목표를 지정할 수 없습니다.",
      );

      return false;
    }

    state.selectedCommand = {
      id: "recon-by-fire",
      label: "화력수색",
      needsTarget: true,
    };

    return true;
  }

  function clearSelectedCommand() {
    state.selectedCommand = null;

    updateSelectedCommandButton(
      null,
    );
  }

  function refreshActivePanel() {
    if (
      state.activeCategory === "fire" ||
      state.activeCategory === "combat"
    ) {
      firePanel.render();
      return;
    }

    if (state.activeCategory) {
      commandPanel.refresh(
        state.activeCategory,
      );
    }
  }

  return {
    handleCommandSelection,
    selectCategory,
    beginFireTargetSelection,
    beginReconByFireTargetSelection,
    clearSelectedCommand,
    refreshActivePanel,
  };
}
