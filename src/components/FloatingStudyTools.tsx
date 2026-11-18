import React, { useCallback, useEffect, useRef, useState } from 'react';

interface FloatingStudyToolsProps {
  scopeKey: string;
  label?: string;
}

type DrawTool = 'cursor' | 'pen' | 'highlighter' | 'eraser';

interface StrokePoint {
  x: number;
  y: number;
}

interface StrokeRecord {
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
  alpha: number;
  points: StrokePoint[];
}

const PEN_COLORS = [
  { id: 'ink', label: 'Charcoal Ink', hex: '#192026' },
  { id: 'forest', label: 'Forest Green', hex: '#1d4d41' },
  { id: 'rust', label: 'Crimson', hex: '#9e3b24' },
];

const HIGHLIGHT_COLORS = [
  { id: 'gold', label: 'Warm Yellow', hex: '#facc15' },
  { id: 'mint', label: 'Mint', hex: '#34d399' },
];

const NOTES_STORAGE_KEY = 'sat_1400_scratch_notes_v1';

function loadNotesMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export const FloatingStudyTools: React.FC<FloatingStudyToolsProps> = ({
  scopeKey,
  label = 'Scratchpad & Highlighter',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tool, setTool] = useState<DrawTool>('highlighter');
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].hex);
  const [strokes, setStrokes] = useState<StrokeRecord[]>([]);
  const [noteText, setNoteText] = useState(() => loadNotesMap()[scopeKey] || '');
  const [notepadCollapsed, setNotepadCollapsed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<StrokeRecord | null>(null);
  const isDrawingRef = useRef(false);

  // Sync note text when switching day/step
  useEffect(() => {
    setNoteText(loadNotesMap()[scopeKey] || '');
    setStrokes([]);
  }, [scopeKey]);

  const handleNoteChange = (next: string) => {
    setNoteText(next);
    try {
      const map = loadNotesMap();
      if (next.trim()) {
        map[scopeKey] = next;
      } else {
        delete map[scopeKey];
      }
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota errors
    }
  };

  const redrawCanvas = useCallback(
    (list: StrokeRecord[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const s of list) {
        if (s.points.length === 0) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = s.width;
        if (s.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = s.alpha;
          ctx.strokeStyle = s.color;
        }

        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        if (s.points.length === 1) {
          ctx.lineTo(s.points[0].x + 0.01, s.points[0].y + 0.01);
        } else {
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x, s.points[i].y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    redrawCanvas(strokes);
    const onResize = () => redrawCanvas(strokes);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, strokes, redrawCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'cursor') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const record: StrokeRecord = {
      tool,
      color: tool === 'highlighter' ? highlightColor : penColor,
      width: tool === 'highlighter' ? 18 : tool === 'eraser' ? 22 : 2.3,
      alpha: tool === 'highlighter' ? 0.3 : 1,
      points: [{ x: e.clientX, y: e.clientY }],
    };
    activeStrokeRef.current = record;
    redrawCanvas([...strokes, record]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    activeStrokeRef.current.points.push({ x: e.clientX, y: e.clientY });
    redrawCanvas([...strokes, activeStrokeRef.current]);
  };

  const finishStroke = () => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    isDrawingRef.current = false;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const isDrawingTool = isOpen && tool !== 'cursor';

  return (
    <>
      {isOpen && (
        <canvas
          ref={canvasRef}
          className={`study-ink-canvas ${isDrawingTool ? 'is-drawing-active' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      )}

      {isOpen && (
        <aside
          className="floating-study-panel"
          role="region"
          aria-label="Floating Notepad, Highlighter & Pen"
        >
          <div className="study-panel-head">
            <span className="study-panel-title">✎ {label}</span>
            <div className="study-panel-head-btns">
              <button
                type="button"
                className="study-mini-btn"
                onClick={() => setNotepadCollapsed((v) => !v)}
                title={notepadCollapsed ? 'Expand Notepad' : 'Collapse Notepad'}
              >
                {notepadCollapsed ? 'Expand' : 'Min'}
              </button>
              <button
                type="button"
                className="study-mini-btn"
                onClick={() => setIsOpen(false)}
                title="Hide Scratchpad & Highlighter"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawing & Highlighting Toolbar */}
          <div className="study-tool-row" role="toolbar" aria-label="Screen annotation tools">
            <button
              type="button"
              className={`study-tool-btn ${tool === 'cursor' ? 'is-active' : ''}`}
              onClick={() => setTool('cursor')}
              title="Interact with questions normally (keep ink visible)"
            >
              ↖ Cursor
            </button>
            <button
              type="button"
              className={`study-tool-btn ${tool === 'highlighter' ? 'is-active' : ''}`}
              onClick={() => setTool('highlighter')}
              title="Highlight passage text on screen"
            >
              🖍 Highlight
            </button>
            <button
              type="button"
              className={`study-tool-btn ${tool === 'pen' ? 'is-active' : ''}`}
              onClick={() => setTool('pen')}
              title="Freehand Pen"
            >
              ✎ Pen
            </button>
            <button
              type="button"
              className={`study-tool-btn ${tool === 'eraser' ? 'is-active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Erase strokes"
            >
              ⌫ Erase
            </button>
          </div>

          <div className="study-color-row">
            <div className="study-swatches">
              {(tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS).map((c) => {
                const activeHex = tool === 'highlighter' ? highlightColor : penColor;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.label}
                    title={c.label}
                    className={`study-swatch ${activeHex === c.hex ? 'is-selected' : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() =>
                      tool === 'highlighter' ? setHighlightColor(c.hex) : setPenColor(c.hex)
                    }
                  />
                );
              })}
            </div>

            <div className="study-ink-actions">
              <button
                type="button"
                className="study-mini-btn"
                disabled={strokes.length === 0}
                onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              >
                Undo
              </button>
              <button
                type="button"
                className="study-mini-btn"
                disabled={strokes.length === 0}
                onClick={() => setStrokes([])}
              >
                Clear Ink
              </button>
            </div>
          </div>

          {!notepadCollapsed && (
            <div className="study-notepad-body">
              <div className="study-notepad-label-row">
                <label htmlFor={`scratch-note-${scopeKey}`}>Quick Scratchpad</label>
                {noteText && (
                  <button
                    type="button"
                    className="study-mini-btn"
                    onClick={() => handleNoteChange('')}
                  >
                    Clear Note
                  </button>
                )}
              </div>
              <textarea
                id={`scratch-note-${scopeKey}`}
                rows={4}
                placeholder="Jot algebra steps, clause stripping, or elimination notes here..."
                value={noteText}
                onChange={(e) => handleNoteChange(e.target.value)}
              />
            </div>
          )}
        </aside>
      )}

      <button
        type="button"
        className={`floating-tools-toggle ${isOpen ? 'is-open' : ''}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        title="Toggle Floating Notepad, Highlighter & Pen"
      >
        {isOpen ? '✕ Hide Tools' : '✎ Notepad & Pen'}
      </button>
    </>
  );
};
