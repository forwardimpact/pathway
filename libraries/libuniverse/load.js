/**
 * Supabase Storage Loader — uploads raw documents to Supabase Storage.
 *
 * @module libuniverse/load
 */

/**
 * Load raw documents into Supabase Storage.
 * Each entry in rawDocuments is a storage path → content pair.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Map<string, string>} rawDocuments - Storage path → content
 * @returns {Promise<{loaded: number, errors: string[]}>}
 */
export async function loadToSupabase(supabase, rawDocuments) {
  const errors = []
  let loaded = 0

  for (const [path, content] of rawDocuments) {
    const contentType = path.endsWith('.yaml') || path.endsWith('.yml')
      ? 'text/yaml'
      : 'application/json'

    const { error } = await supabase.storage
      .from('raw')
      .upload(path, content, { contentType, upsert: true })

    if (error) {
      errors.push(`${path}: ${error.message}`)
    } else {
      loaded++
    }
  }

  return { loaded, errors }
}
