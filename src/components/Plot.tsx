import "./Plot.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const N_POINTS = 100;
const POINTS = Array.from({ length: N_POINTS }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: Math.random(),
}));

function Plot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function drawPlot(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;

    const width = ctx.canvas.width / (window.devicePixelRatio ?? 1);
    const height = ctx.canvas.height / (window.devicePixelRatio ?? 1);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f88";
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 20, 0, 2 * Math.PI);
    ctx.fill();
  }

  // handle init draw and redrawing on resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return; // TODO: required?
    const ctx = canvas.getContext("2d")!;

    const resizePlot = (width: number, height: number) => {
      const pixelRatio = window.devicePixelRatio ?? 1;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      ctx.scale(pixelRatio, pixelRatio);

      drawPlot(canvas);
    };

    // init draw
    resizePlot(container.clientWidth, container.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        resizePlot(width, height);
      }
    });
    observer.observe(container);

    return () => observer.unobserve(container);
  }, []);

  return (
    <div ref={containerRef} className="plot-container">
      <canvas ref={canvasRef} className="plot"></canvas>
    </div>
  );
}

export default Plot;
