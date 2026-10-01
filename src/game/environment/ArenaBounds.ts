// Match the four visual wall strips; the canvas itself remains 800 x 600.
export const ARENA_WIDTH = 800
export const ARENA_HEIGHT = 600
export const WALL_THICKNESS = 14
export const PLAYABLE_BOUNDS = {
  left: WALL_THICKNESS,
  right: ARENA_WIDTH - WALL_THICKNESS,
  top: WALL_THICKNESS,
  bottom: ARENA_HEIGHT - WALL_THICKNESS,
} as const

export function isInsidePlayable(x: number, y: number, halfWidth: number, halfHeight: number) {
  const b = PLAYABLE_BOUNDS
  return x - halfWidth >= b.left && x + halfWidth <= b.right &&
    y - halfHeight >= b.top && y + halfHeight <= b.bottom
}
