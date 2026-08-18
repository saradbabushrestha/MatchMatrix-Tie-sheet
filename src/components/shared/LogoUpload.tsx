import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn, readFileAsDataURL } from '@/lib/utils'

const MAX_BYTES = 1_200_000

/**
 * Image picker that stores a data URL.
 *
 * There is no file server, so images live inside the record itself — which is
 * why the size cap matters: localStorage fills up fast and a 5 MB team logo
 * would take the whole tournament down with it.
 */
export function LogoUpload({
  value,
  onChange,
  label = 'Logo',
  shape = 'square',
  size = 'md',
  className,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
  label?: string
  shape?: 'square' | 'circle'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const sizes = { sm: 'size-12', md: 'size-16', lg: 'size-20' } as const

  async function handleFile(file: File | undefined) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image', {
        description: 'Pick a PNG, JPG, SVG or WebP file.',
      })
      return
    }

    if (file.size > MAX_BYTES) {
      toast.error('That image is too large', {
        description: `Keep it under ${Math.round(MAX_BYTES / 1000)} KB — images are stored with the tournament.`,
      })
      return
    }

    setLoading(true)
    try {
      onChange(await readFileAsDataURL(file))
    } catch (error) {
      toast.error('Could not read that image', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary',
          shape === 'circle' ? 'rounded-full' : 'rounded-lg',
          sizes[size],
        )}
        aria-label={`Upload ${label.toLowerCase()}`}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" />
        )}
      </button>

      <div className="space-y-1">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or SVG · under 1 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
