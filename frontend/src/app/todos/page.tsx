import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>📋</span> Supabase Todo List
        </h1>
        <p className="text-xs text-zinc-400">
          This page fetches mock data dynamically from your Supabase instance using SSR.
        </p>
        <ul className="space-y-2 pt-2 border-t border-zinc-800">
          {todos && todos.length > 0 ? (
            todos.map((todo: any) => (
              <li 
                key={todo.id} 
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-950/50 border border-zinc-800/60 text-sm hover:border-zinc-700 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{todo.name}</span>
              </li>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-zinc-500">
              No todos found. Add some to your `todos` table in Supabase!
            </div>
          )}
        </ul>
      </div>
    </div>
  )
}
