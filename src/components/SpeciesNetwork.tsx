/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { GBIFOccurrence } from "../types";
import { 
  GitBranch, 
  Activity, 
  Info, 
  Settings, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  List, 
  HelpCircle,
  Network
} from "lucide-react";

interface SpeciesNetworkProps {
  occurrences: GBIFOccurrence[];
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  scientificName: string;
  kingdom?: string;
  class?: string;
  family?: string;
  genus?: string;
  recordCount: number;
  countries: Set<string>;
  years: Set<number>;
  coordinates: Set<string>; // rounded grid cells "lat,lon"
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  taxonomicWeight: number; // 0 to 1
  spatialWeight: number;     // 0 to 1 (sympatry in grid cell)
  geographicWeight: number;  // 0 to 1 (shared country)
  totalWeight: number;       // calculated based on toggles
  relationshipTypes: string[];
}

export default function SpeciesNetwork({ occurrences }: SpeciesNetworkProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Configuration States
  const [includeTaxonomy, setIncludeTaxonomy] = useState(true);
  const [includeSympatry, setIncludeSympatry] = useState(true);
  const [includeGeographic, setIncludeGeographic] = useState(false);
  const [minLinkWeight, setMinLinkWeight] = useState(0.1);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Emojis based on Taxonomy
  const getKingdomEmoji = (kingdom?: string) => {
    if (!kingdom) return "🧬";
    const k = kingdom.toUpperCase();
    if (k === "ANIMALIA") return "🐾";
    if (k === "PLANTAE") return "🌱";
    if (k === "FUNGI") return "🍄";
    if (k === "BACTERIA" || k === "ARCHAEA") return "🧫";
    return "🧬";
  };

  // 1. CONSTRUCT NODES AND LINKS FROM OCCURRENCES
  const { nodes, links, rawStats } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();

    // Step A: Extract species and aggregate their records
    occurrences.forEach((occ) => {
      // Use scientificName or species name. If empty, skip
      const name = occ.scientificName || occ.species;
      if (!name) return;

      if (!nodeMap.has(name)) {
        nodeMap.set(name, {
          id: name,
          scientificName: name,
          kingdom: occ.kingdom,
          class: occ.class,
          family: occ.family,
          genus: occ.genus,
          recordCount: 0,
          countries: new Set<string>(),
          years: new Set<number>(),
          coordinates: new Set<string>(),
        });
      }

      const node = nodeMap.get(name)!;
      node.recordCount += 1;
      if (occ.country) node.countries.add(occ.country);
      if (occ.year) node.years.add(occ.year);
      if (occ.decimalLatitude !== undefined && occ.decimalLongitude !== undefined) {
        // Round coordinates to 1 decimal place (~11km grid box) to detect sympatric co-habitation
        const roundedLat = occ.decimalLatitude.toFixed(1);
        const roundedLon = occ.decimalLongitude.toFixed(1);
        node.coordinates.add(`${roundedLat},${roundedLon}`);
      }
    });

    const nodeList = (Array.from(nodeMap.values()) as NetworkNode[])
      .sort((a, b) => b.recordCount - a.recordCount);

    // Step B: Calculate pairwise link weights
    const linkList: NetworkLink[] = [];

    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const u = nodeList[i];
        const v = nodeList[j];

        // 1. Taxonomic Similarity Weight
        let taxonomicWeight = 0;
        if (u.genus && v.genus && u.genus === v.genus) {
          taxonomicWeight = 1.0; // Same genus
        } else if (u.family && v.family && u.family === v.family) {
          taxonomicWeight = 0.6; // Same family
        } else if (u.class && v.class && u.class === v.class) {
          taxonomicWeight = 0.2; // Same class
        } else if (u.kingdom && v.kingdom && u.kingdom === v.kingdom) {
          taxonomicWeight = 0.05; // Same kingdom
        }

        // 2. Sympatric (Spatial Co-occurrence) Weight
        let spatialWeight = 0;
        let sharedGrids = 0;
        u.coordinates.forEach((grid) => {
          if (v.coordinates.has(grid)) {
            sharedGrids++;
          }
        });
        if (sharedGrids > 0) {
          // Normalize based on min grids available or log-scale
          spatialWeight = Math.min(1.0, sharedGrids * 0.25);
        }

        // 3. Geographic (Shared Country) Weight
        let geographicWeight = 0;
        let sharedCountries = 0;
        u.countries.forEach((country) => {
          if (v.countries.has(country)) {
            sharedCountries++;
          }
        });
        if (sharedCountries > 0) {
          geographicWeight = Math.min(1.0, sharedCountries * 0.4);
        }

        // Calculate dynamic total weight based on toggles
        let activeWeightSum = 0;
        let activeTogglesCount = 0;

        if (includeTaxonomy) {
          activeWeightSum += taxonomicWeight;
          activeTogglesCount++;
        }
        if (includeSympatry) {
          activeWeightSum += spatialWeight;
          activeTogglesCount++;
        }
        if (includeGeographic) {
          activeWeightSum += geographicWeight;
          activeTogglesCount++;
        }

        const totalWeight = activeTogglesCount > 0 ? (activeWeightSum / activeTogglesCount) : 0;

        // If any relation exists, keep record
        if (taxonomicWeight > 0 || spatialWeight > 0 || geographicWeight > 0) {
          const relationshipTypes: string[] = [];
          if (taxonomicWeight > 0.5) relationshipTypes.push("Taksonomi Dekat (Satu Genus)");
          else if (taxonomicWeight > 0.1) relationshipTypes.push("Satu Famili");
          if (spatialWeight > 0) relationshipTypes.push(`Simpatrik (${sharedGrids} Grid Koordinat)`);
          if (geographicWeight > 0) relationshipTypes.push("Satu Negara Sebaran");

          linkList.push({
            source: u.id,
            target: v.id,
            taxonomicWeight,
            spatialWeight,
            geographicWeight,
            totalWeight,
            relationshipTypes,
          });
        }
      }
    }

    // Filter links by active threshold
    const filteredLinks = linkList.filter((l) => l.totalWeight >= minLinkWeight);

    return {
      nodes: nodeList,
      links: filteredLinks,
      rawStats: {
        totalSpecies: nodeList.length,
        potentialLinksCount: linkList.length,
        activeLinksCount: filteredLinks.length,
      }
    };
  }, [occurrences, includeTaxonomy, includeSympatry, includeGeographic, minLinkWeight]);

  // Handle D3 simulation lifecycle
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous drawings

    const width = containerRef.current.clientWidth || 600;
    const height = 480;

    // Create a container group for zooming and panning
    const g = svg.append("g").attr("class", "zoom-container");

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Initial Zoom/Transform to Center the Graph
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

    // Prepare deep-cloned nodes and links for simulation (D3 mutates them)
    const simNodes: NetworkNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: NetworkLink[] = links.map((l) => ({
      ...l,
      source: simNodes.find((n) => n.id === (typeof l.source === "object" ? l.source.id : l.source))!,
      target: simNodes.find((n) => n.id === (typeof l.target === "object" ? l.target.id : l.target))!,
    })).filter(l => l.source && l.target); // safety filter

    // Force Simulation Setup
    const simulation = d3.forceSimulation<NetworkNode>(simNodes)
      .force("link", d3.forceLink<NetworkNode, NetworkLink>(simLinks)
        .id((d) => d.id)
        .distance((d) => 180 - d.totalWeight * 120) // stronger links pull nodes closer
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("collision", d3.forceCollide<NetworkNode>().radius((d) => Math.max(15, Math.sqrt(d.recordCount) * 1.5 + 10)))
      .force("center", d3.forceCenter(0, 0)); // Simulation centers around 0,0 since we translated container to center

    // Draw Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("stroke", (d) => {
        // Color based on primary driver
        if (d.spatialWeight > d.taxonomicWeight && d.spatialWeight > d.geographicWeight) return "#10b981"; // Emerald
        if (d.taxonomicWeight > d.spatialWeight && d.taxonomicWeight > d.geographicWeight) return "#8b5cf6"; // Purple
        return "#cbd5e1"; // Slate
      })
      .attr("stroke-opacity", (d) => 0.4 + d.totalWeight * 0.5)
      .attr("stroke-width", (d) => 1 + d.totalWeight * 5)
      .attr("class", "transition-all cursor-pointer hover:stroke-orange-500")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-opacity", 1.0).attr("stroke", "#f97316");
      })
      .on("mouseout", function (event, d) {
        const defaultColor = (d.spatialWeight > d.taxonomicWeight && d.spatialWeight > d.geographicWeight) ? "#10b981" 
                           : (d.taxonomicWeight > d.spatialWeight && d.taxonomicWeight > d.geographicWeight) ? "#8b5cf6" 
                           : "#cbd5e1";
        d3.select(this).attr("stroke-opacity", 0.4 + d.totalWeight * 0.5).attr("stroke", defaultColor);
      });

    // Draw Nodes Container
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, NetworkNode>("g")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("class", "cursor-pointer")
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      )
      .on("click", (event, d) => {
        setSelectedNode(d);
      })
      .on("mouseover", (event, d) => {
        setHoveredNode(d);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      });

    // Node circles (Base Glow and fill)
    node.append("circle")
      .attr("r", (d) => Math.max(8, Math.sqrt(d.recordCount) * 1.5 + 4))
      .attr("fill", (d) => {
        if (d.kingdom?.toUpperCase() === "PLANTAE") return "#dcfce7"; // Light green
        if (d.kingdom?.toUpperCase() === "ANIMALIA") return "#ffe4e6"; // Light pink
        return "#f1f5f9"; // Slate 100
      })
      .attr("stroke", (d) => {
        if (d.kingdom?.toUpperCase() === "PLANTAE") return "#22c55e"; // Green 500
        if (d.kingdom?.toUpperCase() === "ANIMALIA") return "#ef4444"; // Red 500
        return "#64748b"; // Slate 500
      })
      .attr("stroke-width", (d) => (selectedNode?.id === d.id ? 4 : 2))
      .style("filter", "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.08))");

    // Emojis / Emojipins inside node circles
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".3em")
      .style("font-size", (d) => `${Math.max(10, Math.min(16, Math.sqrt(d.recordCount) * 0.8 + 8))}px`)
      .text((d) => getKingdomEmoji(d.kingdom));

    // Text labels
    node.append("text")
      .attr("dx", (d) => Math.max(12, Math.sqrt(d.recordCount) * 1.5 + 8))
      .attr("dy", ".35em")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .attr("fill", "#1e293b") // Slate 800
      .text((d) => d.scientificName.split(" ").slice(0, 3).join(" ")); // Keep it short and elegant

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as NetworkNode).x || 0)
        .attr("y1", (d) => (d.source as NetworkNode).y || 0)
        .attr("x2", (d) => (d.target as NetworkNode).x || 0)
        .attr("y2", (d) => (d.target as NetworkNode).y || 0);

      node.attr("transform", (d) => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Drag helper functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Zoom buttons helper handlers
    const zoomInBtn = d3.select("#btn-zoom-in").on("click", () => {
      svg.transition().duration(250).call(zoom.scaleBy, 1.3);
    });

    const zoomOutBtn = d3.select("#btn-zoom-out").on("click", () => {
      svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.3);
    });

    const zoomResetBtn = d3.select("#btn-zoom-reset").on("click", () => {
      svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, selectedNode]);

  // Find connections for the selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    return links
      .filter((l) => {
        const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;
        return srcId === selectedNode.id || tgtId === selectedNode.id;
      })
      .map((l) => {
        const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;
        const linkedId = srcId === selectedNode.id ? tgtId : srcId;
        const linkedNode = nodes.find((n) => n.id === linkedId);

        return {
          node: linkedNode,
          weight: l.totalWeight,
          types: l.relationshipTypes,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [selectedNode, links, nodes]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Control Settings and Info Panel */}
      <div className="flex flex-col gap-5 lg:col-span-1">
        
        {/* Statistics and Settings */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold font-display uppercase tracking-wider">
              Parameter Relasi Spesies
            </h3>
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Metode ini mendeteksi kekerabatan sains dan kesamaan wilayah habitat (sympatry) secara spasial pada rekor database global.
          </p>

          <hr className="border-slate-100" />

          {/* Toggle Options */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Metode Penghubung Node
            </span>

            {/* Taxonomy Checkbox */}
            <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-slate-100">
              <input
                type="checkbox"
                checked={includeTaxonomy}
                onChange={(e) => setIncludeTaxonomy(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">Hubungan Taksonomi</span>
                <span className="text-[9px] text-slate-400">Satu genus, famili, atau ordo filogeni</span>
              </div>
            </label>

            {/* Sympatric Grid Checkbox */}
            <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-slate-100">
              <input
                type="checkbox"
                checked={includeSympatry}
                onChange={(e) => setIncludeSympatry(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">Overlapping Spasial (Simpatrik)</span>
                <span className="text-[9px] text-slate-400">Co-occurrence dalam satu grid koordinat (~11km)</span>
              </div>
            </label>

            {/* Geographic Checkbox */}
            <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-slate-100">
              <input
                type="checkbox"
                checked={includeGeographic}
                onChange={(e) => setIncludeGeographic(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">Satu Lokasi Negara</span>
                <span className="text-[9px] text-slate-400">Ditemukan di wilayah negara yang sama</span>
              </div>
            </label>
          </div>

          <hr className="border-slate-100" />

          {/* Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Batas Kekuatan Hubungan (Threshold)
              </span>
              <span className="text-xs font-bold text-emerald-600 font-mono">
                &ge; {minLinkWeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={minLinkWeight}
              onChange={(e) => setMinLinkWeight(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[9px] text-slate-400 leading-normal mt-1">
              Geser ke kanan untuk menyembunyikan hubungan yang lemah dan menyisakan kekerabatan yang paling dominan saja.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="block text-[10px] text-slate-400 font-medium">Total Spesies</span>
              <span className="text-sm font-bold text-slate-700 font-mono">{rawStats.totalSpecies}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium">Relasi Potensial</span>
              <span className="text-sm font-bold text-slate-700 font-mono">{rawStats.potentialLinksCount}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium">Relasi Aktif</span>
              <span className="text-sm font-bold text-emerald-600 font-mono">{rawStats.activeLinksCount}</span>
            </div>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Legenda Simbol & Warna Relasi
          </span>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 flex items-center justify-center rounded bg-pink-50 text-xs border border-pink-200">🐾</span>
              <span className="font-semibold text-slate-700">Animalia (Hewan)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 flex items-center justify-center rounded bg-emerald-50 text-xs border border-emerald-200">🌱</span>
              <span className="font-semibold text-slate-700">Plantae (Tumbuhan)</span>
            </div>
            <hr className="border-slate-50 my-1" />
            <div className="flex items-center gap-2 text-[11px]">
              <div className="w-6 h-0.5 bg-emerald-500 rounded"></div>
              <span className="text-slate-500"><strong className="text-slate-700 font-bold">Relasi Hijau</strong>: Dominan spasial (simpatrik hidup bersama)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="w-6 h-0.5 bg-purple-500 rounded"></div>
              <span className="text-slate-500"><strong className="text-slate-700 font-bold">Relasi Ungu</strong>: Dominan taksonomi (satu genus/famili)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="w-6 h-0.5 bg-slate-300 rounded"></div>
              <span className="text-slate-500"><strong className="text-slate-700 font-bold">Relasi Abu</strong>: Gabungan ko-occurrence regional</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Network Graph Area */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        
        {/* Main Canvas Card */}
        <div ref={containerRef} className="relative w-full h-[520px] bg-slate-50 border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between">
          
          {/* Canvas Floating Top bar */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
            <div className="px-3.5 py-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2 pointer-events-auto">
              <Network className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">Visualisasi Peta Jejaring Hubungan Spesies</span>
            </div>

            {/* Controls panel */}
            <div className="flex gap-1.5 pointer-events-auto">
              <button
                id="btn-zoom-in"
                title="Perbesar"
                className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                id="btn-zoom-out"
                title="Perkecil"
                className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                id="btn-zoom-reset"
                title="Pusatkan Ulang"
                className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* D3 SVG Rendering Stage */}
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ cursor: "grab" }}
          ></svg>

          {/* Hover / Hint Overlay on the bottom */}
          <div className="absolute bottom-4 left-4 z-10 p-3.5 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-sm max-w-xs pointer-events-none">
            {hoveredNode ? (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Arahkan Kursor</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 font-sans leading-tight">
                  {getKingdomEmoji(hoveredNode.kingdom)} {hoveredNode.scientificName}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Famili: {hoveredNode.family || "Tidak diketahui"}<br />
                  Record Count: <strong className="text-slate-700 font-bold">{hoveredNode.recordCount} rekor</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-500 leading-normal">
                  Peta ini interaktif. Anda dapat menggeser (drag) spesies, melakukan zoom (scroll), dan mengeklik lingkaran node spesies untuk menampilkan statistik detail.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Detail Panel of Selected Node (Below the graph) */}
        {selectedNode && (
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 animate-fadeIn">
            
            {/* Specimen Profile card */}
            <div className="flex-1 border-r border-slate-100 pr-0 md:pr-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{getKingdomEmoji(selectedNode.kingdom)}</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informasi Node Terpilih</h4>
                  <h3 className="text-base font-bold text-slate-800 font-sans italic leading-tight mt-0.5">
                    {selectedNode.scientificName}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-400 block">Kingdom</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{selectedNode.kingdom || "-"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-400 block">Class / Kelas</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{selectedNode.class || "-"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-400 block">Family / Famili</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{selectedNode.family || "-"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-400 block">Genus / Marga</span>
                  <span className="font-bold text-slate-700 mt-0.5 block italic">{selectedNode.genus || "-"}</span>
                </div>
              </div>

              <div className="mt-4 text-xs flex flex-col gap-1.5 text-slate-600">
                <div>
                  📍 <strong className="text-slate-800 font-bold">Sebaran Geografis:</strong> {selectedNode.countries.size > 0 ? Array.from(selectedNode.countries).slice(0, 5).join(", ") : "Tidak diketahui"}
                  {selectedNode.countries.size > 5 && ` (+${selectedNode.countries.size - 5} negara lain)`}
                </div>
                <div>
                  📅 <strong className="text-slate-800 font-bold">Koleksi/Observasi Tahun:</strong> {selectedNode.years.size > 0 ? `${Math.min(...(Array.from(selectedNode.years) as number[]))} - ${Math.max(...(Array.from(selectedNode.years) as number[]))}` : "Tidak ada data tahun"}
                </div>
                <div>
                  📊 <strong className="text-slate-800 font-bold">Jumlah Sampel Record:</strong> {selectedNode.recordCount} kejadian terekam.
                </div>
              </div>
            </div>

            {/* Direct Connections detail inside active dataset */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Hubungan Terdekat dengan Spesies Lain
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 font-mono">
                  {selectedNodeConnections.length} Koneksi Aktif
                </span>
              </div>

              {selectedNodeConnections.length === 0 ? (
                <div className="flex-1 p-5 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-xs font-semibold text-slate-500">Node Terisolasi</span>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">
                    Spesies ini tidak memiliki relasi dekat dengan spesies lain di dataset pada batas threshold aktif.
                  </p>
                </div>
              ) : (
                <div className="flex-1 max-h-[220px] overflow-y-auto pr-1 flex flex-col gap-2">
                  {selectedNodeConnections.map((conn, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex items-center justify-between gap-3 transition-all cursor-pointer"
                      onClick={() => {
                        if (conn.node) setSelectedNode(conn.node);
                      }}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-700 truncate italic">
                          {getKingdomEmoji(conn.node?.kingdom)} {conn.node?.scientificName}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {conn.types.map((type, tIdx) => (
                            <span
                              key={tIdx}
                              className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                type.includes("Simpatrik")
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-purple-100 text-purple-800 border border-purple-200"
                              }`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block text-[10px] font-bold text-emerald-600 font-mono">
                          W = {conn.weight.toFixed(2)}
                        </span>
                        <span className="block text-[9px] text-slate-400">
                          {conn.node?.recordCount} rekor
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
      
    </div>
  );
}
