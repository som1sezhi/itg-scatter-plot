import "./Plot.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";

const N_POINTS = 1000;
const POINTS = Array.from({ length: N_POINTS }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: Math.random(),
}));

const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 50;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 20;

const POINT_RADIUS = 6;

function Plot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gx = useRef<SVGGElement>(null);
  const gy = useRef<SVGGElement>(null);

  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
  const { width, height } = plotSize;
  const innerWidth = width - MARGIN_LEFT - MARGIN_RIGHT;
  const innerHeight = height - MARGIN_TOP - MARGIN_BOTTOM;
  const pixelRatio = window.devicePixelRatio ?? 1;

  const xScale = useMemo(
    () => d3.scaleLinear([0, 1], [0, innerWidth]),
    [innerWidth],
  );
  const yScale = useMemo(
    () => d3.scaleLinear([0, 1], [innerHeight, 0]),
    [innerHeight],
  );

  useEffect(() => {
    d3.select(gx.current!).call(d3.axisBottom(xScale));
  }, [xScale]);
  useEffect(() => {
    d3.select(gy.current!).call(d3.axisLeft(yScale));
  }, [yScale]);

  const drawPlot = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, innerWidth, innerHeight);

      ctx.fillStyle = "#f888";

      POINTS.forEach((p) => {
        const px = xScale(p.x);
        const py = yScale(p.y);
        //ctx.moveTo(px + POINT_RADIUS, py);
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      });
    },
    [innerWidth, innerHeight, xScale, yScale],
  );

  // get notified by resizing
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return; // TODO: required?

    // set initial size, causing initial draw
    setPlotSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        setPlotSize({ width, height });
      }
    });
    observer.observe(container);

    return () => observer.unobserve(container);
  }, []);

  // redraw on resize
  useLayoutEffect(() => {
    if (width === 0 || height === 0) return;

    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;
    const ctx = canvas.getContext("2d")!;

    // setting canvas width/height at the same place as setting the scale
    // seems to help make resizing look less glitchy, though it's still a
    // little jank not letting react handle the width/height directly
    canvas.width = Math.floor(innerWidth * pixelRatio);
    canvas.height = Math.floor(innerHeight * pixelRatio);
    ctx.scale(pixelRatio, pixelRatio);

    // svg.setAttribute("width", width.toString());
    // svg.setAttribute("height", height.toString());

    drawPlot(canvas);
  }, [width, height, innerWidth, innerHeight, pixelRatio, drawPlot]);

  return (
    <div ref={containerRef} className="plot-container">
      <svg ref={svgRef} width={width} height={height}>
        <g
          ref={gx}
          /* offset by half a pixel to prevent points from partially overlapping the axes */
          transform={`translate(${MARGIN_LEFT}, ${height - MARGIN_BOTTOM + 0.5})`}
        />
        <g
          ref={gy}
          /* offset by half a pixel to prevent points from partially overlapping the axes */
          transform={`translate(${MARGIN_LEFT - 0.5}, ${MARGIN_TOP})`}
        />
      </svg>
      <canvas
        ref={canvasRef}
        style={{
          left: MARGIN_LEFT,
          top: MARGIN_TOP,
          width: innerWidth,
          height: innerHeight,
        }}
      ></canvas>
    </div>
  );
}

export default Plot;
