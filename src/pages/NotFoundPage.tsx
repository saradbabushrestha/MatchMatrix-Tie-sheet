import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <EmptyState
      className="mt-12"
      icon={<Compass />}
      title="Page not found"
      description="That link does not point anywhere in the app."
      action={{ label: 'Back to tournaments', onClick: () => navigate('/') }}
    />
  )
}
