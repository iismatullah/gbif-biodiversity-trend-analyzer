/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { GBIFFilters, GBIFOccurrence, COUNTRY_CODES } from "./types";
import { exportComprehensivePDF } from "./utils/reportExporter";
import FilterSidebar from "./components/FilterSidebar";
import MapComponent from "./components/MapComponent";
import OccurrenceCharts from "./components/OccurrenceCharts";
import OccurrenceTable from "./components/OccurrenceTable";
import SpeciesNetwork from "./components/SpeciesNetwork";
import { SAMPLE_HARIMAU_SUMATRA } from "./utils/sampleDatasets";
import { 
  Globe2, 
  MapPin, 
  Calendar, 
  Award, 
  Compass, 
  BarChart4, 
  FileDown, 
  Database,
  Grid,
  TrendingUp,
  GitBranch,
  TableProperties,
  Network,
  Info,
  ExternalLink,
  ShieldAlert,
  Loader2,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  SlidersHorizontal
} from "lucide-react";

export default function App() {
  // 1. STATE INITIALIZATION: Filters configured for fast client-side query
  const [filters, setFilters] = useState<GBIFFilters>({
    scientificName: "", // Empty means all species
    taxonKey: undefined,
    kingdom: "ALL",
    phylum: "",
    class: "",
    order: "",
    family: "",
    genus: "",
    yearStart: 1980,
    yearEnd: 2026,
    basisOfRecord: ["HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "MACHINE_OBSERVATION", "MATERIAL_SAMPLE", "LIVING_SPECIMEN"],
    country: "ALL",
    limit: 1000, // Client side can handle larger lists easily
    hasCoordinate: true, // Default to true so map loads with coordinates immediately
  });

  // Start pre-loaded with Sumatra Tiger sample data so the dashboard is beautifully populated on start
  const [occurrences, setOccurrences] = useState<GBIFOccurrence[]>(SAMPLE_HARIMAU_SUMATRA);
  const [datasetName, setDatasetName] = useState<string>("Harimau Sumatra (Data Contoh)");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("spasial");
  const [selectedOccurrence, setSelectedOccurrence] = useState<GBIFOccurrence | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 2. CLIENT-SIDE FILTER ENGINE (Biblioshiny Style)
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      // Filter by Scientific Name / Search Query
      if (filters.scientificName && filters.scientificName.trim() !== "") {
        const query = filters.scientificName.toLowerCase().trim();
        const scName = (occ.scientificName || "").toLowerCase();
        const genus = (occ.genus || "").toLowerCase();
        const family = (occ.family || "").toLowerCase();
        if (!scName.includes(query) && !genus.includes(query) && !family.includes(query)) {
          return false;
        }
      }

      // Filter by Kingdom
      if (filters.kingdom && filters.kingdom !== "ALL") {
        if ((occ.kingdom || "").toUpperCase() !== filters.kingdom.toUpperCase()) {
          return false;
        }
      }

      // Filter by Taxonomy hierarchy
      if (filters.phylum && !(occ.phylum || "").toLowerCase().includes(filters.phylum.toLowerCase())) return false;
      if (filters.class && !(occ.class || "").toLowerCase().includes(filters.class.toLowerCase())) return false;
      if (filters.order && !(occ.order || "").toLowerCase().includes(filters.order.toLowerCase())) return false;
      if (filters.family && !(occ.family || "").toLowerCase().includes(filters.family.toLowerCase())) return false;
      if (filters.genus && !(occ.genus || "").toLowerCase().includes(filters.genus.toLowerCase())) return false;

      // Filter by Year range
      if (occ.year) {
        if (occ.year < filters.yearStart || occ.year > filters.yearEnd) return false;
      }

      // Filter by Country
      if (filters.country && filters.country !== "ALL") {
        const matchCode = (occ.countryCode || "").toUpperCase() === filters.country.toUpperCase();
        const matchName = (occ.country || "").toLowerCase() === (COUNTRY_CODES[filters.country] || "").toLowerCase();
        if (!matchCode && !matchName) return false;
      }

      // Filter by Coordinates
      if (filters.hasCoordinate) {
        if (occ.decimalLatitude === undefined || occ.decimalLongitude === undefined || isNaN(occ.decimalLatitude) || isNaN(occ.decimalLongitude)) {
          return false;
        }
      }

      // Filter by Basis of Record
      if (filters.basisOfRecord && filters.basisOfRecord.length > 0) {
        if (!filters.basisOfRecord.includes(occ.basisOfRecord)) return false;
      }

      return true;
    });
  }, [occurrences, filters]);

  // Callback when a new dataset is loaded (via CSV upload or sample selection)
  const handleLoadDataset = useCallback((newOccurrences: GBIFOccurrence[], name: string) => {
    setLoading(true);
    setError(null);
    setSelectedOccurrence(null);

    try {
      if (newOccurrences.length === 0) {
        setError("Berkas kosong atau tidak ada data kejadian valid yang ditemukan.");
        return;
      }
      setOccurrences(newOccurrences);
      setDatasetName(name);

      // Reset filters so the newly loaded dataset is fully visible immediately
      setFilters({
        scientificName: "",
        kingdom: "ALL",
        phylum: "",
        class: "",
        order: "",
        family: "",
        genus: "",
        yearStart: 1700, // wider range for historical uploaded datasets
        yearEnd: 2026,
        basisOfRecord: ["HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "MACHINE_OBSERVATION", "MATERIAL_SAMPLE", "LIVING_SPECIMEN"],
        country: "ALL",
        limit: 1000,
        hasCoordinate: false, // Turn off coordinate requirement initially so all records display in table/charts
      });
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat dataset: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. STATISTICAL CALCULATIONS: Derived live from FILTERED occurrences
  const stats = useMemo(() => {
    if (filteredOccurrences.length === 0) {
      return {
        totalRecords: 0,
        yearSpan: "-",
        coordinateCount: 0,
        topCountry: "-",
        topGenus: "-",
        qualityScore: 0,
      };
    }

    // Temporal Span
    const years = filteredOccurrences.map((o) => o.year).filter(Boolean) as number[];
    const minYear = years.length > 0 ? Math.min(...years) : filters.yearStart;
    const maxYear = years.length > 0 ? Math.max(...years) : filters.yearEnd;
    const yearSpan = minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`;

    // Geospatial occurrences count
    const coordinateCount = filteredOccurrences.filter(
      (o) =>
        o.decimalLatitude !== undefined &&
        o.decimalLongitude !== undefined &&
        !isNaN(o.decimalLatitude) &&
        !isNaN(o.decimalLongitude)
    ).length;

    // Top Country
    const countriesCount: Record<string, number> = {};
    filteredOccurrences.forEach((o) => {
      const code = o.countryCode || o.country || "";
      if (code) countriesCount[code] = (countriesCount[code] || 0) + 1;
    });
    let topCountryCode = "-";
    let maxCountryVal = 0;
    Object.entries(countriesCount).forEach(([code, count]) => {
      if (count > maxCountryVal) {
        maxCountryVal = count;
        topCountryCode = code;
      }
    });
    const topCountry = COUNTRY_CODES[topCountryCode] || topCountryCode;

    // Top Genus
    const genusCount: Record<string, number> = {};
    filteredOccurrences.forEach((o) => {
      if (o.genus) genusCount[o.genus] = (genusCount[o.genus] || 0) + 1;
    });
    let topGenus = "-";
    let maxGenusVal = 0;
    Object.entries(genusCount).forEach(([g, count]) => {
      if (count > maxGenusVal) {
        maxGenusVal = count;
        topGenus = g;
      }
    });

    // Data Quality Score (%)
    let completePoints = 0;
    filteredOccurrences.forEach((o) => {
      if (o.decimalLatitude !== undefined && o.decimalLongitude !== undefined) completePoints += 1;
      if (o.recordedBy && o.recordedBy.trim() !== "") completePoints += 1;
      if (o.month) completePoints += 1;
      if (o.license && o.license.trim() !== "") completePoints += 1;
      if (o.family && o.family.trim() !== "") completePoints += 1;
    });
    const totalPossiblePoints = filteredOccurrences.length * 5;
    const qualityScore =
      totalPossiblePoints > 0
        ? Math.round((completePoints / totalPossiblePoints) * 100)
        : 0;

    return {
      totalRecords: filteredOccurrences.length,
      yearSpan,
      coordinateCount,
      topCountry,
      topGenus,
      qualityScore,
    };
  }, [filteredOccurrences, filters]);

  // Global Report Downloader
  const handleDownloadFullReport = async () => {
    setIsExportingPDF(true);
    try {
      await exportComprehensivePDF(filters, stats);
    } finally {
      setIsExportingPDF(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      
      {/* HEADER BAR */}
      <header className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 text-white shadow-md border-b border-emerald-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/20 shadow-inner">
              <Globe2 className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight flex items-center gap-2">
                GBIF Biodiversity Trend Analyzer
                <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal uppercase">
                  v2.0 Biblioshiny
                </span>
              </h1>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Portal Pemetaan & Analisis Bibliometrik Temporal-Spasial Distribusi Spesies Mandiri
              </p>
            </div>
          </div>

          {/* Header Action: PDF Report Downloader */}
          <div className="shrink-0 flex items-center">
            <button
              onClick={handleDownloadFullReport}
              disabled={filteredOccurrences.length === 0 || isExportingPDF}
              className={`w-full md:w-auto px-5 py-3 rounded-xl font-bold text-xs tracking-wider uppercase font-display shadow-lg transition-all duration-300 flex items-center justify-center gap-2 border ${
                filteredOccurrences.length === 0 || isExportingPDF
                  ? "bg-emerald-950/40 text-emerald-600/60 border-emerald-950/20 cursor-not-allowed shadow-none"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400/50 shadow-emerald-500/20 active:scale-[0.97]"
              }`}
              id="btn-download-full-report"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  Mengompilasi PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 stroke-[2.5] text-slate-950" />
                  Cetak Laporan PDF Lengkap
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* METRICS OVERVIEW BOARD */}
      <section className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Metric Card 1 */}
            <div className="p-4 bg-emerald-50/45 rounded-2xl border border-emerald-100/50 flex items-start gap-3 transition-all hover:bg-emerald-50/70">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Rekor Temuan
                </span>
                <span className="text-xl font-bold font-display text-slate-800 tracking-tight block mt-0.5">
                  {loading ? (
                    <span className="inline-block w-12 h-5 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    occurrences.length.toLocaleString("id-ID")
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Batas rekor: {filters.limit}
                </span>
              </div>
            </div>

            {/* Metric Card 2 */}
            <div className="p-4 bg-teal-50/45 rounded-2xl border border-teal-100/50 flex items-start gap-3 transition-all hover:bg-teal-50/70">
              <div className="p-2.5 rounded-xl bg-teal-100 text-teal-800">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Rentang Temporal
                </span>
                <span className="text-xl font-bold font-display text-slate-800 tracking-tight block mt-0.5">
                  {loading ? (
                    <span className="inline-block w-16 h-5 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    stats.yearSpan
                  )}
                </span>
                <span className="text-[10px] text-slate-400">
                  Data rentang tahun
                </span>
              </div>
            </div>

            {/* Metric Card 3 */}
            <div className="p-4 bg-blue-50/45 rounded-2xl border border-blue-100/50 flex items-start gap-3 transition-all hover:bg-blue-50/70">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-800">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Akurasi Geospasial
                </span>
                <span className="text-xl font-bold font-display text-slate-800 tracking-tight block mt-0.5">
                  {loading ? (
                    <span className="inline-block w-14 h-5 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${stats.coordinateCount} Titik`
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {occurrences.length > 0
                    ? `${((stats.coordinateCount / occurrences.length) * 100).toFixed(0)}% berkoordinat`
                    : "0% berkoordinat"}
                </span>
              </div>
            </div>

            {/* Metric Card 4 */}
            <div className="p-4 bg-purple-50/45 rounded-2xl border border-purple-100/50 flex items-start gap-3 transition-all hover:bg-purple-50/70">
              <div className="p-2.5 rounded-xl bg-purple-100 text-purple-800">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kesiapan Riset (Quality)
                </span>
                <span className="text-xl font-bold font-display text-slate-800 tracking-tight block mt-0.5">
                  {loading ? (
                    <span className="inline-block w-12 h-5 bg-slate-200 animate-pulse rounded"></span>
                  ) : (
                    `${stats.qualityScore}%`
                  )}
                </span>
                <span className="text-[10px] text-slate-400">
                  Kelengkapan metadata
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* MAIN LAYOUT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col lg:flex-row gap-8">
        
        {/* SIDEBAR: CSV Upload, Presets & Client Filter Engine */}
        <section className="w-full lg:w-[320px] shrink-0 flex flex-col gap-5">
          <div className="bg-slate-800 text-white px-4 py-3.5 rounded-2xl flex items-center gap-2 shadow-sm">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider font-display">
              Upload & Filter Panel
            </h2>
          </div>
          <FilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            onLoadDataset={handleLoadDataset}
            activeDatasetName={datasetName}
            loading={loading}
            occurrences={occurrences}
          />
        </section>

        {/* WORKSPACE CONTENT: Maps, Charts & Tables */}
        <section className="flex-1 flex flex-col gap-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex gap-3 items-start shadow-sm animate-in fade-in duration-200">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Perhatian Terjadi Masalah</h4>
                <p className="mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* NAVIGATION TABS FOR SPECIFIC ANALYSIS */}
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setActiveTab("spasial")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "spasial"
                    ? "bg-slate-800 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="tab-btn-spasial"
              >
                <Globe2 className="w-4 h-4" />
                Spasial (Peta)
              </button>
              <button
                onClick={() => setActiveTab("temporal")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "temporal"
                    ? "bg-slate-800 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="tab-btn-temporal"
              >
                <TrendingUp className="w-4 h-4" />
                Temporal (Tren Tahun)
              </button>
              <button
                onClick={() => setActiveTab("taksonomi")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "taksonomi"
                    ? "bg-slate-800 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="tab-btn-taksonomi"
              >
                <GitBranch className="w-4 h-4" />
                Taksonomi & Metodologi
              </button>
              <button
                onClick={() => setActiveTab("data")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "data"
                    ? "bg-slate-800 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="tab-btn-data"
              >
                <TableProperties className="w-4 h-4" />
                Tabel Data Mentah
              </button>
              <button
                onClick={() => setActiveTab("jejaring")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "jejaring"
                    ? "bg-slate-800 text-white shadow-md shadow-slate-900/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="tab-btn-jejaring"
              >
                <Network className="w-4 h-4" />
                Jejaring & Hubungan
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1 px-3 text-[10px] text-slate-400 font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>Sistem Analisis Mandiri</span>
            </div>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 min-h-[500px]">
            {loading && filteredOccurrences.length === 0 ? (
              <div className="w-full h-[500px] bg-white border border-slate-200 rounded-3xl flex flex-col items-center justify-center p-6 text-center shadow-sm">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <h3 className="text-base font-semibold text-slate-700 font-display">Memproses Dataset</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Sedang memperbarui koordinat dan metadata spasiotemporal...
                </p>
              </div>
            ) : filteredOccurrences.length === 0 ? (
              <div className="w-full h-[500px] bg-white border border-slate-200 rounded-3xl flex flex-col items-center justify-center p-6 text-center shadow-sm">
                <Info className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-base font-semibold text-slate-700 font-display">Tidak Ada Data Sesuai Filter</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed">
                  Semua data tersaring keluar. Silakan bersihkan parameter pencarian atau sesuaikan rentang tahun di panel kiri untuk memunculkan kembali data.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Spasial (Peta Interaktif) - Selalu di-mount agar bisa di-capture oleh PDF exporter */}
                <div className={activeTab === "spasial" ? "flex flex-col gap-5 animate-in fade-in duration-200" : "absolute -left-[9999px] -top-[9999px] w-full pointer-events-none"}>
                  <MapComponent
                    occurrences={filteredOccurrences}
                    selectedOccurrence={selectedOccurrence}
                    onSelectOccurrence={setSelectedOccurrence}
                    activeTab={activeTab}
                  />
                  
                  {/* Map Context Info Box */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
                        <Info className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 font-display">
                          Cara Berinteraksi dengan Peta Spasial
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Arahkan kursor dan klik pada titik lingkaran untuk melihat detail spesimen/observasi. Peta mendukung clustering dan auto-fit batas daerah sebaran data Anda secara otomatis setelah terunggah.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("data")}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline shrink-0 flex items-center gap-1 self-end sm:self-center"
                    >
                      Lihat Tabel Detail &rarr;
                    </button>
                  </div>
                </div>

                {/* 2 & 3. Charts tabs - Selalu di-mount agar bisa di-capture oleh PDF exporter */}
                <div className={(activeTab === "temporal" || activeTab === "taksonomi") ? "flex flex-col gap-5 animate-in fade-in duration-200" : "absolute -left-[9999px] -top-[9999px] w-full pointer-events-none"}>
                  {/* Quick helper note about downloads */}
                  <div className="px-4 py-3 bg-emerald-50/40 rounded-xl border border-emerald-500/10 text-[11px] text-emerald-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                      Setiap grafik di bawah ini dilengkapi pengunduh mandiri beresolusi tinggi (PNG/PDF).
                    </span>
                  </div>

                  <OccurrenceCharts occurrences={filteredOccurrences} />
                </div>

                {/* 4. Tabel Data Mentah */}
                {activeTab === "data" && (
                  <OccurrenceTable
                    occurrences={filteredOccurrences}
                    selectedOccurrence={selectedOccurrence}
                    onSelectOccurrence={setSelectedOccurrence}
                    onTabChange={setActiveTab}
                  />
                )}

                {/* 5. Jejaring & Hubungan Spesies */}
                {activeTab === "jejaring" && (
                  <SpeciesNetwork occurrences={filteredOccurrences} />
                )}
              </>
            )}
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-500" />
            <span>GBIF Biodiversity Trend Analyzer &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://www.gbif.org" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              Situs Resmi GBIF
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>&bull;</span>
            <span className="text-slate-500">Dibuat untuk Kebutuhan Penelitian & Analisis Bibliometrik Temporal-Spasial</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
