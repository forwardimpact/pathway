/**
 * Reusable form control components
 */

import { select, option, optgroup } from "./render.js";

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
