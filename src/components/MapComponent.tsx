/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { GBIFOccurrence, BASIS_OF_RECORD_LABELS } from "../types";
import { Compass, Maximize2, MapPin, Layers, Image, FileText } from "lucide-react";
import { exportElementAsPNG, exportElementAsPDF } from "../utils/reportExporter";

interface MapComponentProps {
  occurrences: GBIFOccurrence[];
  selectedOccurrence: GBIFOccurrence | null;
  onSelectOccurrence: (occurrence: GBIFOccurrence) => void;
  activeTab?: string;
}

export default function MapComponent({
  occurrences,
  selectedOccurrence,
  onSelectOccurrence,
  activeTab,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [coordinateCount, setCoordinateCount] = useState(0);

  // Basis of Record color map
  const getMarkerColor = (basis: string): string => {
    switch (basis) {
      case "HUMAN_OBSERVATION":
        return "#10b981"; // Emerald green
      case "PRESERVED_SPECIMEN":
        return "#3b82f6"; // Blue
      case "MATERIAL_SAMPLE":
        return "#8b5cf6"; // Purple
      case "MACHINE_OBSERVATION":
        return "#06b6d4"; // Cyan
      case "FOSSIL_SPECIMEN":
        return "#f97316"; // Orange
      case "LIVING_SPECIMEN":
        return "#ec4899"; // Pink
      default:
        return "#64748b"; // Slate gray
    }
  };

  // Helper to create beautiful breathing animated SVG pin markers
  const createCustomMarkerIcon = (basis: string) => {
    const color = getMarkerColor(basis);
    return L.divIcon({
      html: `
        <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; display: inline-flex; width: 100%; height: 100%; border-radius: 9999px; background-color: ${color}; opacity: 0.25;" class="animate-pulse"></span>
          <span style="position: relative; display: inline-block; width: 11px; height: 11px; border-radius: 9999px; background-color: ${color}; border: 1.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></span>
        </div>
      `,
      className: "custom-gbif-marker",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -6],
    });
  };

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create the Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [-0.7893, 113.9213], // Center near Indonesia
      zoom: 5,
      zoomControl: false, // Custom position Zoom Control to look clean
    });

    // Add CartoDB Voyager tiles (very clean, beautiful off-white theme for data analysis)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
        crossOrigin: true,
      }
    ).addTo(map);

    // Custom Zoom control positioning
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initialize the LayerGroup for markers
    const markerGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markerGroupRef.current = markerGroup;
    setMapReady(true);

    // Trigger map resize check
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerGroupRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Sync Map Markers with occurrences
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Clear previous markers
    markerGroup.clearLayers();

    // Filter occurrences that have coordinates
    const mappableOccurrences = occurrences.filter(
      (occ) =>
        occ.decimalLatitude !== undefined &&
        occ.decimalLongitude !== undefined &&
        !isNaN(occ.decimalLatitude) &&
        !isNaN(occ.decimalLongitude)
    );

    setCoordinateCount(mappableOccurrences.length);

    mappableOccurrences.forEach((occ) => {
      const lat = occ.decimalLatitude!;
      const lng = occ.decimalLongitude!;
      const color = getMarkerColor(occ.basisOfRecord);
      const basisIndo = BASIS_OF_RECORD_LABELS[occ.basisOfRecord] || occ.basisOfRecord;

      const marker = L.marker([lat, lng], {
        icon: createCustomMarkerIcon(occ.basisOfRecord),
      });

      // Construct visually stunning tooltip/popup
      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; width: 240px; padding: 2px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 4px; font-style: italic;">
            ${occ.scientificName}
          </div>
          <div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; background-color: ${color}; margin-bottom: 8px;">
            ${basisIndo}
          </div>
          
          <table style="width: 100%; font-size: 11px; color: #475569; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3px 0; font-weight: 600;">Kerajaan:</td>
              <td style="padding: 3px 0; text-align: right;">${occ.kingdom || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3px 0; font-weight: 600;">Negara:</td>
              <td style="padding: 3px 0; text-align: right;">${occ.country || occ.countryCode || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3px 0; font-weight: 600;">Waktu:</td>
              <td style="padding: 3px 0; text-align: right;">${occ.year ? `${occ.year}${occ.month ? `-${occ.month}` : ""}` : "Tidak diketahui"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3px 0; font-weight: 600;">Kolektor:</td>
              <td style="padding: 3px 0; text-align: right; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${occ.recordedBy || "-"}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; font-weight: 600;">Lokasi:</td>
              <td style="padding: 3px 0; text-align: right; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${occ.locality || ""}">
                ${occ.locality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
              </td>
            </tr>
          </table>

          <div style="margin-top: 8px; text-align: right; font-size: 10px;">
            <a href="https://www.gbif.org/occurrence/${occ.key}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">
              Lihat di GBIF &rarr;
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectOccurrence(occ);
      });

      marker.addTo(markerGroup);
    });

    // Fit map bounds to encompass all markers smoothly using direct L.latLngBounds
    if (mappableOccurrences.length > 0) {
      try {
        const latLngs = mappableOccurrences.map(
          (occ) => L.latLng(occ.decimalLatitude!, occ.decimalLongitude!)
        );
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds.pad(0.15), {
          maxZoom: 12,
          animate: true,
          duration: 1.5,
        });
      } catch (err) {
        console.warn("Could not fit map bounds:", err);
      }
    }
  }, [occurrences, onSelectOccurrence]);

  // Sync Map Size on activeTab switch (e.g. from offscreen back to view)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, mapReady]);

  // Sync Fly To Selected Occurrence
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedOccurrence) return;

    const lat = selectedOccurrence.decimalLatitude;
    const lng = selectedOccurrence.decimalLongitude;

    let timeoutId: any = null;

    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 10, {
        animate: true,
        duration: 1.2,
      });

      // Find marker and open its popup if possible
      const markerGroup = markerGroupRef.current;
      if (markerGroup) {
        markerGroup.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            const pos = layer.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.00001 && Math.abs(pos.lng - lng) < 0.00001) {
              timeoutId = setTimeout(() => {
                // Ensure layer is still on the map and map hasn't been destroyed before opening popup
                if (layer && map.hasLayer(layer) && typeof layer.openPopup === "function") {
                  try {
                    layer.openPopup();
                  } catch (e) {
                    console.warn("Could not auto-open popup safely:", e);
                  }
                }
              }, 1200);
            }
          }
        });
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedOccurrence]);

  // Handle map container invalidateSize (manual reset button)
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map || occurrences.length === 0) return;

    const mappableOccurrences = occurrences.filter(
      (occ) =>
        occ.decimalLatitude !== undefined &&
        occ.decimalLongitude !== undefined &&
        !isNaN(occ.decimalLatitude) &&
        !isNaN(occ.decimalLongitude)
    );

    if (mappableOccurrences.length > 0) {
      try {
        const latLngs = mappableOccurrences.map(
          (occ) => L.latLng(occ.decimalLatitude!, occ.decimalLongitude!)
        );
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds.pad(0.15), {
          animate: true,
          duration: 1,
        });
      } catch (err) {
        console.warn("Could not reset map bounds:", err);
      }
    } else {
      map.setView([-0.7893, 113.9213], 5, { animate: true });
    }
  };

  const handleExportPNG = () => {
    exportElementAsPNG("peta-distribusi-container", "Peta_Distribusi_Sebaran");
  };

  const handleExportPDF = () => {
    exportElementAsPDF("peta-distribusi-container", "Peta_Distribusi_Sebaran");
  };

  return (
    <div id="peta-distribusi-container" className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col">
      {/* Legend & Controls overlay */}
      <div className="absolute top-4 left-4 z-20 max-w-xs md:max-w-md bg-white/95 backdrop-blur-md p-3.5 rounded-lg shadow-md border border-slate-100 font-sans">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-display">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          Legenda Basis Data
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white shadow-sm inline-block"></span>
            <span>Observasi Manusia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white shadow-sm inline-block"></span>
            <span>Spesimen Diawetkan</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] border border-white shadow-sm inline-block"></span>
            <span>Sampel Material</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] border border-white shadow-sm inline-block"></span>
            <span>Observasi Mesin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] border border-white shadow-sm inline-block"></span>
            <span>Fosil Spesimen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899] border border-white shadow-sm inline-block"></span>
            <span>Spesimen Hidup</span>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
          <span>Menampilkan <strong className="text-slate-700">{coordinateCount}</strong> dari <strong className="text-slate-700">{occurrences.length}</strong> titik</span>
        </div>
      </div>

      {/* Floating Map Utility Buttons */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg shadow-md border border-slate-100 transition-colors flex items-center justify-center"
          title="Fokuskan Semua Data"
          id="btn-reset-peta"
        >
          <Maximize2 className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={handleExportPNG}
          disabled={occurrences.length === 0}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg shadow-md border border-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Unduh Gambar PNG Peta"
          id="btn-export-map-png"
        >
          <Image className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={handleExportPDF}
          disabled={occurrences.length === 0}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg shadow-md border border-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Unduh PDF Peta"
          id="btn-export-map-pdf"
        >
          <FileText className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Leaflet container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" />

      {occurrences.length === 0 && (
        <div className="absolute inset-0 bg-white/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <Compass className="w-12 h-12 text-slate-300 animate-spin mb-3" style={{ animationDuration: "6s" }} />
          <h3 className="text-base font-semibold text-slate-700 font-display">Tidak Ada Data Distribusi</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Silakan masukkan pencarian spesies atau gunakan preset di sidebar untuk memetakan koordinat distribusi.
          </p>
        </div>
      )}
    </div>
  );
}
