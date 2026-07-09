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

const MARGIN_TOP = 0;
const MARGIN_BOTTOM = 0;
const MARGIN_LEFT = 0;
const MARGIN_RIGHT = 0;

const POINT_RADIUS = 6;

const TICK_PADDING = 8;

function Plot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gXAxisRef = useRef<SVGGElement>(null);
  const gYAxisRef = useRef<SVGGElement>(null);
  const gXGridRef = useRef<SVGGElement>(null);
  const gYGridRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<SVGRectElement>(null);

  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
  const { width, height } = plotSize;
  const innerWidth = width - MARGIN_LEFT - MARGIN_RIGHT;
  const innerHeight = height - MARGIN_TOP - MARGIN_BOTTOM;
  const pixelRatio = window.devicePixelRatio ?? 1;

  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const xScale = useMemo(
    () => d3.scaleLinear([0, 1], [0, innerWidth]),
    [innerWidth],
  );
  const yScale = useMemo(
    () => d3.scaleLinear([0, 1], [innerHeight, 0]),
    [innerHeight],
  );
  const xAxis = useMemo(
    () => d3.axisTop(xScale).tickSize(0).tickPadding(TICK_PADDING),
    [xScale],
  );
  const yAxis = useMemo(
    () => d3.axisRight(yScale).tickSize(0).tickPadding(TICK_PADDING),
    [yScale],
  );
  const xGrid = useMemo(
    () =>
      d3
        .axisTop(xScale)
        .tickSize(innerHeight)
        .tickFormat(() => ""),
    [xScale, innerHeight],
  );
  const yGrid = useMemo(
    () =>
      d3
        .axisRight(yScale)
        .tickSize(innerWidth)
        .tickFormat(() => ""),
    [yScale, innerWidth],
  );

  // add zoom behavior
  useEffect(() => {
    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .on("zoom", ({ transform }) => {
        setTransform(transform);
      });
    const overlay = d3.select(overlayRef.current!);
    overlay.call(zoom);
  }, []);

  // render axes and grids
  useEffect(() => {
    const rescaledX = transform.rescaleX(xScale);
    d3.select(gXAxisRef.current!).call(xAxis.scale(rescaledX));
    d3.select(gXGridRef.current!).call(xGrid.scale(rescaledX));
  }, [xAxis, xGrid, transform, xScale]);
  useEffect(() => {
    const rescaledY = transform.rescaleY(yScale);
    d3.select(gYAxisRef.current!).call(yAxis.scale(rescaledY));
    d3.select(gYGridRef.current!).call(yGrid.scale(rescaledY));
  }, [yAxis, yGrid, transform, yScale]);

  // render points on canvas
  const drawPlot = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, innerWidth, innerHeight);

      ctx.fillStyle = "#f888";

      const rescaledX = transform.rescaleX(xScale);
      const rescaledY = transform.rescaleY(yScale);

      //ctx.beginPath();
      POINTS.forEach((p) => {
        const px = rescaledX(p.x);
        const py = rescaledY(p.y);
        if (
          px < -POINT_RADIUS ||
          px > innerWidth + POINT_RADIUS ||
          py < -POINT_RADIUS ||
          py > innerHeight + POINT_RADIUS
        )
          return;
        //ctx.moveTo(px + POINT_RADIUS, py);
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      });
      //ctx.fill();
    },
    [innerWidth, innerHeight, xScale, yScale, transform],
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
    if (!canvas) return;
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
      <svg width={width} height={height}>
        <g
          ref={gXGridRef}
          className="plot-grid"
          transform={`translate(${MARGIN_LEFT}, ${height - MARGIN_BOTTOM})`}
        />
        <g
          ref={gYGridRef}
          className="plot-grid"
          transform={`translate(${MARGIN_LEFT}, ${MARGIN_TOP})`}
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
      <svg width={width} height={height}>
        <g
          ref={gXAxisRef}
          transform={`translate(${MARGIN_LEFT}, ${height - MARGIN_BOTTOM})`}
        />
        <g
          ref={gYAxisRef}
          transform={`translate(${MARGIN_LEFT}, ${MARGIN_TOP})`}
        />
        <rect
          ref={overlayRef}
          width={width}
          height={height}
          fill="transparent"
        />
      </svg>
    </div>
  );
}

export default Plot;
