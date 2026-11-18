import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, Download } from 'lucide-react';
import { StudyMindMap } from '../../types';
import { parseTimestamp } from '../../lib/time';
import { downloadText, slugify } from '../../lib/download';

interface MindMapViewProps {
  map: StudyMindMap;
  videoTitle: string;
  onSeek?: (seconds: number) => void;
}

// Layout constants (SVG units)
const COL_X = [0, 220, 440, 650];
const NODE_W = [180, 180, 175, 165];
const NODE_H = 34;
const ROW_H = 42;
const PAD = 16;

const BRANCH_COLORS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#a78bfa', '#fb7185', '#2dd4bf'];

interface LaidOutNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number; // centre
  color: string;
  timestamp?: string;
  parent?: LaidOutNode;
}

/** Horizontal tree: every leaf gets its own row; parents sit centred on their children. */
function layout(map: StudyMindMap) {
  const nodes: LaidOutNode[] = [];
  let row = 0;
  const yOf = (r: number) => PAD + r * ROW_H + NODE_H / 2;

  const root: LaidOutNode = { id: 'root', label: map.root, depth: 0, x: COL_X[0], y: 0, color: '#EEEAF6' };

  const branchNodes = map.branches.map((branch, bi) => {
    const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
    const b: LaidOutNode = { id: `b${bi}`, label: branch.label, depth: 1, x: COL_X[1], y: 0, color, timestamp: branch.timestamp, parent: root };
    const childYs: number[] = [];

    if (branch.children.length === 0) {
      b.y = yOf(row);
      row += 1;
    }
    branch.children.forEach((child, ci) => {
      const c: LaidOutNode = { id: `b${bi}c${ci}`, label: child.label, depth: 2, x: COL_X[2], y: 0, color, parent: b };
      if (child.details.length === 0) {
        c.y = yOf(row);
        row += 1;
      } else {
        const detailYs = child.details.map((detail, di) => {
          const d: LaidOutNode = { id: `b${bi}c${ci}d${di}`, label: detail, depth: 3, x: COL_X[3], y: yOf(row), color, parent: c };
          row += 1;
          nodes.push(d);
          return d.y;
        });
        c.y = (detailYs[0] + detailYs[detailYs.length - 1]) / 2;
      }
      childYs.push(c.y);
      nodes.push(c);
    });
    if (childYs.length) b.y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    nodes.push(b);
    return b;
  });

  root.y = branchNodes.length
    ? (branchNodes[0].y + branchNodes[branchNodes.length - 1].y) / 2
    : yOf(0);
  nodes.push(root);

  const hasDetails = nodes.some((n) => n.depth === 3);
  const width = (hasDetails ? COL_X[3] + NODE_W[3] : COL_X[2] + NODE_W[2]) + PAD * 2;
  const height = Math.max(row, 1) * ROW_H + PAD * 2;
  return { nodes, width, height };
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function MindMapSvg({ map, onSeek, id }: { map: StudyMindMap; onSeek?: (s: number) => void; id: string }) {
  const { nodes, width, height } = useMemo(() => layout(map), [map]);

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-PAD} 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Mind map: ${map.root}`}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* connectors */}
      {nodes.filter((n) => n.parent).map((n) => {
        const p = n.parent!;
        const x1 = p.x + NODE_W[p.depth];
        const x2 = n.x;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={`edge-${n.id}`}
            d={`M ${x1} ${p.y} C ${mid} ${p.y}, ${mid} ${n.y}, ${x2} ${n.y}`}
            fill="none"
            stroke={n.color}
            strokeOpacity={n.depth === 1 ? 0.7 : 0.45}
            strokeWidth={n.depth === 1 ? 2.5 : 1.5}
          />
        );
      })}

      {/* nodes */}
      {nodes.map((n) => {
        const w = NODE_W[n.depth];
        const seconds = n.timestamp ? parseTimestamp(n.timestamp) : null;
        const clickable = seconds !== null && Boolean(onSeek);
        const isRoot = n.depth === 0;
        const fill = isRoot ? '#F2B33D' : n.depth === 1 ? `${n.color}33` : n.depth === 2 ? `${n.color}1a` : '#1F1C3B';
        const stroke = isRoot ? '#F7C862' : n.color;
        const textColor = isRoot ? '#15132B' : n.depth === 3 ? '#A9A3C2' : '#EEEAF6';
        const maxChars = n.depth === 3 ? 24 : 22;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y - NODE_H / 2})`}
            onClick={clickable ? () => onSeek!(seconds!) : undefined}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
          >
            <title>{n.label}{n.timestamp ? ` (${n.timestamp})` : ''}</title>
            <rect
              width={w}
              height={NODE_H}
              rx={isRoot ? 17 : 9}
              fill={fill}
              stroke={stroke}
              strokeOpacity={n.depth === 3 ? 0.35 : 0.8}
              strokeWidth={isRoot ? 2 : 1.2}
            />
            <text
              x={clickable ? 10 : w / 2}
              y={NODE_H / 2}
              dominantBaseline="central"
              textAnchor={clickable ? 'start' : 'middle'}
              fontSize={isRoot ? 14 : n.depth === 3 ? 11.5 : 12.5}
              fontWeight={n.depth <= 1 ? 600 : 500}
              fill={textColor}
            >
              {truncate(n.label, clickable ? maxChars - 5 : maxChars)}
            </text>
            {clickable && (
              <text x={w - 8} y={NODE_H / 2} dominantBaseline="central" textAnchor="end" fontSize={10} fill={n.color} fontFamily="monospace">
                ▶{n.timestamp}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function MindMapView({ map, videoTitle, onSeek }: MindMapViewProps) {
  const [expanded, setExpanded] = useState(false);

  const downloadSvg = () => {
    const svg = document.getElementById('mindmap-svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    // Dark background so the exported file looks like the app
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const [x, y, w, h] = (clone.getAttribute('viewBox') || '0 0 0 0').split(' ');
    bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', h);
    bg.setAttribute('fill', '#15132B');
    clone.insertBefore(bg, clone.firstChild);
    downloadText(`${slugify(videoTitle)}-mindmap.svg`, new XMLSerializer().serializeToString(clone), 'image/svg+xml');
  };

  const handleSeek = onSeek ? (s: number) => { setExpanded(false); onSeek(s); } : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-500">Click a main branch to jump to that part of the video</span>
        <div className="flex gap-1">
          <button onClick={downloadSvg} className="p-2 rounded-lg hover:bg-ink-800 text-ink-400" title="Download mind map (.svg)" aria-label="Download mind map">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(true)} className="p-2 rounded-lg hover:bg-ink-800 text-ink-400" title="Full screen" aria-label="Open mind map full screen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar rounded-xl bg-ink-950/50 border border-ink-800/60 p-4 max-h-[36rem]">
        {/* w-max + mx-auto: centred when it fits, scrollable from the left edge when it doesn't */}
        <div className="w-max mx-auto">
          <MindMapSvg map={map} onSeek={handleSeek} id="mindmap-svg" />
        </div>
      </div>

      {expanded && createPortal(
        <div className="fixed inset-0 z-[200] bg-ink-950 flex flex-col" role="dialog" aria-modal="true" aria-label="Mind map">
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800">
            <h3 className="text-lg font-semibold text-ink-100 truncate">Mind map · {videoTitle}</h3>
            <button onClick={() => setExpanded(false)} className="p-2 rounded-full hover:bg-ink-800 text-ink-300" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <MindMapSvg map={map} onSeek={handleSeek} id="mindmap-svg-full" />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
