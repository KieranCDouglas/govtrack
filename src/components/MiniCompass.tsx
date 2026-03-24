import { useEffect, useRef } from 'react'

interface Props {
  compassX: number
  compassY: number
  name: string
  party: string
  userX?: number | null
  userY?: number | null
}

export default function MiniCompass({ compassX, compassY, name, party, userX, userY }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const pad = 28
    const cx = W / 2
    const cy = H / 2
    const rw = W / 2 - pad
    const rh = H / 2 - pad

    ctx.clearRect(0, 0, W, H)

    // Quadrant backgrounds
    ctx.fillStyle = 'rgba(34,197,94,0.07)'
    ctx.fillRect(pad, pad, rw, rh)
    ctx.fillStyle = 'rgba(59,130,246,0.06)'
    ctx.fillRect(cx, pad, rw, rh)
    ctx.fillStyle = 'rgba(168,85,247,0.07)'
    ctx.fillRect(pad, cy, rw, rh)
    ctx.fillStyle = 'rgba(239,68,68,0.07)'
    ctx.fillRect(cx, cy, rw, rh)

    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, pad)
    ctx.lineTo(cx, H - pad)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pad, cy)
    ctx.lineTo(W - pad, cy)
    ctx.stroke()

    // Labels
    ctx.font = '7px Satoshi, sans-serif'
    ctx.fillStyle = 'rgba(148,163,184,0.8)'
    ctx.textAlign = 'left'
    ctx.fillText('← Collectivist', pad + 2, cy - 4)
    ctx.textAlign = 'right'
    ctx.fillText('Free Market →', W - pad - 2, cy - 4)
    ctx.textAlign = 'center'
    ctx.fillText('↑ High Social Liberty', cx, pad + 9)
    ctx.fillText('↓ Low Social Liberty', cx, H - pad - 3)

    // Member dot
    const dotX = cx + compassX * rw
    const dotY = cy - compassY * rh
    const partyColor =
      party === 'Democrat' ? '59,130,246' : party === 'Republican' ? '239,68,68' : '34,197,94'

    const grd = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 4)
    grd.addColorStop(0, `rgba(${partyColor},0.9)`)
    grd.addColorStop(1, `rgba(${partyColor},0.3)`)
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(${partyColor},0.8)`
    ctx.lineWidth = 1
    ctx.stroke()

    // User dot if provided
    if (userX !== null && userX !== undefined && userY !== null && userY !== undefined) {
      const ux = cx + userX * rw
      const uy = cy - userY * rh
      ctx.fillStyle = 'rgb(251,191,36)'
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ux, uy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.font = 'bold 9px Cabinet Grotesk, Satoshi, sans-serif'
      ctx.fillStyle = 'rgb(251,191,36)'
      ctx.textAlign = ux > cx ? 'right' : 'left'
      ctx.fillText('You', ux + (ux > cx ? -10 : 10), uy - 9)
    }
  }, [compassX, compassY, name, party, userX, userY])

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={220}
      className="w-full max-w-xs rounded-lg bg-card/50"
      aria-label={`Political compass showing ${name}`}
    />
  )
}
