import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '../../api/projects/projectApi'
import { ProjectForm } from '../../components/projects/ProjectForm'
import type { Project, ProjectInput } from '../../types/projects'

export function ProjectFormPage({ editing = false }: { editing?: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!editing) return
    let active = true
    projectApi.get(id).then((project) => { if (active) setProject(project) }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : '案件を取得できませんでした。') })
    return () => { active = false }
  }, [id, editing])
  async function save(input: ProjectInput) {
    const saved = editing ? await projectApi.update(id, input) : await projectApi.create(input)
    navigate(`/projects/${saved.id}`, { replace: true })
  }
  return <section className="mx-auto max-w-3xl"><Link to="/projects" className="text-sm text-sky-700 hover:underline">← 案件一覧</Link><h1 className="mt-4 text-3xl font-semibold">{editing ? 'Projectを編集' : '新規Project'}</h1>
    {error ? <p role="alert" className="mt-6 text-red-700">{error}</p> : editing && !project ? <p role="status" className="mt-6 text-slate-500">読み込み中…</p> : <ProjectForm initial={project ?? undefined} onSave={save} cancelTo={editing ? `/projects/${id}` : '/projects'} />}
  </section>
}
