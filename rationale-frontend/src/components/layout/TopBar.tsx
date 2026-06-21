import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      <h1 className="topbar__title">{title}</h1>
      <button
        className="topbar__new-btn"
        onClick={() => navigate('/decisions/new')}
        id="btn-new-decision"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>New Decision</span>
      </button>
    </header>
  )
}
