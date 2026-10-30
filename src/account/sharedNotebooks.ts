import { savedNotebooks, saveNotebooks, type Notebook, type NotebookStore } from '../library/notebooks'
import { server, type Profile } from './account'

// Notebooks of teachers and the administrator, kept on the school's server so they
// follow the person to any device. The administrator's are the school's: every
// teacher sees them and can assign them, but only the administrator changes them.

interface Row {
  id: string
  owner_id: string
  name: string
  piece_ids: string[]
  school: boolean
}

function fromRow(row: Row, me: Profile): Notebook {
  return { id: row.id, name: row.name, pieceIds: row.piece_ids, school: row.school, readOnly: row.owner_id !== me.id }
}

/** School notebooks first, then the person's own, each group in alphabetical order. */
export function sortNotebooks(notebooks: Notebook[]): Notebook[] {
  return [...notebooks].sort((a, b) => Number(!a.school) - Number(!b.school) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

export function accountNotebooks(me: Profile): NotebookStore {
  const save = async (notebook: Notebook) => {
    const { error } = await server().from('notebooks').upsert({
      id: notebook.id, owner_id: me.id, name: notebook.name.trim(), piece_ids: notebook.pieceIds,
      school: me.role === 'admin', updated_at: new Date().toISOString(),
    })
    if (error) throw error
  }
  return {
    async load() {
      // Notebooks made on this device before accounts move to the server once.
      const local = savedNotebooks()
      if (local.length) {
        await Promise.all(local.map(save))
        saveNotebooks([])
      }
      const { data, error } = await server().from('notebooks').select('id, owner_id, name, piece_ids, school')
      if (error) throw error
      return sortNotebooks((data as Row[]).map(row => fromRow(row, me)))
    },
    save,
    async remove(id) {
      const { error } = await server().from('notebooks').delete().eq('id', id)
      if (error) throw error
    },
  }
}
