import { useEffect, useState } from 'react'

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** Anime un compteur de 0 vers `target` une fois que `start` passe à true. */
export function useCountUp(target: number, start: boolean, decimals = 0, duration = 1200) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start) return
    let frame: number
    const startTime = performance.now()
    const factor = 10 ** decimals

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      setValue(Math.round(target * easeOutCubic(progress) * factor) / factor)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [start, target, decimals, duration])

  return value
}
