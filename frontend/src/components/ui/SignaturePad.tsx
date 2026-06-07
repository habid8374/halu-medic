'use client'
import { useRef, useCallback, useState, useEffect } from 'react'

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onClear: () => void
  label?: string
}

export default function SignaturePad({ onSave, onClear, label }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [saved, setSaved] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
    setSaved(false)
  }, [])

  const draw = useCallback((x: number, y: number) => {
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasStrokes(true)
  }, [])

  const endDraw = useCallback(() => {
    drawing.current = false
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e.nativeEvent, canvas)
    startDraw(pos.x, pos.y)
  }, [startDraw])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e.nativeEvent, canvas)
    draw(pos.x, pos.y)
  }, [draw])

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const touch = e.touches[0]
    const pos = getPos(touch, canvas)
    startDraw(pos.x, pos.y)
  }, [startDraw])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const touch = e.touches[0]
    const pos = getPos(touch, canvas)
    draw(pos.x, pos.y)
  }, [draw])

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
    setSaved(false)
    onClear()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
    setSaved(true)
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-slate-600">{label}</p>}
      <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: '200px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasStrokes}
          className="px-3 py-1.5 text-xs font-medium text-white bg-halu-600 hover:bg-halu-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Guardar firma
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Firma guardada
          </span>
        )}
      </div>
    </div>
  )
}
