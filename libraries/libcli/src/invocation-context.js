/**
 * @typedef {Object} InvocationContext
 * @property {Object} data
 * @property {Readonly<Object<string,string>>} args
 * @property {Readonly<Object<string,string|boolean|string[]>>} options
 */

/**
 * Deep-freeze an invocation context so handlers may assume immutability.
 * @param {{ data: Object, args: Object<string,string>, options: Object<string,string|boolean|string[]> }} raw
 * @returns {InvocationContext}
 */
export function freezeInvocationContext({ data, args, options }) {
  for (const v of Object.values(options)) {
    if (Array.isArray(v)) Object.freeze(v);
  }
  return Object.freeze({
    data,
    args: Object.freeze({ ...args }),
    options: Object.freeze({ ...options }),
  });
}
