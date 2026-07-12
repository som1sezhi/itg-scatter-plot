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
import type { DataPoint } from "../types";

// const N_POINTS = 1000;
// const POINTS = Array.from({ length: N_POINTS }, () => ({
//   x: Math.random(),
//   y: Math.random(),
//   z: Math.random(),
// }));

const MARGIN_TOP = 0;
const MARGIN_BOTTOM = 0;
const MARGIN_LEFT = 0;
const MARGIN_RIGHT = 0;

const POINT_RADIUS = 8;

const TICK_PADDING = 8;

const COLORS = Array.from({ length: 5 }, (_, i) =>
  d3.interpolateRainbow(i / 5 + 0.05),
);

function Plot({
  data,
  densityMin,
  densityMax,
}: {
  data: DataPoint[];
  densityMin: number;
  densityMax: number;
}) {
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

  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const quadtree = useMemo(
    () =>
      d3
        .quadtree<DataPoint>()
        .x((d) => d.bpm)
        .y((d) => Math.log2(d.totalStream))
        .addAll(
          data.filter(
            (d) =>
              d.streamDensity >= densityMin && d.streamDensity <= densityMax,
          ),
        ),
    [data, densityMin, densityMax],
  );

  // fit the default view within a rectangle of [80, 500] bpm and
  // [8, 16384] totalStream while keeping aspect ratio of data consistent
  const aspectRatio = innerWidth / innerHeight;

  const xScale = useMemo(() => {
    if (aspectRatio >= 2) return d3.scaleLinear([80, 500], [0, innerWidth]);

    const mid = 210; // focused around the "fuller" section of plot
    const spread = (500 - 80) * (aspectRatio / 2);
    const left = Math.max(80, mid - spread / 2);
    return d3.scaleLinear([left, left + spread], [0, innerWidth]);
  }, [innerWidth, aspectRatio]);

  const yScale = useMemo(() => {
    if (aspectRatio <= 2)
      return d3.scaleLog([8, 16384], [innerHeight, 0]).base(2);

    const mid = 8.5; // log2 of midpoint of 8 and 16384 (on log scale)
    const spread = 5.5 / (aspectRatio / 2);
    return d3
      .scaleLog([2 ** (mid - spread), 2 ** (mid + spread)], [innerHeight, 0])
      .base(2);
  }, [innerHeight, aspectRatio]);

  // axis/grid generators
  const xAxisTicks = aspectRatio > 1.5 ? 16 : 10;
  const xAxis = useMemo(
    () =>
      d3
        .axisTop(xScale)
        .ticks(xAxisTicks)
        .tickSize(0)
        .tickPadding(TICK_PADDING)
        .tickFormat(d3.format("~g")),
    [xScale, xAxisTicks],
  );
  const yAxis = useMemo(
    () =>
      d3
        .axisRight(yScale)
        .tickSize(0)
        .tickPadding(TICK_PADDING)
        .tickFormat(d3.format("~g")),
    [yScale],
  );
  const xGrid = useMemo(
    () =>
      d3
        .axisTop(xScale)
        .ticks(xAxisTicks)
        .tickSize(innerHeight)
        .tickFormat(() => ""),
    [xScale, innerHeight, xAxisTicks],
  );
  const yGrid = useMemo(
    () =>
      d3
        .axisRight(yScale)
        .tickSize(innerWidth)
        .tickFormat(() => ""),
    [yScale, innerWidth],
  );

  const rescaledX = useMemo(
    () => transform.rescaleX(xScale),
    [transform, xScale],
  );
  const rescaledY = useMemo(
    () => transform.rescaleY(yScale),
    [transform, yScale],
  );

  const hoveredPoints = useMemo(() => {
    if (!mousePos) return [];

    const [mx, my] = mousePos;

    const xQuery = rescaledX.invert(mx - MARGIN_LEFT);
    const yQuery = Math.log2(rescaledY.invert(my - MARGIN_TOP));
    const xPlusRadius = rescaledX.invert(mx - MARGIN_LEFT + POINT_RADIUS);
    const yPlusRadius = Math.log2(
      rescaledY.invert(my - MARGIN_TOP + POINT_RADIUS),
    );
    const xTolerance = Math.abs(xQuery - xPlusRadius);
    const yTolerance = Math.abs(yQuery - yPlusRadius);

    const r2 = POINT_RADIUS * POINT_RADIUS;
    const newHoveredPoints: DataPoint[] = [];
    quadtree.visit((node, x1, y1, x2, y2) => {
      // if this is leaf node
      if (node.length !== 4) {
        let leaf: d3.QuadtreeLeaf<DataPoint> | undefined = node;
        do {
          const d = leaf.data;
          const screenX = rescaledX(d.bpm);
          const screenY = rescaledY(d.totalStream);
          const dx = screenX - mx;
          const dy = screenY - my;
          if (dx * dx + dy * dy < r2) {
            newHoveredPoints.push(d);
          }
        } while ((leaf = leaf.next));
      }
      return (
        x1 > xQuery + xTolerance ||
        x2 < xQuery - xTolerance ||
        y1 > yQuery + yTolerance ||
        y2 < yQuery - yTolerance
      );
    });

    newHoveredPoints.sort((a, b) => b.streamDensity - a.streamDensity);

    return newHoveredPoints;
  }, [mousePos, rescaledX, rescaledY, quadtree]);

  const onMouseMove: React.MouseEventHandler<SVGRectElement> = useCallback(
    (event) => {
      setMousePos(d3.pointer(event, overlayRef.current));
    },
    [],
  );

  const onMouseLeave: React.MouseEventHandler<SVGRectElement> =
    useCallback(() => {
      setMousePos(null);
    }, []);

  // add zoom behavior
  useEffect(() => {
    const leftExtent = xScale(0);
    const bottomExtent = yScale(1);
    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .translateExtent([
        [leftExtent, -Infinity],
        [Infinity, bottomExtent],
      ])
      .scaleExtent([0.5, 40])
      .on(
        "zoom",
        ({
          transform,
          sourceEvent,
        }: d3.D3ZoomEvent<SVGRectElement, unknown>) => {
          setTransform(transform);
          if (sourceEvent.clientX !== undefined) {
            setMousePos(d3.pointer(sourceEvent, overlayRef.current!));
          } else {
            // e.g. touch events don't have clientX/Y
            // TODO: nicer handling
            setMousePos(null);
          }
        },
      );
    const overlay = d3.select(overlayRef.current!);
    overlay.call(zoom);
  }, [innerWidth, innerHeight, xScale, yScale]);

  // render axes and grids
  useEffect(() => {
    d3.select(gXAxisRef.current!).call(xAxis.scale(rescaledX));
    d3.select(gXGridRef.current!).call(xGrid.scale(rescaledX));
  }, [xAxis, xGrid, rescaledX]);
  useEffect(() => {
    d3.select(gYAxisRef.current!).call(yAxis.scale(rescaledY));
    d3.select(gYGridRef.current!).call(yGrid.scale(rescaledY));
  }, [yAxis, yGrid, rescaledY]);

  // render points on canvas
  const drawPlot = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;

      function isOutOfView(px: number, py: number) {
        return (
          px < -POINT_RADIUS ||
          px > innerWidth + POINT_RADIUS ||
          py < -POINT_RADIUS ||
          py > innerHeight + POINT_RADIUS
        );
      }

      ctx.clearRect(0, 0, innerWidth, innerHeight);

      ctx.globalAlpha = 0.5;

      const activePoints: DataPoint[] = [];

      // draw inactive points first
      ctx.fillStyle = "#e3e3e399";
      data.forEach((p) => {
        const px = rescaledX(p.bpm);
        const py = rescaledY(p.totalStream);
        if (isOutOfView(px, py)) return;

        if (p.streamDensity >= densityMin && p.streamDensity <= densityMax) {
          activePoints.push(p);
          return;
        }

        //ctx.moveTo(px + POINT_RADIUS, py);
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      });

      // draw active points on top
      activePoints.forEach((p) => {
        const px = rescaledX(p.bpm);
        const py = rescaledY(p.totalStream);
        ctx.fillStyle = COLORS[p.meter % 5];

        //ctx.moveTo(px + POINT_RADIUS, py);
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      });
    },
    [
      innerWidth,
      innerHeight,
      rescaledX,
      rescaledY,
      data,
      densityMin,
      densityMax,
    ],
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
          className="plot-overlay"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
      </svg>
      <PlotTooltip
        hoveredPoints={hoveredPoints}
        hoverPos={mousePos}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
    </div>
  );
}

export default Plot;

const MAX_TOOLTIP_CHARTS = 3;

function PlotTooltip({
  hoveredPoints,
  hoverPos,
  innerWidth,
  innerHeight,
}: {
  hoveredPoints: DataPoint[];
  hoverPos: [number, number] | null;
  innerWidth: number;
  innerHeight: number;
}) {
  if (!hoverPos || hoveredPoints.length === 0) return null;

  const style: React.CSSProperties = {};
  if (hoverPos[0] < innerWidth / 2) {
    style.left = hoverPos[0] + 3;
  } else {
    style.right = innerWidth - hoverPos[0] + 3;
  }
  if (hoverPos[1] < innerHeight / 2) {
    style.top = hoverPos[1] + 3;
  } else {
    style.bottom = innerHeight - hoverPos[1] + 3;
  }

  return (
    <div className="plot-tooltip" style={style}>
      {hoveredPoints.slice(0, MAX_TOOLTIP_CHARTS).map((p) => (
        <div key={p.hash}>
          <span className="emphasis">
            <span
              style={{ color: COLORS[p.meter % 5], filter: "brightness(0.8)" }}
            >
              [{p.meter}]
            </span>{" "}
            [{Math.round(p.bpm)}]
          </span>
          {" " + p.name}
          <br />
          <span className="muted">
            &emsp;<span className="emphasis">{Math.floor(p.totalStream)}</span>{" "}
            total,{" "}
            <span className="emphasis">
              {(p.streamDensity * 100).toFixed(0)}%
            </span>{" "}
            density
          </span>
        </div>
      ))}
      {hoveredPoints.length > MAX_TOOLTIP_CHARTS && (
        <div>
          <b>
            <i>+{hoveredPoints.length - MAX_TOOLTIP_CHARTS} more...</i>
          </b>
        </div>
      )}
    </div>
  );
}
