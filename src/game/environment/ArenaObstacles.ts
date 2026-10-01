import type Phaser from 'phaser'
import { isInsidePlayable } from './ArenaBounds.ts'

export const ARENA_OBSTACLES = [
  { asset: 'prop-container', x: 270, y: 140, size: 95, width: 82, height: 40, offsetY: 3 },
  { asset: 'prop-crates', x: 130, y: 410, size: 72, width: 56, height: 34, offsetY: 3 },
  { asset: 'prop-machine', x: 655, y: 170, size: 105, width: 90, height: 48, offsetY: 4 },
] as const

export interface Point { x: number; y: number }
export interface Box { left: number; right: number; top: number; bottom: number }

export const OBSTACLE_BOUNDS: readonly Box[] = ARENA_OBSTACLES.map(o => ({
  left: o.x - o.width / 2, right: o.x + o.width / 2,
  top: o.y + o.offsetY - o.height / 2, bottom: o.y + o.offsetY + o.height / 2,
}))

export function createObstacles(scene: Phaser.Scene) {
  const group = scene.physics.add.staticGroup()
  for (const o of ARENA_OBSTACLES) {
    if (!isInsidePlayable(o.x, o.y, o.size / 2, o.size / 3)) throw new Error('Obstacle outside playable bounds')
    // The visible prop is drawn by ArenaVisuals from the same definition.
    const shape = scene.add.rectangle(o.x, o.y + o.offsetY, o.width, o.height).setVisible(false)
    scene.physics.add.existing(shape, true)
    group.add(shape)
  }
  return group
}

export function isSpawnClear(x: number, y: number, halfWidth: number, halfHeight: number) {
  // These three original PNGs are 1536 x 1024 (3:2). Include their whole
  // displayed rectangle, not just the smaller solid collider.
  return isInsidePlayable(x, y, halfWidth, halfHeight) && ARENA_OBSTACLES.every(o =>
    x + halfWidth < o.x - o.size / 2 || x - halfWidth > o.x + o.size / 2 ||
    y + halfHeight < o.y - o.size / 3 || y - halfHeight > o.y + o.size / 3)
}

// Open-rectangle segment test: travelling along an expanded edge is allowed.
export function crossesBox(start: Point, end: Point, box: Box): boolean {
  let enter = 0, exit = 1
  for (const [a, b, low, high] of [
    [start.x, end.x, box.left + 0.01, box.right - 0.01],
    [start.y, end.y, box.top + 0.01, box.bottom - 0.01],
  ]) {
    const delta = b - a
    if (Math.abs(delta) < 1e-9) {
      if (a < low || a > high) return false
    } else {
      const t1 = (low - a) / delta, t2 = (high - a) / delta
      enter = Math.max(enter, Math.min(t1, t2))
      exit = Math.min(exit, Math.max(t1, t2))
      if (enter > exit) return false
    }
  }
  return true
}

export function blocksPath(position: Point, target: Point, halfSize: number, obstacle: Box): boolean {
  return crossesBox(position, target, {
    left: obstacle.left - halfSize, right: obstacle.right + halfSize,
    top: obstacle.top - halfSize, bottom: obstacle.bottom + halfSize,
  })
}

export interface Detour extends Point { obstacle: Box }

export function findLocalDetour(position: Point, direction: Point, halfSize: number, target?: Point, clearance: Point = { x: halfSize, y: halfSize }): Detour | undefined {
  const length = Math.hypot(direction.x, direction.y)
  if (!length) return
  const ahead = { x: position.x + direction.x / length * 120, y: position.y + direction.y / length * 120 }
  const expanded = OBSTACLE_BOUNDS.map(b => ({
    left: b.left - halfSize - 6, right: b.right + halfSize + 6,
    top: b.top - halfSize - 6, bottom: b.bottom + halfSize + 6,
  }))
  const solid = OBSTACLE_BOUNDS.map(b => ({
    left: b.left - halfSize, right: b.right + halfSize,
    top: b.top - halfSize, bottom: b.bottom + halfSize,
  }))
  const index = expanded.findIndex((b, i) => crossesBox(position, ahead, b) &&
    (!target || blocksPath(position, target, halfSize, OBSTACLE_BOUNDS[i])))
  if (index < 0) return
  const blocking = expanded[index]
  const goal = { x: position.x + direction.x / length * 300, y: position.y + direction.y / length * 300 }
  const corner = [
    { x: blocking.left, y: blocking.top }, { x: blocking.right, y: blocking.top },
    { x: blocking.left, y: blocking.bottom }, { x: blocking.right, y: blocking.bottom },
  ].filter(p =>
    isInsidePlayable(p.x, p.y, clearance.x, clearance.y) &&
    Math.hypot(p.x - position.x, p.y - position.y) > 3 &&
    !solid.some(b => crossesBox(position, p, b)),
  ).sort((a, b) =>
    Math.hypot(a.x - position.x, a.y - position.y) + Math.hypot(a.x - goal.x, a.y - goal.y) -
    Math.hypot(b.x - position.x, b.y - position.y) - Math.hypot(b.x - goal.x, b.y - goal.y),
  )[0]
  return corner ? { ...corner, obstacle: OBSTACLE_BOUNDS[index] } : undefined
}
