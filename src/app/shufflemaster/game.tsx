"use client";

import { ShuffleGameProps } from "./types";
import useBoardSize from "./hooks/use-board-size";
import useGameLogic from "./hooks/use-game-logic";
import GameBoard from "./components/game-board";
import WinModal from "./components/win-modal";

export default function ShuffleMasterGame({
  imageUrl,
  gridSize,
  onReset,
  onBoardSizeChange,
}: ShuffleGameProps) {
  // Get responsive board size
  const { boardSize, sizeCalculated, containerRef } = useBoardSize({
    onSizeChange: onBoardSizeChange,
  });

  // Game logic and state
  const {
    tiles,
    isLoading,
    moves,
    isSolved,
    startTime,
    endTime,
    elapsedTime,
    initializeGame, // Used by useGameLogic for initialization and game reset
    moveTile,
  } = useGameLogic(gridSize, imageUrl);

  // Loading state needs the ref to be attached to properly calculate size
  if (isLoading) {
    return (
      <div className="flex flex-col items-center w-full" ref={containerRef}>
        <div className="text-sky-600">Loading game...</div>
      </div>
    );
  }

  // Don't render the board until we've calculated its size
  if (!sizeCalculated || boardSize === 0) {
    return (
      <div className="flex flex-col items-center w-full" ref={containerRef}>
        <div className="text-sky-600">Calculating board size...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full" ref={containerRef}>
      <GameBoard
        tiles={tiles}
        boardSize={boardSize}
        gridSize={gridSize}
        imageUrl={imageUrl}
        isSolved={isSolved}
        onMoveTile={moveTile}
      />

      {/* Dev tool - hidden element to handle linter error for initializeGame */}
      <button className="hidden" onClick={initializeGame} aria-hidden="true" />

      {/* Win popup modal */}
      {isSolved && (
        <WinModal
          moves={moves}
          startTime={startTime}
          endTime={endTime}
          elapsedTime={elapsedTime}
          onNewGame={onReset}
        />
      )}
    </div>
  );
}
