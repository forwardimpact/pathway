/**
 * Reusable form control components
 */

import { select, option, optgroup, div, label, input, span } from "./render.js";

/**
 * Create a select element with initial value and change handler
 * @param {Object} options - Configuration options
 * @param {string} options.id - Element ID
 * @param {Array} options.items - Array of items to display
 * @param {string} options.initialValue - Initial selected value
 * @param {string} options.placeholder - Placeholder text for empty option
 * @param {Function} options.onChange - Callback when selection changes
 * @param {Function} [options.getDisplayName] - Optional function to get display name from item
 * @returns {HTMLElement}
 */
export function createSelectWithValue({
  id,
  items,
  initialValue,
  placeholder,
  onChange,
  getDisplayName,
}) {
  const displayFn = getDisplayName || ((item) => item.name);
  const selectEl = select(
    {
      className: "form-select",
      id,
    },
    option({ value: "" }, placeholder),
    ...items.map((item) => {
      const opt = option({ value: item.id }, displayFn(item));
      if (item.id === initialValue) {
        opt.selected = true;
      }
      return opt;
    }),
  );

  selectEl.addEventListener("change", (e) => {
    onChange(e.target.value);
  });

  return selectEl;
}

/**
 * Create a discipline select with optgroups for Professional and Management
 * @param {Object} options - Configuration options
 * @param {string} options.id - Element ID
 * @param {Array} options.disciplines - Array of discipline objects
 * @param {string} options.initialValue - Initial selected value
 * @param {string} options.placeholder - Placeholder text for empty option
 * @param {Function} options.onChange - Callback when selection changes
 * @param {Function} [options.getDisplayName] - Optional function to get display name from item
 * @returns {HTMLElement}
 */
export function createDisciplineSelect({
  id,
  disciplines,
  initialValue,
  placeholder,
  onChange,
  getDisplayName,
}) {
  const displayFn = getDisplayName || ((d) => d.specialization || d.name);

  // Separate disciplines by type
  const professional = disciplines.filter((d) => d.isProfessional);
  const management = disciplines.filter((d) => d.isManagement);

  // Sort each group alphabetically by display name
  professional.sort((a, b) => displayFn(a).localeCompare(displayFn(b)));
  management.sort((a, b) => displayFn(a).localeCompare(displayFn(b)));

  // Build options for a group
  const buildOptions = (items) =>
    items.map((item) => {
      const opt = option({ value: item.id }, displayFn(item));
      if (item.id === initialValue) {
        opt.selected = true;
      }
      return opt;
    });

  // Build optgroups - Professional first, then Management
  const groups = [];
  if (professional.length > 0) {
    groups.push(
      optgroup({ label: "Professional" }, ...buildOptions(professional)),
    );
  }
  if (management.length > 0) {
    groups.push(optgroup({ label: "Management" }, ...buildOptions(management)));
  }

  const selectEl = select(
    { className: "form-select", id },
    option({ value: "" }, placeholder),
    ...groups,
  );

  selectEl.addEventListener("change", (e) => {
    onChange(e.target.value);
  });

  return selectEl;
}

/**
 * Create a checkbox group with "Select All" toggle
 * @param {Object} options
 * @param {string} options.id - Element ID prefix
 * @param {Array<{label: string|null, items: Array}>} options.groups - Grouped items
 * @param {Set<string>} options.selected - Currently selected IDs
 * @param {Function} options.onChange - Callback with updated Set of selected IDs
 * @param {Function} [options.getDisplayName] - Get display name from item
 * @returns {HTMLElement}
 */
export function createCheckboxGroup({
  id,
  groups,
  selected,
  onChange,
  getDisplayName,
}) {
  const displayFn = getDisplayName || ((item) => item.name);
  const allItems = groups.flatMap((g) => g.items);

  function fireChange() {
    onChange(new Set(selected));
  }

  function updateSelectAll() {
    if (selectAllBox) {
      selectAllBox.checked =
        allItems.length > 0 && allItems.every((item) => selected.has(item.id));
      selectAllBox.indeterminate =
        !selectAllBox.checked && allItems.some((item) => selected.has(item.id));
    }
  }

  const selectAllBox = input({
    type: "checkbox",
    id: `${id}-select-all`,
    className: "form-checkbox",
  });
  selectAllBox.addEventListener("change", () => {
    if (selectAllBox.checked) {
      for (const item of allItems) selected.add(item.id);
    } else {
      selected.clear();
    }
    container.querySelectorAll("input[data-item-id]").forEach((cb) => {
      cb.checked = selected.has(cb.dataset.itemId);
    });
    fireChange();
  });

  const selectAllRow = div(
    { className: "checkbox-row select-all-row" },
    label(
      { className: "checkbox-label", htmlFor: `${id}-select-all` },
      selectAllBox,
      span({ className: "checkbox-text" }, "Select All"),
    ),
  );

  const container = div(
    { className: "checkbox-group", id },
    selectAllRow,
    ...groups.map((group) =>
      div(
        { className: "checkbox-group-section" },
        group.label
          ? div({ className: "checkbox-group-label" }, group.label)
          : null,
        ...group.items.map((item) => {
          const cb = input({
            type: "checkbox",
            id: `${id}-${item.id}`,
            className: "form-checkbox",
          });
          cb.dataset.itemId = item.id;
          cb.checked = selected.has(item.id);
          cb.addEventListener("change", () => {
            if (cb.checked) {
              selected.add(item.id);
            } else {
              selected.delete(item.id);
            }
            updateSelectAll();
            fireChange();
          });
          return div(
            { className: "checkbox-row" },
            label(
              { className: "checkbox-label", htmlFor: `${id}-${item.id}` },
              cb,
              span({ className: "checkbox-text" }, displayFn(item)),
            ),
          );
        }),
      ),
    ),
  );

  updateSelectAll();
  return container;
}

/**
 * Create a multi-discipline checkbox group with Professional/Management grouping
 * @param {Object} options
 * @param {string} options.id - Element ID prefix
 * @param {Array} options.disciplines - Array of discipline objects
 * @param {Set<string>} options.selected - Currently selected discipline IDs
 * @param {Function} options.onChange - Callback with updated Set of selected IDs
 * @param {Function} [options.getDisplayName] - Get display name from discipline
 * @returns {HTMLElement}
 */
export function createMultiDisciplineSelect({
  id,
  disciplines,
  selected,
  onChange,
  getDisplayName,
}) {
  const displayFn = getDisplayName || ((d) => d.specialization || d.name);

  const professional = disciplines
    .filter((d) => d.isProfessional)
    .sort((a, b) => displayFn(a).localeCompare(displayFn(b)));
  const management = disciplines
    .filter((d) => d.isManagement)
    .sort((a, b) => displayFn(a).localeCompare(displayFn(b)));

  const groups = [];
  if (professional.length > 0) {
    groups.push({ label: "Professional", items: professional });
  }
  if (management.length > 0) {
    groups.push({ label: "Management", items: management });
  }

  return createCheckboxGroup({
    id,
    groups,
    selected,
    onChange,
    getDisplayName: displayFn,
  });
}

/**
 * Create a multi-track checkbox group
 * @param {Object} options
 * @param {string} options.id - Element ID prefix
 * @param {Array} options.tracks - Array of track objects
 * @param {Set<string>} options.selected - Currently selected track IDs
 * @param {Function} options.onChange - Callback with updated Set of selected IDs
 * @returns {HTMLElement}
 */
export function createMultiTrackSelect({ id, tracks, selected, onChange }) {
  const sorted = [...tracks].sort((a, b) => a.name.localeCompare(b.name));

  return createCheckboxGroup({
    id,
    groups: [{ label: null, items: sorted }],
    selected,
    onChange,
    getDisplayName: (t) => t.name,
  });
}
