import { useState, useEffect, useRef, useCallback } from "react";
import { Airplane, Obstacle, GameBoardSize, Difficulty } from "../types";

interface UseGameLogicProps {
  difficulty: Difficulty;
  boardSize: GameBoardSize;
  setHighScore: (score: number) => void;
  highScore: number;
}

export default function useGameLogic({
  difficulty,
  boardSize,
  setHighScore,
  highScore,
}: UseGameLogicProps) {
  // Game state - simplified
  const [gameState, setGameState] = useState({
    isActive: false,
    gameOver: false,
    score: 0,
  });

  // Game elements
  const [airplane, setAirplane] = useState<Airplane>({
    x: 100,
    y: boardSize.height / 2,
    width: 60,
    height: 30,
    rotation: 0,
    velocity: 0.1,
  });

  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // Game settings based on difficulty
  const difficultySettings = {
    easy: { gravity: 0.3, jumpPower: -6, obstacleSpeed: 3, spawnRate: 1800 },
    medium: { gravity: 0.4, jumpPower: -7, obstacleSpeed: 4, spawnRate: 1500 },
    hard: { gravity: 0.5, jumpPower: -8, obstacleSpeed: 5, spawnRate: 1200 },
  };

  const settings = difficultySettings[difficulty];

  // References for animation frame and timers
  const animationFrameRef = useRef<number | null>(null);
  const obstacleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize the game state - using a ref to prevent dependency issues
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Define types for obstacle hitboxes
  interface CircleHitbox {
    x: number;
    y: number;
    radius: number;
  }

  interface RectHitbox {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface PlantHitbox {
    pot: RectHitbox;
    foliage: CircleHitbox;
  }

  // Define types for geometric calculations
  interface Point {
    x: number;
    y: number;
  }

  interface LineSegment {
    p1: Point;
    p2: Point;
  }

  // Helper function to check if a point is inside a rectangle
  const pointInRectangle = useCallback(
    (point: Point, rect: RectHitbox): boolean => {
      return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      );
    },
    []
  );

  // Helper function to calculate distance between a point and a circle
  const distance = useCallback((point: Point, circle: CircleHitbox): number => {
    return Math.sqrt(
      Math.pow(point.x - circle.x, 2) + Math.pow(point.y - circle.y, 2)
    );
  }, []);

  // Helper function to get appropriate hitbox for different obstacle types
  const getObstacleHitbox = useCallback((obstacle: Obstacle): RectHitbox => {
    switch (obstacle.type) {
      case "drawer":
        return {
          x: obstacle.x + obstacle.width * 0.05,
          y: obstacle.y + obstacle.height * 0.25,
          width: obstacle.width * 0.9,
          height: obstacle.height * 0.5,
        };

      case "coffee":
        return {
          x: obstacle.x + obstacle.width * 0.2,
          y: obstacle.y + obstacle.height * 0.2,
          width: obstacle.width * 0.6,
          height: obstacle.height * 0.6,
        };

      case "monitor":
        return {
          x: obstacle.x + obstacle.width * 0.1,
          y: obstacle.y + obstacle.height * 0.1,
          width: obstacle.width * 0.8,
          height: obstacle.height * 0.7,
        };

      default:
        // Default slightly smaller hitbox for other objects
        return {
          x: obstacle.x + obstacle.width * 0.1,
          y: obstacle.y + obstacle.height * 0.1,
          width: obstacle.width * 0.8,
          height: obstacle.height * 0.8,
        };
    }
  }, []);

  // Helper function for line segment to line segment intersection
  const lineLineIntersect = useCallback(
    (line1: LineSegment, line2: LineSegment): boolean => {
      const det =
        (line1.p2.x - line1.p1.x) * (line2.p2.y - line2.p1.y) -
        (line1.p2.y - line1.p1.y) * (line2.p2.x - line2.p1.x);

      if (det === 0) {
        return false; // Lines are parallel
      }

      const lambda =
        ((line2.p2.y - line2.p1.y) * (line2.p2.x - line1.p1.x) +
          (line2.p1.x - line2.p2.x) * (line2.p2.y - line1.p1.y)) /
        det;
      const gamma =
        ((line1.p1.y - line1.p2.y) * (line2.p2.x - line1.p1.x) +
          (line1.p2.x - line1.p1.x) * (line2.p2.y - line1.p1.y)) /
        det;

      return 0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1;
    },
    []
  );

  // Helper function for line segment to rectangle intersection
  const lineRectIntersect = useCallback(
    (edge: LineSegment, rect: RectHitbox): boolean => {
      // Rectangle edges
      const rectEdges: LineSegment[] = [
        // Top edge
        {
          p1: { x: rect.x, y: rect.y },
          p2: { x: rect.x + rect.width, y: rect.y },
        },
        // Right edge
        {
          p1: { x: rect.x + rect.width, y: rect.y },
          p2: { x: rect.x + rect.width, y: rect.y + rect.height },
        },
        // Bottom edge
        {
          p1: { x: rect.x, y: rect.y + rect.height },
          p2: { x: rect.x + rect.width, y: rect.y + rect.height },
        },
        // Left edge
        {
          p1: { x: rect.x, y: rect.y },
          p2: { x: rect.x, y: rect.y + rect.height },
        },
      ];

      // Check if the line segment intersects with any edge of the rectangle
      return rectEdges.some((rectEdge) => lineLineIntersect(edge, rectEdge));
    },
    [lineLineIntersect]
  );

  // Helper function for line segment to circle intersection
  const lineCircleIntersect = useCallback(
    (edge: LineSegment, circle: CircleHitbox, radius: number): boolean => {
      // Vector from p1 to p2
      const v1 = { x: edge.p2.x - edge.p1.x, y: edge.p2.y - edge.p1.y };
      // Vector from p1 to circle center
      const v2 = { x: circle.x - edge.p1.x, y: circle.y - edge.p1.y };

      // Length of the line segment
      const segmentLength = Math.sqrt(v1.x * v1.x + v1.y * v1.y);

      // Unit vector of v1
      const v1Unit = { x: v1.x / segmentLength, y: v1.y / segmentLength };

      // Projection of v2 onto v1
      const projection = v2.x * v1Unit.x + v2.y * v1Unit.y;

      // Get the closest point on the line segment to the circle center
      let closestPoint: Point;

      if (projection < 0) {
        closestPoint = edge.p1;
      } else if (projection > segmentLength) {
        closestPoint = edge.p2;
      } else {
        closestPoint = {
          x: edge.p1.x + v1Unit.x * projection,
          y: edge.p1.y + v1Unit.y * projection,
        };
      }

      // Check if the closest point is within the radius of the circle
      const dist = Math.sqrt(
        Math.pow(closestPoint.x - circle.x, 2) +
          Math.pow(closestPoint.y - circle.y, 2)
      );

      return dist < radius;
    },
    []
  );

  // More accurate collision detection using a better hitbox approach
  const checkCollision = useCallback(
    (plane: Airplane, obstacle: Obstacle): boolean => {
      // Define the actual shape of the paper airplane as a triangle
      // with 3 points for more accurate collision detection
      const planeCenter = {
        x: plane.x + plane.width / 2,
        y: plane.y + plane.height / 2,
      };

      // Calculate the rotated triangle points of the paper airplane
      const angleRad = (plane.rotation * Math.PI) / 180;
      const cosAngle = Math.cos(angleRad);
      const sinAngle = Math.sin(angleRad);

      // Define the triangle points relative to center - making the triangle slightly larger
      // for better collision sensitivity
      const rightTip = {
        x: plane.width * 0.45, // Slightly larger tip (was 0.4)
        y: 0,
      };

      const topLeft = {
        x: -plane.width * 0.45, // Slightly larger left edge (was 0.4)
        y: -plane.height * 0.45, // Slightly larger top edge (was 0.4)
      };

      const bottomLeft = {
        x: -plane.width * 0.45, // Slightly larger left edge (was 0.4)
        y: plane.height * 0.45, // Slightly larger bottom edge (was 0.4)
      };

      // Rotate the points based on plane rotation
      const rotatePoint = (point: { x: number; y: number }) => {
        return {
          x: planeCenter.x + (point.x * cosAngle - point.y * sinAngle),
          y: planeCenter.y + (point.x * sinAngle + point.y * cosAngle),
        };
      };

      // Get actual points after rotation
      const p1 = rotatePoint(rightTip);
      const p2 = rotatePoint(topLeft);
      const p3 = rotatePoint(bottomLeft);

      // Get the triangle edges as line segments
      const edges: LineSegment[] = [
        { p1, p2 }, // Top edge
        { p1: p2, p2: p3 }, // Left edge
        { p1: p3, p2: p1 }, // Bottom edge
      ];

      // Handle different obstacle types with appropriate hitboxes
      switch (obstacle.type) {
        case "fan": {
          // For circular objects, we'll use a circular hitbox
          const radius = obstacle.width * 0.37; // Slightly larger radius (was 0.35)
          const center: CircleHitbox = {
            x: obstacle.x + obstacle.width / 2,
            y: obstacle.y + obstacle.height / 2,
            radius: radius,
          };

          // Circle vs. Triangle check - first do a rough bounding box check
          const roughCheck =
            planeCenter.x - plane.width / 2 < center.x + radius &&
            planeCenter.x + plane.width / 2 > center.x - radius &&
            planeCenter.y - plane.height / 2 < center.y + radius &&
            planeCenter.y + plane.height / 2 > center.y - radius;

          if (!roughCheck) return false;

          // Do a more accurate point-to-circle check
          const distanceToP1 = Math.sqrt(
            Math.pow(p1.x - center.x, 2) + Math.pow(p1.y - center.y, 2)
          );
          const distanceToP2 = Math.sqrt(
            Math.pow(p2.x - center.x, 2) + Math.pow(p2.y - center.y, 2)
          );
          const distanceToP3 = Math.sqrt(
            Math.pow(p3.x - center.x, 2) + Math.pow(p3.y - center.y, 2)
          );

          // Also check if any edge of the triangle intersects with the circle
          const edgeIntersection = edges.some((edge) =>
            lineCircleIntersect(edge, center, radius)
          );

          return (
            distanceToP1 < radius ||
            distanceToP2 < radius ||
            distanceToP3 < radius ||
            edgeIntersection
          );
        }

        case "plant": {
          // Upper part is circular, lower part is rectangular
          const plantHitbox: PlantHitbox = {
            pot: {
              x: obstacle.x + obstacle.width * 0.25,
              y: obstacle.y + obstacle.height * 0.5,
              width: obstacle.width * 0.5,
              height: obstacle.height * 0.5,
            },
            foliage: {
              x: obstacle.x + obstacle.width * 0.5,
              y: obstacle.y + obstacle.height * 0.3,
              radius: obstacle.width * 0.35, // Slightly larger radius (was 0.3)
            },
          };

          // Check collision with pot (rectangle)
          const potCollision =
            pointInRectangle(p1, plantHitbox.pot) ||
            pointInRectangle(p2, plantHitbox.pot) ||
            pointInRectangle(p3, plantHitbox.pot) ||
            edges.some((edge) => lineRectIntersect(edge, plantHitbox.pot));

          // Check collision with foliage (circle)
          const foliageCollision =
            distance(p1, plantHitbox.foliage) < plantHitbox.foliage.radius ||
            distance(p2, plantHitbox.foliage) < plantHitbox.foliage.radius ||
            distance(p3, plantHitbox.foliage) < plantHitbox.foliage.radius ||
            edges.some((edge) =>
              lineCircleIntersect(
                edge,
                plantHitbox.foliage,
                plantHitbox.foliage.radius
              )
            );

          return potCollision || foliageCollision;
        }

        default: {
          // For other obstacles, use a simplified rectangular hitbox
          const rectHitbox: RectHitbox = getObstacleHitbox(obstacle);

          // Check if any point of the triangle is inside the rectangle or
          // if any edge of the triangle intersects with the rectangle
          return (
            pointInRectangle(p1, rectHitbox) ||
            pointInRectangle(p2, rectHitbox) ||
            pointInRectangle(p3, rectHitbox) ||
            edges.some((edge) => lineRectIntersect(edge, rectHitbox))
          );
        }
      }
    },
    [
      getObstacleHitbox,
      pointInRectangle,
      distance,
      lineCircleIntersect,
      lineRectIntersect,
    ]
  );

  // Handle game over
  const handleGameOver = useCallback(() => {
    if (gameStateRef.current.gameOver) return; // Prevent multiple calls

    setGameState((prev) => ({ ...prev, isActive: false, gameOver: true }));

    // Clear all timers
    if (obstacleTimerRef.current) {
      clearInterval(obstacleTimerRef.current);
      obstacleTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Update high score
    if (gameStateRef.current.score > highScore) {
      setHighScore(gameStateRef.current.score);
    }
  }, [highScore, setHighScore]);

  // Game loop function - declare early for use in startGame
  const gameLoop = useCallback(() => {
    if (gameStateRef.current.gameOver) return;

    // Update airplane with physics
    setAirplane((prev) => {
      const newVelocity = prev.velocity + settings.gravity;
      const newY = prev.y + newVelocity;
      let newRotation = prev.rotation + 1;

      if (newRotation > 45) newRotation = 45;

      // Check boundaries
      if (newY < 0 || newY > boardSize.height - prev.height) {
        // Schedule game over instead of calling it directly to avoid state updates during render
        setTimeout(() => handleGameOver(), 0);
        return prev;
      }

      // Create updated airplane state for collision checking
      const updatedAirplane = {
        ...prev,
        y: newY,
        velocity: newVelocity,
        rotation: newRotation,
      };

      // Instead of checking for collisions here, we'll let the effect in the main component handle it
      return updatedAirplane;
    });

    // Update obstacles with simplified state access
    setObstacles((prev) => {
      const updatedObstacles = prev.map((obstacle) => {
        // Move obstacle
        const newX = obstacle.x - settings.obstacleSpeed;
        let { passed } = obstacle;

        // Check if passed
        if (!passed && newX + obstacle.width < airplane.x) {
          passed = true;
          // Update score with a callback to avoid stale state
          setGameState((prevState) => ({
            ...prevState,
            score: prevState.score + 1,
          }));
        }

        // Create updated obstacle state
        return { ...obstacle, x: newX, passed };
      });

      return updatedObstacles.filter((o) => o.x + o.width > 0);
    });

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [settings, boardSize.height, airplane, handleGameOver]);

  // Spawn obstacles - declare early for use in startGame
  const spawnObstacle = useCallback(() => {
    if (gameStateRef.current.gameOver) return;

    const obstacleTypes = ["drawer", "coffee", "plant", "monitor", "fan"];
    const type = obstacleTypes[
      Math.floor(Math.random() * obstacleTypes.length)
    ] as Obstacle["type"];

    // Size based on type - reduced by ~20% for smaller canvas
    let width = 55; // Was 70
    let height = 48; // Was 60

    if (type === "drawer") {
      width = 95; // Was 120
      height = 32; // Was 40
    } else if (type === "monitor") {
      width = 64; // Was 80
      height = 56; // Was 70
    } else if (type === "fan") {
      width = 48; // Was 60
      height = 48; // Was 60
    }

    // Randomize y position - ensure better vertical spacing
    const minY = height * 1.2; // Add some margin from top
    const maxY = boardSize.height - height * 1.2; // Add some margin from bottom
    const y = Math.floor(Math.random() * (maxY - minY) + minY);

    const newObstacle: Obstacle = {
      id: Date.now(),
      x: boardSize.width + width,
      y,
      width,
      height,
      type,
      passed: false,
    };

    setObstacles((prev) => [...prev, newObstacle]);
  }, [boardSize.width, boardSize.height]);

  // Start the game - need to define this before handleJump can reference it
  const startGame = useCallback(() => {
    // Reset game state
    setGameState({
      isActive: true,
      gameOver: false,
      score: 0,
    });

    // Clear any existing timers
    if (obstacleTimerRef.current) {
      clearInterval(obstacleTimerRef.current);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Reset airplane with smaller size for the reduced canvas
    setAirplane({
      x: 80, // Position it a bit more to the left on the smaller canvas
      y: boardSize.height / 2,
      width: 48, // 20% smaller than 60
      height: 24, // 20% smaller than 30
      rotation: 0,
      velocity: 0.1, // Small initial velocity
    });

    // Clear obstacles
    setObstacles([]);

    // Start obstacle spawning
    spawnObstacle(); // Spawn one immediately
    obstacleTimerRef.current = setInterval(spawnObstacle, settings.spawnRate);

    // Start game loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [boardSize.height, settings, spawnObstacle, gameLoop]);

  // Handle player jump - now startGame is defined before this function
  const handleJump = useCallback(() => {
    if (gameStateRef.current.gameOver) return;

    // If game not active, start it
    if (!gameStateRef.current.isActive) {
      setTimeout(() => startGame(), 0);
      return;
    }

    setAirplane((prev) => ({
      ...prev,
      velocity: settings.jumpPower,
      rotation: -20,
    }));
  }, [settings.jumpPower, startGame]);

  // Collision detection effect - separate from the game loop to avoid state updates during render
  useEffect(() => {
    if (gameStateRef.current.gameOver) return;

    // Check for collisions with current airplane and obstacles
    const hasCollision = obstacles.some(
      (obstacle) => !obstacle.passed && checkCollision(airplane, obstacle)
    );

    if (hasCollision) {
      handleGameOver();
    }
  }, [airplane, obstacles, handleGameOver, checkCollision]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (obstacleTimerRef.current) {
        clearInterval(obstacleTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auto-start when board size is available
  useEffect(() => {
    const hasValidBoardSize = boardSize.width > 0 && boardSize.height > 0;
    if (
      hasValidBoardSize &&
      !gameStateRef.current.isActive &&
      !gameStateRef.current.gameOver
    ) {
      startGame();
    }
  }, [boardSize.width, boardSize.height, startGame]);

  return {
    airplane,
    obstacles,
    score: gameState.score,
    isPlaying: gameState.isActive,
    gameOver: gameState.gameOver,
    handleJump,
    resetGame: startGame,
  };
}
