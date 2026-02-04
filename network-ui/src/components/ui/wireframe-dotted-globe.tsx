"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"

interface LocationMarker {
  name: string
  coords: [number, number] // [lat, lng]
  eventCount: number
  peopleCount: number
  color: string
}

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
  locations?: LocationMarker[]
  selectedLocation?: string | null
  onLocationClick?: (name: string) => void
  onLocationHover?: (name: string | null) => void
}

export default function RotatingEarth({ 
  width = 800, 
  height = 600, 
  className = "",
  locations = [],
  selectedLocation = null,
  onLocationClick,
  onLocationHover
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const projectionRef = useRef<d3.GeoProjection | null>(null)
  const rotationRef = useRef<[number, number]>([0, 0])
  const containerDimensionsRef = useRef<{ width: number; height: number; radius: number }>({ width: 0, height: 0, radius: 0 })

  // Easing functions
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

  // Animate to location
  const animateToLocation = useCallback((lat: number, lng: number) => {
    if (!projectionRef.current) return
    
    const targetRotation: [number, number] = [-lng, -lat]
    const startRotation = [...rotationRef.current] as [number, number]
    const startScale = projectionRef.current.scale()
    const baseRadius = containerDimensionsRef.current.radius
    const targetScale = baseRadius * 2.5
    const duration = 1200
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(1, elapsed / duration)
      
      // Smooth rotation with ease-in-out
      const rotationProgress = easeInOutCubic(t)
      rotationRef.current = [
        startRotation[0] + (targetRotation[0] - startRotation[0]) * rotationProgress,
        startRotation[1] + (targetRotation[1] - startRotation[1]) * rotationProgress
      ]
      
      // Smooth zoom with ease-out for natural deceleration
      const scaleProgress = easeOutCubic(t)
      const newScale = startScale + (targetScale - startScale) * scaleProgress
      projectionRef.current?.scale(newScale)
      
      if (t < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [])

  // Expose animation function
  useEffect(() => {
    if (selectedLocation && locations.length > 0) {
      const loc = locations.find(l => l.name === selectedLocation)
      if (loc) {
        animateToLocation(loc.coords[0], loc.coords[1])
      }
    }
  }, [selectedLocation, locations, animateToLocation])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    // Set up responsive dimensions
    const containerWidth = Math.min(width, window.innerWidth - 40)
    const containerHeight = Math.min(height, window.innerHeight - 100)
    const radius = Math.min(containerWidth, containerHeight) / 2.5

    containerDimensionsRef.current = { width: containerWidth, height: containerHeight, radius }

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    // Create projection and path generator for Canvas
    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)

    projectionRef.current = projection

    const path = d3.geoPath().projection(projection).context(context)

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point
      let inside = false

      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }

      return inside
    }

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry

      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        if (!pointInPolygon(point, coordinates[0])) {
          return false
        }
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) {
            return false
          }
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) {
              return true
            }
          }
        }
        return false
      }

      return false
    }

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds

      const stepSize = dotSpacing * 0.08

      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat]
          if (pointInFeature(point, feature)) {
            dots.push(point)
          }
        }
      }

      return dots
    }

    interface DotData {
      lng: number
      lat: number
      visible: boolean
    }

    const allDots: DotData[] = []
    let landFeatures: any

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)

      projection.rotate(rotationRef.current)

      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius

      // Draw ocean (globe background)
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "#030712"
      context.fill()
      context.strokeStyle = "#1e3a5f"
      context.lineWidth = 2 * scaleFactor
      context.stroke()

      if (landFeatures) {
        // Draw graticule
        const graticule = d3.geoGraticule()
        context.beginPath()
        path(graticule())
        context.strokeStyle = "#1e3a5f"
        context.lineWidth = 0.5 * scaleFactor
        context.globalAlpha = 0.4
        context.stroke()
        context.globalAlpha = 1

        // Draw land outlines
        context.beginPath()
        landFeatures.features.forEach((feature: any) => {
          path(feature)
        })
        context.strokeStyle = "#3b82f6"
        context.lineWidth = 1 * scaleFactor
        context.stroke()

        // Draw halftone dots
        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            context.beginPath()
            context.arc(projected[0], projected[1], 1 * scaleFactor, 0, 2 * Math.PI)
            context.fillStyle = "#1e40af"
            context.fill()
          }
        })
      }

      // Draw location markers
      locations.forEach((loc) => {
        // Note: coords are [lat, lng], but d3 expects [lng, lat]
        const projected = projection([loc.coords[1], loc.coords[0]])
        if (!projected) return

        // Check if on visible side of globe
        const [lng, lat] = [loc.coords[1], loc.coords[0]]
        const r = projection.rotate()
        const distance = d3.geoDistance([lng, lat], [-r[0], -r[1]])
        if (distance > Math.PI / 2) return

        const [x, y] = projected
        const markerSize = Math.min(Math.sqrt(loc.eventCount) * 1.5 + 6, 25) * scaleFactor
        const isSelected = loc.name === selectedLocation

        // Glow
        context.beginPath()
        context.arc(x, y, markerSize + 8 * scaleFactor, 0, 2 * Math.PI)
        context.fillStyle = loc.color
        context.globalAlpha = isSelected ? 0.5 : 0.25
        context.globalCompositeOperation = "lighter"
        context.fill()
        context.globalCompositeOperation = "source-over"
        context.globalAlpha = 1

        // Marker
        context.beginPath()
        context.arc(x, y, markerSize, 0, 2 * Math.PI)
        context.fillStyle = loc.color
        context.fill()
        context.strokeStyle = isSelected ? "#ffffff" : "#000000"
        context.lineWidth = isSelected ? 3 * scaleFactor : 2 * scaleFactor
        context.stroke()

        // Label for large markers
        if (loc.eventCount > 100 || isSelected) {
          context.font = `bold ${12 * scaleFactor}px system-ui, sans-serif`
          context.fillStyle = "#ffffff"
          context.textAlign = "center"
          context.fillText(loc.name, x, y - markerSize - 8 * scaleFactor)
        }
      })
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        )
        if (!response.ok) throw new Error("Failed to load land data")

        landFeatures = await response.json()

        // Generate dots for all land features
        landFeatures.features.forEach((feature: any) => {
          const dots = generateDotsInPolygon(feature, 18)
          dots.forEach(([lng, lat]) => {
            allDots.push({ lng, lat, visible: true })
          })
        })

        render()
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load map data")
        setIsLoading(false)
      }
    }

    // No auto-rotation. Render on interval for smooth updates.
    const rotationTimer = d3.timer(render)

    // Find location at point
    const getLocationAtPoint = (clientX: number, clientY: number): LocationMarker | null => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      for (const loc of locations) {
        const projected = projection([loc.coords[1], loc.coords[0]])
        if (!projected) continue

        const [lng, lat] = [loc.coords[1], loc.coords[0]]
        const r = projection.rotate()
        const distance = d3.geoDistance([lng, lat], [-r[0], -r[1]])
        if (distance > Math.PI / 2) continue

        const markerSize = Math.min(Math.sqrt(loc.eventCount) * 1.5 + 6, 25)
        const dx = x - projected[0]
        const dy = y - projected[1]
        if (dx * dx + dy * dy < (markerSize + 10) * (markerSize + 10)) {
          return loc
        }
      }
      return null
    }

    const handleMouseDown = (event: MouseEvent) => {
      const startX = event.clientX
      const startY = event.clientY
      const startRotation = [...rotationRef.current] as [number, number]
      let hasMoved = false

      const handleMouseMoveDrag = (moveEvent: MouseEvent) => {
        hasMoved = true
        const sensitivity = 0.5
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY

        rotationRef.current[0] = startRotation[0] + dx * sensitivity
        rotationRef.current[1] = startRotation[1] - dy * sensitivity
        rotationRef.current[1] = Math.max(-90, Math.min(90, rotationRef.current[1]))
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMoveDrag)
        document.removeEventListener("mouseup", handleMouseUp)

        if (!hasMoved) {
          const loc = getLocationAtPoint(upEvent.clientX, upEvent.clientY)
          if (loc && onLocationClick) {
            onLocationClick(loc.name)
          }
        }
      }

      document.addEventListener("mousemove", handleMouseMoveDrag)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const loc = getLocationAtPoint(event.clientX, event.clientY)
      canvas.style.cursor = loc ? "pointer" : "grab"
      if (onLocationHover) {
        onLocationHover(loc?.name || null)
      }
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05
      const newRadius = Math.max(radius * 0.5, Math.min(radius * 2.5, projection.scale() * scaleFactor))
      projection.scale(newRadius)
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("wheel", handleWheel)

    loadWorldData()

    return () => {
      rotationTimer.stop()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [width, height, locations, selectedLocation, onLocationClick, onLocationHover])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-2xl p-8 ${className}`}>
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-2">Error loading globe</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 rounded-2xl z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Loading world map...</p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-2xl bg-gray-950"
        style={{ maxWidth: "100%", height: "auto" }}
      />
    </div>
  )
}
