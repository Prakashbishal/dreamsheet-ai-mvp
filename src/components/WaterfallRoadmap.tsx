import React, { useState, useMemo } from 'react';
import { Domain, SubArea, ActionStep } from '../types';
import { 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Folder, 
  ListTodo, 
  Info,
  CalendarCheck,
  Maximize2,
  Minimize2,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';

interface WaterfallRoadmapProps {
  domains: Domain[];
  clientName?: string;
}

interface TimelineRow {
  id: string;
  type: 'domain' | 'subarea' | 'step';
  name: string;
  detailTitle?: string;
  measure?: string;
  obstacle?: string;
  overcome?: string;
  startDate?: string;
  endDate?: string;
  isOngoing?: boolean;
  colorHex: string;
  colorBg: string;
  colorText: string;
  parentId?: string;
  level: number;
}

// Custom pastel colors indicating professional strategic domains
const DOMAIN_COLOR_PALETTES = [
  { hex: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }, // Emerald
  { hex: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' }, // Indigo
  { hex: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }, // Amber
  { hex: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' }, // Pink
  { hex: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' }, // Cyan
  { hex: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' }, // Violet
];

export const WaterfallRoadmap: React.FC<WaterfallRoadmapProps> = ({ domains, clientName }) => {
  // States
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>(() => {
    // Expand domains by default, collapse subareas
    const initial: Record<string, boolean> = {};
    domains.forEach(d => {
      initial[`domain-${d.id}`] = true;
    });
    return initial;
  });
  const [detailExpandedRows, setDetailExpandedRows] = useState<Record<string, boolean>>({});
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    if (id.startsWith('subarea-') || id.startsWith('step-')) {
      toggleDetails(id);
      return;
    }

    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleDetails = (id: string) => {
    setDetailExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    const detailNext: Record<string, boolean> = {};
    domains.forEach(d => {
      next[`domain-${d.id}`] = true;
      d.subAreas.forEach(s => {
        detailNext[`subarea-${s.id}`] = true;
      });
    });
    setExpandedRows(next);
    setDetailExpandedRows(detailNext);
  };

  const collapseAll = () => {
    setExpandedRows({});
    setDetailExpandedRows({});
  };

  // 1. Process and Flatten Data for the Timeline rows
  const allRows = useMemo(() => {
    const rows: TimelineRow[] = [];

    domains.forEach((d, dIdx) => {
      const palette = DOMAIN_COLOR_PALETTES[dIdx % DOMAIN_COLOR_PALETTES.length];
      
      // Calculate rollup dates for the Domain based on its subareas
      let domainMinDateStr: string | undefined = undefined;
      let domainMaxDateStr: string | undefined = undefined;

      d.subAreas.forEach(sub => {
        if (sub.startDate) {
          if (!domainMinDateStr || sub.startDate < domainMinDateStr) domainMinDateStr = sub.startDate;
        }
        if (sub.finishDate) {
          if (!domainMaxDateStr || sub.finishDate > domainMaxDateStr) domainMaxDateStr = sub.finishDate;
        }
      });

      const domainId = `domain-${d.id}`;
      // Add Domain Row
      rows.push({
        id: domainId,
        type: 'domain',
        name: d.name,
        detailTitle: d.domainGoal || d.domainVision || d.vision || d.name,
        measure: [d.currentRating !== undefined ? `Current: ${d.currentRating}/10` : null, d.futureRating !== undefined ? `Target: ${d.futureRating}/10` : null].filter(Boolean).join(' | ') || undefined,
        overcome: d.why || d.notes,
        startDate: domainMinDateStr,
        endDate: domainMaxDateStr,
        colorHex: palette.hex,
        colorBg: palette.bg,
        colorText: palette.text,
        level: 0
      });

      // Process SubAreas
      d.subAreas.forEach((sub) => {
        const subareaId = `subarea-${sub.id}`;
        
        // Rolled up steps dates for fallback
        let subareaMinDateStr = sub.startDate;
        let subareaMaxDateStr = sub.finishDate;

        if (!subareaMinDateStr || !subareaMaxDateStr) {
          sub.actionSteps?.forEach(st => {
            if (st.startDate && (!subareaMinDateStr || st.startDate < subareaMinDateStr)) {
              subareaMinDateStr = st.startDate;
            }
            if (st.endDate && (!subareaMaxDateStr || st.endDate > subareaMaxDateStr)) {
              subareaMaxDateStr = st.endDate;
            }
          });
        }

        rows.push({
          id: subareaId,
          type: 'subarea',
          name: sub.goal || sub.name || "Focus Goal",
          detailTitle: sub.goal || sub.name || "Focus Goal",
          measure: sub.successIndicator || sub.actionSteps?.map(step => step.measure).filter(Boolean).join(' | '),
          obstacle: sub.obstacles?.map(item => item.obstacle).filter(Boolean).join(' | ') || sub.actionSteps?.map(step => step.obstacle).filter(Boolean).join(' | '),
          overcome: sub.obstacles?.map(item => item.solution).filter(Boolean).join(' | ') || sub.actionSteps?.map(step => step.overcome).filter(Boolean).join(' | '),
          startDate: subareaMinDateStr,
          endDate: subareaMaxDateStr,
          isOngoing: sub.isOngoing,
          colorHex: palette.hex,
          colorBg: palette.bg,
          colorText: palette.text,
          parentId: domainId,
          level: 1
        });

        // Add action steps if visible
        if (showSteps) {
          sub.actionSteps?.forEach((step, stepIdx) => {
            rows.push({
              id: `step-${sub.id}-${stepIdx}`,
              type: 'step',
              name: step.task || "Action step",
              detailTitle: step.task || "Action step",
              measure: step.measure,
              obstacle: step.obstacle,
              overcome: step.overcome,
              startDate: step.startDate || subareaMinDateStr, // fallback to subarea dates
              endDate: step.endDate || subareaMaxDateStr,
              isOngoing: step.isOngoing,
              colorHex: palette.hex,
              colorBg: 'bg-stone-50',
              colorText: 'text-stone-600',
              parentId: subareaId,
              level: 2
            });
          });
        }
      });
    });

    return rows;
  }, [domains, showSteps]);

  // 2. Identify chronological boundaries
  const timeBoundaries = useMemo(() => {
    let absoluteMin = new Date();
    // Default 6 months ahead in case of empty dates
    let absoluteMax = new Date(absoluteMin.getTime() + 180 * 24 * 60 * 60 * 1000);
    let datesFound = false;

    allRows.forEach(row => {
      if (row.startDate) {
        const d = new Date(row.startDate);
        if (!isNaN(d.getTime())) {
          if (!datesFound || d < absoluteMin) absoluteMin = d;
          datesFound = true;
        }
      }
      if (row.endDate) {
        const d = new Date(row.endDate);
        if (!isNaN(d.getTime())) {
          if (!datesFound || d > absoluteMax) absoluteMax = d;
          datesFound = true;
        }
      }
    });

    // Pad dates slightly for aesthetics (15 days start, 15 days end)
    const minTime = new Date(absoluteMin.getTime() - 10 * 24 * 60 * 60 * 1000);
    const maxTime = new Date(absoluteMax.getTime() + 15 * 24 * 60 * 60 * 1000);

    return {
      min: minTime,
      max: maxTime,
      totalMs: maxTime.getTime() - minTime.getTime(),
      hasValidDates: datesFound
    };
  }, [allRows]);

  // 3. Generate Timeline Columns (Month by Month segments)
  const columns = useMemo(() => {
    const { min, max } = timeBoundaries;
    const cols: { key: string; label: string; yearLabel: string; startPercent: number; widthPercent: number }[] = [];
    
    const startIter = new Date(min.getFullYear(), min.getMonth(), 1);
    const endIter = new Date(max.getFullYear(), max.getMonth() + 1, 1);
    const totalMs = timeBoundaries.totalMs;

    let current = new Date(startIter);
    while (current < endIter) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);

      const startMs = Math.max(min.getTime(), monthStart.getTime());
      const endMs = Math.min(max.getTime(), monthEnd.getTime());

      if (endMs > startMs) {
        const startPercent = ((startMs - min.getTime()) / totalMs) * 100;
        const widthPercent = ((endMs - startMs) / totalMs) * 100;

        cols.push({
          key: `${current.getFullYear()}-${current.getMonth()}`,
          label: current.toLocaleString('default', { month: 'short' }),
          yearLabel: `'${String(current.getFullYear()).substring(2)}`,
          startPercent,
          widthPercent
        });
      }

      current.setMonth(current.getMonth() + 1);
    }

    return cols;
  }, [timeBoundaries]);

  // Filter Rows based on expanded states and active filters
  const visibleRows = useMemo(() => {
    return allRows.filter(row => {
      // Apply Domain Level Filter
      if (filterDomain !== 'all') {
        const targetDomainId = `domain-${filterDomain}`;
        if (row.type === 'domain' && row.id !== targetDomainId) return false;
        if (row.type === 'subarea' && row.parentId !== targetDomainId) return false;
        if (row.type === 'step') {
          // find grandparent
          const parentRow = allRows.find(r => r.id === row.parentId);
          if (!parentRow || parentRow.parentId !== targetDomainId) return false;
        }
      }

      // Respect domain-level closure. Focus-area detail expansion is separate from step visibility.
      if (row.level === 1 && row.parentId && !expandedRows[row.parentId]) {
        return false;
      }

      if (row.level === 2 && row.parentId) {
        const parentRow = allRows.find(r => r.id === row.parentId);
        if (parentRow?.parentId && !expandedRows[parentRow.parentId]) {
          return false;
        }
      }

      return true;
    });
  }, [allRows, expandedRows, filterDomain]);

  // Helper to compute layout percentages for a scheduling bar
  const getBarPosition = (startDateStr?: string, endDateStr?: string) => {
    if (!startDateStr || !endDateStr) return null;
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const { min, totalMs } = timeBoundaries;

    // Constrain to total bounding timeline
    const barStartMs = Math.max(min.getTime(), start.getTime());
    const barEndMs = Math.min(timeBoundaries.max.getTime(), end.getTime());

    if (barEndMs <= barStartMs) return null;

    const leftPercent = ((barStartMs - min.getTime()) / totalMs) * 100;
    const widthPercent = ((barEndMs - barStartMs) / totalMs) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`
    };
  };

  const formatDateLabel = (dStr?: string) => {
    if (!dStr) return 'TBD';
    const dateObj = new Date(dStr);
    if (isNaN(dateObj.getTime())) return 'TBD';
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDurationLabel = (row: TimelineRow) => {
    if (!row.startDate || !row.endDate || row.isOngoing) return row.isOngoing ? 'Ongoing' : 'TBD';

    const start = new Date(row.startDate);
    const end = new Date(row.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 'TBD';

    const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    if (dayCount < 14) return `${dayCount} day${dayCount === 1 ? '' : 's'}`;

    const weekCount = Math.round(dayCount / 7);
    if (weekCount < 10) return `${weekCount} week${weekCount === 1 ? '' : 's'}`;

    const monthCount = Math.round(dayCount / 30);
    return `${monthCount} month${monthCount === 1 ? '' : 's'}`;
  };

  const hasAdditionalDetails = (row: TimelineRow) => Boolean(row.measure || row.obstacle || row.overcome || row.startDate || row.endDate || row.isOngoing);

  const renderDetailRows = (row: TimelineRow) => {
    const detailRows = [
      { label: row.type === 'step' ? 'Task' : 'Strategic Target', value: row.detailTitle || row.name },
      { label: 'Timeline', value: `${formatDateLabel(row.startDate)} to ${row.isOngoing ? 'Ongoing' : formatDateLabel(row.endDate)} (${getDurationLabel(row)})` },
      { label: 'Measure', value: row.measure },
      { label: 'Obstacle', value: row.obstacle },
      { label: 'Overcome / Solution', value: row.overcome }
    ].filter(item => item.value && item.value.trim());

    if (!detailRows.length || !hasAdditionalDetails(row)) {
      return <p className="text-xs text-stone-500 italic">No additional details available yet.</p>;
    }

    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {detailRows.map(item => (
          <div key={item.label} className="space-y-1">
            <dt className="text-[9px] font-extrabold uppercase tracking-widest text-stone-400">{item.label}</dt>
            <dd className="text-stone-700 leading-relaxed break-words">{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderTooltip = (row: TimelineRow) => (
    <div className="absolute left-1/2 top-full z-[999] mt-2 min-w-[260px] max-w-[340px] -translate-x-1/2 rounded-xl border border-stone-800 bg-stone-900 p-3 text-left text-[11px] leading-relaxed text-white shadow-2xl pointer-events-none">
      <div className="mb-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">{row.type} Info</div>
      <div className="mb-2 text-xs font-bold">{row.name}</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 font-mono font-medium text-stone-100">
          <Calendar size={11} className="shrink-0 text-emerald-400" />
          {formatDateLabel(row.startDate)} to {row.isOngoing ? 'Ongoing' : formatDateLabel(row.endDate)}
        </div>
        <div className="font-mono text-stone-200">Duration: {getDurationLabel(row)}</div>
        {row.measure && <div><span className="font-bold text-emerald-300">Measure:</span> {row.measure}</div>}
        {row.obstacle && <div><span className="font-bold text-amber-300">Obstacle:</span> {row.obstacle}</div>}
        {row.overcome && <div><span className="font-bold text-cyan-300">Overcome:</span> {row.overcome}</div>}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-stone-900" />
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-visible mt-6 mb-12">
      {/* Roadmap Panel Header */}
      <div className="bg-stone-50 p-6 border-b border-stone-200 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Cohesive Project Plan</span>
          </div>
          <h3 className="text-xl font-bold text-stone-900 tracking-tight">Interactive Strategic Waterfall Diagram</h3>
          <p className="text-stone-500 text-xs mt-1">
            Visual sequence showing aligned domain, objectives, and steps plotted along a fluid project timeframe.
          </p>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-3 self-start xl:self-center">
          {/* Domain Filter Dropdown */}
          <div className="relative flex items-center bg-white rounded-xl border border-stone-200 px-3 py-1.5 shadow-sm text-xs">
            <span className="text-stone-400 font-bold mr-2 uppercase text-[9px] tracking-wider">Show:</span>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="bg-transparent border-0 font-semibold text-stone-700 outline-none cursor-pointer pr-1"
            >
              <option value="all">All Domains</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Action Steps toggle control */}
          <button
            onClick={() => setShowSteps(!showSteps)}
            aria-label={showSteps ? 'Hide action steps in roadmap' : 'Show action steps in roadmap'}
            title={showSteps ? 'Hide action steps' : 'Show action steps'}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
              showSteps 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <ListTodo size={14} />
            {showSteps ? "Hide Steps" : "Show Steps"}
          </button>

          {/* Expand & Collapse all helpers */}
          <div className="flex items-center rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <button
              onClick={expandAll}
              title="Expand All Rows"
              className="p-2 hover:bg-stone-50 text-stone-600 border-r border-stone-100 transition-colors"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={collapseAll}
              title="Collapse All Rows"
              className="p-2 hover:bg-stone-50 text-stone-600 transition-colors"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Date missing banner if no dates specified */}
      {!timeBoundaries.hasValidDates && (
        <div className="bg-amber-50 border-b border-amber-100 p-4 text-xs text-amber-800 flex items-start gap-3">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Estimated Baseline Timeline</p>
            <p className="mt-0.5 text-amber-700 font-medium">
              You haven't explicitly set specific start or target dates for some elements under previous stages. We have assembled a fluid 6-month visual window below starting from today for demonstration. You can set accurate dates directly in the workshop at any time!
            </p>
          </div>
        </div>
      )}

      {/* Main Gantt Grid Canvas */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[850px] w-full flex flex-col font-sans">
          
          {/* Calendar timeline months header column layout */}
          <div className="flex items-stretch border-b border-stone-200 bg-stone-50/50">
            {/* Left sidebar spacer name */}
            <div className="w-[340px] shrink-0 p-4 border-r border-stone-200 flex items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400">Strategic Items</span>
            </div>

            {/* Time labels column cells */}
            <div className="flex-1 relative min-h-[44px]">
              {columns.map(col => (
                <div 
                  key={col.key} 
                  className="absolute bottom-0 top-0 border-r border-stone-100 p-2 flex flex-col justify-center items-center text-center text-[10px] select-none"
                  style={{ left: `${col.startPercent}%`, width: `${col.widthPercent}%` }}
                >
                  <span className="font-bold text-stone-700">{col.label}</span>
                  <span className="text-[8px] font-bold text-stone-400 uppercase">{col.yearLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table Timeline Row Grid List */}
          <div className="relative divide-y divide-stone-100 bg-white">
            
            {visibleRows.map((row) => {
              const hasTimeline = row.startDate && row.endDate;
              const barPos = getBarPosition(row.startDate, row.endDate);
              const isHovered = hoveredRowId === row.id;
              const isDetailExpanded = Boolean(detailExpandedRows[row.id]);
              const isHierarchyExpanded = Boolean(expandedRows[row.id]);
              const isDomainRow = row.type === 'domain';
              const isExpandableDetailRow = row.type !== 'domain';

              return (
                <React.Fragment key={row.id}>
                <div
                  className={`flex items-stretch relative transition-all group ${
                    isHovered ? 'bg-stone-50/80' : 'hover:bg-stone-50/30'
                  } ${isExpandableDetailRow ? 'cursor-pointer' : ''}`}
                  onMouseEnter={() => setHoveredRowId(row.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={() => {
                    if (isExpandableDetailRow) toggleDetails(row.id);
                  }}
                >
                  {/* Left Label Name and Details Component */}
                  <div 
                    className="w-[340px] shrink-0 p-3 md:p-4 border-r border-stone-200 flex items-center relative z-20 bg-white group-hover:bg-stone-50/80 transition-colors"
                    style={{ paddingLeft: `${Math.max(16, (row.level * 24) + 16)}px` }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {/* Collapse Handle and Chevrons for Hierarchical folding */}
                      {row.type !== 'step' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(row.id);
                          }}
                          aria-label={row.type === 'domain' ? `${expandedRows[row.id] ? 'Collapse' : 'Expand'} ${row.name} child rows` : `${expandedRows[row.id] ? 'Hide' : 'Show'} details for ${row.name}`}
                          title={row.type === 'domain' ? `${expandedRows[row.id] ? 'Collapse' : 'Expand'} child rows` : `${expandedRows[row.id] ? 'Hide' : 'Show'} details`}
                          className="w-5 h-5 rounded hover:bg-stone-100 flex items-center justify-center text-stone-500 shrink-0 transition-all focus:outline-none"
                        >
                          {expandedRows[row.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <div className="w-5 shrink-0 flex justify-center text-stone-300">
                          <span className="text-xs font-bold leading-none">•</span>
                        </div>
                      )}

                      {/* Icon markers describing the item level */}
                      {row.type === 'domain' && (
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border border-stone-200" style={{ backgroundColor: row.colorBg }}>
                          <LayoutGrid size={12} style={{ color: row.colorHex }} />
                        </div>
                      )}
                      {row.type === 'subarea' && (
                        <Folder size={13} className="text-stone-400 shrink-0" />
                      )}
                      {row.type === 'step' && (
                        <CalendarCheck size={12} className="text-stone-400 shrink-0" />
                      )}

                      {/* Display Label text */}
                      <div className="truncate flex-1">
                        <span className={`block truncate ${
                          row.type === 'domain' 
                            ? 'font-extrabold text-stone-900 text-sm tracking-tight' 
                            : row.type === 'subarea' 
                              ? 'font-bold text-stone-800 text-xs' 
                              : 'font-medium text-stone-600 text-[11px]'
                        }`}>
                          {row.name}
                        </span>
                        
                        {/* Dates Subtitle tag */}
                        {hasTimeline && (
                          <span className="text-[9px] font-bold text-stone-400 uppercase flex items-center gap-1 mt-0.5 font-mono">
                            <Clock size={8} /> {formatDateLabel(row.startDate)} to {formatDateLabel(row.endDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Track and Gantt Bar Plot Area */}
                  <div className="flex-1 relative min-h-[58px] overflow-visible select-none">
                    {/* Vertical guideline column indicators printed under bar plots */}
                    <div className="absolute inset-0 pointer-events-none z-0 flex">
                      {columns.map(col => (
                        <div 
                          key={`bg-line-${col.key}`} 
                          className="absolute bottom-0 top-0 border-r border-stone-100/70"
                          style={{ left: `${col.startPercent + col.widthPercent}%` }}
                        />
                      ))}
                    </div>

                    {/* Styled timeline waterfall block representation */}
                    {hasTimeline && barPos ? (
                      <div className="absolute inset-y-0 w-full flex items-center px-1 z-10 pointer-events-none">
                        <div 
                          className={`h-7 rounded-lg shadow-sm border flex items-center justify-between px-3 relative pointer-events-auto transition-all ${
                            row.type === 'domain' 
                              ? 'opacity-95 text-white font-bold text-[10px] uppercase shadow-md' 
                              : row.type === 'subarea' 
                                ? 'opacity-85 text-stone-800 font-semibold text-[9px]' 
                                : 'opacity-70 text-stone-600 font-medium text-[8px]'
                          }`}
                          style={{ 
                            left: barPos.left, 
                            width: barPos.width,
                            backgroundColor: row.type === 'domain' ? row.colorHex : undefined,
                            borderColor: row.type === 'domain' ? 'transparent' : row.colorHex,
                            color: row.type === 'domain' ? '#ffffff' : undefined
                          }}
                        >
                          {/* Inner bar detail text if spacious enough */}
                          <div className={`truncate max-w-full ${row.type !== 'domain' ? row.colorBg : ''} ${row.type !== 'domain' ? 'px-1.5 py-0.5 rounded border' : ''}`} style={{ borderColor: row.type !== 'domain' ? row.colorHex : 'transparent' }}>
                            <span className="truncate block font-mono">{formatDateLabel(row.startDate).split(',')[0]} – {formatDateLabel(row.endDate).split(',')[0]}</span>
                          </div>

                          {/* Hover Tooltip Overlay element */}
                          {isHovered && renderTooltip(row)}
                          {false && isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-stone-900 border border-stone-800 text-white rounded-xl shadow-2xl text-[11px] whitespace-normal z-50 text-left min-w-[240px] pointer-events-none leading-relaxed leading-[1.3] opacity-100 animate-fade-in animate-duration-150">
                              <div className="font-extrabold uppercase text-[9px] text-emerald-400 mb-1 tracking-wider">{row.type} Info</div>
                              <div className="font-bold mb-1 text-xs">{row.name}</div>
                              <div className="text-stone-100 font-medium flex items-center gap-1 font-mono">
                                <Calendar size={11} className="text-emerald-400 shrink-0" /> {formatDateLabel(row.startDate)} – {formatDateLabel(row.endDate)}
                              </div>
                                {row.type === 'domain' && (
                                  <div className="text-[10px] text-stone-100 font-medium mt-1 italic">Note: Aggregated timeline across this strategic domain.</div>
                                )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-stone-900" />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Fallback dotted representation if a direct date has not been configured yet */
                      <div className="absolute inset-y-0 w-full flex items-center px-4 z-10 pointer-events-none">
                        <div className="h-6 w-full border border-dashed border-stone-200 bg-stone-50/30 rounded-lg flex items-center justify-center text-stone-400 text-[10px] font-medium italic">
                          No timeline date schedule defined for this task
                        </div>
                      </div>
                    )}

                  </div>
                </div>
                {isDetailExpanded && (
                  <div className="flex bg-stone-50/80">
                    <div className="w-[340px] shrink-0 border-r border-stone-200 bg-stone-50/80" />
                    <div className="flex-1 min-w-0 p-4">
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        {renderDetailRows(row)}
                      </div>
                    </div>
                  </div>
                )}
                </React.Fragment>
              );
            })}

          </div>
        </div>
      </div>

      {/* Decorative timeline footer legend */}
      <div className="bg-stone-50/50 p-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4 text-[10px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-stone-400 font-extrabold uppercase tracking-wider text-[9px]">Legend:</span>
          {domains.map((d, dIdx) => {
            const palette = DOMAIN_COLOR_PALETTES[dIdx % DOMAIN_COLOR_PALETTES.length];
            return (
              <div key={d.id} className="flex items-center gap-1.5 font-bold text-stone-700">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette.hex }} />
                <span>{d.name}</span>
              </div>
            );
          })}
        </div>
        <div className="text-stone-400 font-medium font-mono text-[9px]">
          Hover elements to inspect detailed durations
        </div>
      </div>
    </div>
  );
};
