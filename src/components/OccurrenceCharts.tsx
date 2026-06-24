/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { GBIFOccurrence, BASIS_OF_RECORD_LABELS } from "../types";
import { exportElementAsPNG, exportElementAsPDF } from "../utils/reportExporter";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { 
  Download, 
  Image, 
  FileText, 
  Calendar, 
  TrendingUp, 
  GitBranch, 
  Database,
  BarChart4
} from "lucide-react";

interface OccurrenceChartsProps {
  occurrences: GBIFOccurrence[];
}

export default function OccurrenceCharts({ occurrences }: OccurrenceChartsProps) {
  const [taxonomyLevel, setTaxonomyLevel] = useState<"genus" | "family" | "class">("genus");

  // Basis of Record colors matching the MapComponent for design harmony
  const BASIS_COLORS: Record<string, string> = {
    HUMAN_OBSERVATION: "#10b981", // Emerald green
    PRESERVED_SPECIMEN: "#3b82f6", // Blue
    MATERIAL_SAMPLE: "#8b5cf6", // Purple
    MACHINE_OBSERVATION: "#06b6d4", // Cyan
    FOSSIL_SPECIMEN: "#f97316", // Orange
    LIVING_SPECIMEN: "#ec4899", // Pink
    UNKNOWN: "#64748b", // Slate gray
  };

  // 1. DATA AGGREGATION: Temporal Trend (Year to Year)
  const temporalData = useMemo(() => {
    const yearCounts: Record<number, number> = {};
    occurrences.forEach((occ) => {
      if (occ.year && occ.year >= 1700 && occ.year <= 2026) {
        yearCounts[occ.year] = (yearCounts[occ.year] || 0) + 1;
      }
    });

    const sortedYears = Object.keys(yearCounts)
      .map(Number)
      .sort((a, b) => a - b);

    // If years are spread apart, fill in the blanks optionally, or just show recorded points
    return sortedYears.map((year) => ({
      tahun: year,
      jumlah: yearCounts[year],
    }));
  }, [occurrences]);

  // 2. DATA AGGREGATION: Taxonomic Diversity (Top 8 Genera, Families, or Classes)
  const taxonomicData = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((occ) => {
      const val = occ[taxonomyLevel];
      if (val && val.trim() !== "") {
        counts[val] = (counts[val] || 0) + 1;
      } else {
        counts["Tidak Teridentifikasi"] = (counts["Tidak Teridentifikasi"] || 0) + 1;
      }
    });

    const sortedData = Object.entries(counts)
      .map(([name, count]) => ({ name, jumlah: count }))
      .sort((a, b) => b.jumlah - a.jumlah);

    // Take top 8 and sum the rest as "Lainnya"
    if (sortedData.length > 8) {
      const top8 = sortedData.slice(0, 8);
      const othersCount = sortedData.slice(8).reduce((acc, curr) => acc + curr.jumlah, 0);
      return [...top8, { name: "Lainnya", jumlah: othersCount }];
    }

    return sortedData;
  }, [occurrences, taxonomyLevel]);

  // 3. DATA AGGREGATION: Monthly Seasonality (Jan - Dec)
  const seasonalData = useMemo(() => {
    const monthNamesIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const monthCounts = Array(12).fill(0);
    occurrences.forEach((occ) => {
      if (occ.month && occ.month >= 1 && occ.month <= 12) {
        monthCounts[occ.month - 1] += 1;
      }
    });

    return monthNamesIndo.map((name, index) => ({
      bulan: name,
      singkatan: name.substring(0, 3),
      jumlah: monthCounts[index],
    }));
  }, [occurrences]);

  // 4. DATA AGGREGATION: Basis of Record
  const basisData = useMemo(() => {
    const counts: Record<string, number> = {};
    occurrences.forEach((occ) => {
      const basis = occ.basisOfRecord || "UNKNOWN";
      counts[basis] = (counts[basis] || 0) + 1;
    });

    return Object.entries(counts).map(([key, value]) => {
      const label = BASIS_OF_RECORD_LABELS[key] || key;
      const color = BASIS_COLORS[key] || "#64748b";
      return {
        name: label,
        rawKey: key,
        value,
        color,
      };
    });
  }, [occurrences]);

  // Handle single chart export triggers
  const handleExportPNG = (elementId: string, chartName: string) => {
    const normalizedName = chartName.toLowerCase().replace(/\s+/g, "_");
    exportElementAsPNG(elementId, `Grafik_GBIF_${normalizedName}`);
  };

  const handleExportPDF = (elementId: string, chartName: string) => {
    const normalizedName = chartName.toLowerCase().replace(/\s+/g, "_");
    exportElementAsPDF(elementId, `Grafik_GBIF_${normalizedName}`);
  };

  const hasTemporalData = temporalData.length > 0;
  const hasTaxonomicData = taxonomicData.length > 0 && taxonomicData.some(d => d.jumlah > 0);
  const hasSeasonalData = seasonalData.some(d => d.jumlah > 0);
  const hasBasisData = basisData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CARD 1: TEMPORAL TREND */}
      <div
        id="chart-card-temporal"
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col min-h-[350px]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-display">
                Tren Temporal Spesies
              </h3>
              <p className="text-[10px] text-slate-400">
                Penyebaran jumlah observasi berdasarkan tahun
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportPNG("chart-card-temporal", "Tren_Temporal")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PNG"
            >
              <Image className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
            <button
              onClick={() => handleExportPDF("chart-card-temporal", "Tren_Temporal")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {hasTemporalData ? (
          <div className="w-full flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={temporalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorJumlah" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="tahun"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "11px",
                    fontFamily: "Inter, sans-serif",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  }}
                  labelFormatter={(value) => `Tahun: ${value}`}
                />
                <Area
                  type="monotone"
                  dataKey="jumlah"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorJumlah)"
                  name="Rekor Kejadian"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            Tidak ada data temporal untuk dirender.
          </div>
        )}
      </div>

      {/* CARD 2: TAXONOMIC COMPOSITION */}
      <div
        id="chart-card-taxonomic"
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col min-h-[350px]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-display">
                Komposisi Keragaman Taksonomi
              </h3>
              <p className="text-[10px] text-slate-400">
                Diversitas taksonomi berdasarkan tingkatan filogenik
              </p>
            </div>
          </div>

          {/* Level Switcher & Actions */}
          <div className="flex items-center gap-2">
            <select
              value={taxonomyLevel}
              onChange={(e) => setTaxonomyLevel(e.target.value as any)}
              className="px-2 py-1 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700"
            >
              <option value="genus">Genus</option>
              <option value="family">Famili</option>
              <option value="class">Kelas</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExportPNG("chart-card-taxonomic", "Komposisi_Taksonomi")}
                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
                title="Unduh PNG"
              >
                <Image className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
              <button
                onClick={() => handleExportPDF("chart-card-taxonomic", "Komposisi_Taksonomi")}
                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
                title="Unduh PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {hasTaxonomicData ? (
          <div className="w-full flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={taxonomicData} margin={{ top: 10, right: 10, left: -20, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "11px",
                  }}
                />
                <Bar dataKey="jumlah" fill="#059669" radius={[4, 4, 0, 0]} name="Banyak Rekor">
                  {taxonomicData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === "Lainnya" ? "#94a3b8" : index % 2 === 0 ? "#059669" : "#10b981"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            Tidak ada data klasifikasi taksonomi untuk divisualisasikan.
          </div>
        )}
      </div>

      {/* CARD 3: MONTHLY SEASONALITY */}
      <div
        id="chart-card-seasonal"
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col min-h-[350px]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-display">
                Seasonality (Siklus Musiman)
              </h3>
              <p className="text-[10px] text-slate-400">
                Pola aktivitas penemuan makhluk hidup per bulan
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportPNG("chart-card-seasonal", "Siklus_Musiman")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PNG"
            >
              <Image className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
            <button
              onClick={() => handleExportPDF("chart-card-seasonal", "Siklus_Musiman")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {hasSeasonalData ? (
          <div className="w-full flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={seasonalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="singkatan"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "11px",
                  }}
                  labelFormatter={(value, items) => {
                    const matched = seasonalData.find(d => d.singkatan === value);
                    return matched ? `Bulan: ${matched.bulan}` : value;
                  }}
                />
                <Bar dataKey="jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Observasi/Spesimen">
                  {seasonalData.map((entry, index) => {
                    // Use a teal/indigo theme for seasons
                    const colors = [
                      "#6366f1", "#4f46e5", "#3b82f6", "#06b6d4",
                      "#10b981", "#059669", "#f59e0b", "#d97706",
                      "#ea580c", "#ec4899", "#8b5cf6", "#a855f7"
                    ];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            Bulan penemuan tidak diisi pada data yang ditarik.
          </div>
        )}
      </div>

      {/* CARD 4: BASIS OF RECORD METHODOLOGY */}
      <div
        id="chart-card-basis"
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col min-h-[350px]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-display">
                Basis Data Penelitian (Basis of Record)
              </h3>
              <p className="text-[10px] text-slate-400">
                Proporsi metodologi perolehan data biodiversitas
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportPNG("chart-card-basis", "Basis_Pencatatan")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PNG"
            >
              <Image className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
            <button
              onClick={() => handleExportPDF("chart-card-basis", "Basis_Pencatatan")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-100"
              title="Unduh PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {hasBasisData ? (
          <div className="w-full flex-1 flex flex-col md:flex-row items-center justify-center min-h-[220px] gap-4">
            {/* Pie Chart container */}
            <div className="w-full md:w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={basisData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {basisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "11px",
                    }}
                    formatter={(value) => [`${value} Rekor`, "Metode"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend to look extremely clean and fit within card */}
            <div className="w-full md:w-1/2 flex flex-col gap-1.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Distribusi Persentase:
              </h4>
              <div className="grid grid-cols-1 gap-1 max-h-[140px] overflow-y-auto">
                {basisData.map((item) => {
                  const percent = ((item.value / occurrences.length) * 100).toFixed(1);
                  return (
                    <div key={item.name} className="flex items-center justify-between text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate" title={item.name}>{item.name}</span>
                      </div>
                      <div className="font-mono text-slate-500 text-[10px] shrink-0 font-medium">
                        {item.value} ({percent}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            Metode basis pencatatan tidak tersedia.
          </div>
        )}
      </div>
    </div>
  );
}
