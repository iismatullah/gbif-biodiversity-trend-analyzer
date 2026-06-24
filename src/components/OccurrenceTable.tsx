/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { GBIFOccurrence, BASIS_OF_RECORD_LABELS, COUNTRY_CODES } from "../types";
import { 
  Table, 
  MapPin, 
  ExternalLink, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface OccurrenceTableProps {
  occurrences: GBIFOccurrence[];
  selectedOccurrence: GBIFOccurrence | null;
  onSelectOccurrence: (occurrence: GBIFOccurrence) => void;
  onTabChange: (tab: string) => void; // helper to switch tabs to map view when clicking locate
}

export default function OccurrenceTable({
  occurrences,
  selectedOccurrence,
  onSelectOccurrence,
  onTabChange,
}: OccurrenceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter rows based on search input
  const filteredOccurrences = useMemo(() => {
    if (!searchTerm.trim()) return occurrences;
    const term = searchTerm.toLowerCase();
    return occurrences.filter((occ) => {
      const name = (occ.scientificName || "").toLowerCase();
      const kingdom = (occ.kingdom || "").toLowerCase();
      const family = (occ.family || "").toLowerCase();
      const locality = (occ.locality || "").toLowerCase();
      const recordedBy = (occ.recordedBy || "").toLowerCase();
      const country = (occ.country || "").toLowerCase();
      
      return (
        name.includes(term) ||
        kingdom.includes(term) ||
        family.includes(term) ||
        locality.includes(term) ||
        recordedBy.includes(term) ||
        country.includes(term)
      );
    });
  }, [occurrences, searchTerm]);

  // Handle pagination calculation
  const totalPages = Math.ceil(filteredOccurrences.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOccurrences.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOccurrences, currentPage]);

  // Reset page to 1 when search term changes
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  // Convert occurrences to CSV file and trigger download
  const handleDownloadCSV = () => {
    if (occurrences.length === 0) return;

    // Header columns
    const headers = [
      "GBIF Key",
      "Nama Ilmiah",
      "Kerajaan (Kingdom)",
      "Filum (Phylum)",
      "Kelas (Class)",
      "Ordo (Order)",
      "Famili (Family)",
      "Genus (Genus)",
      "Basis Data (Basis of Record)",
      "Negara",
      "Kode Negara",
      "Tahun",
      "Bulan",
      "Hari",
      "Latitude",
      "Longitude",
      "Kolektor (Recorded By)",
      "Lokasi Detil (Locality)",
      "Tanggal Kejadian"
    ];

    // Build rows
    const csvRows = [
      headers.join(","), // header row
      ...occurrences.map((occ) => {
        const values = [
          occ.key,
          `"${(occ.scientificName || "").replace(/"/g, '""')}"`,
          `"${occ.kingdom || ""}"`,
          `"${occ.phylum || ""}"`,
          `"${occ.class || ""}"`,
          `"${occ.order || ""}"`,
          `"${occ.family || ""}"`,
          `"${occ.genus || ""}"`,
          `"${occ.basisOfRecord || ""}"`,
          `"${occ.country || ""}"`,
          `"${occ.countryCode || ""}"`,
          occ.year || "",
          occ.month || "",
          occ.day || "",
          occ.decimalLatitude || "",
          occ.decimalLongitude || "",
          `"${(occ.recordedBy || "").replace(/"/g, '""')}"`,
          `"${(occ.locality || "").replace(/"/g, '""')}"`,
          `"${occ.eventDate || ""}"`
        ];
        return values.join(",");
      })
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_GBIF_Biodiversitas_${occurrences[0].scientificName.replace(/\s+/g, "_") || "Raw"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLocateOnMap = (occ: GBIFOccurrence) => {
    onSelectOccurrence(occ);
    onTabChange("spasial"); // switch visual tab
  };

  return (
    <div id="occurrence-table-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header Controls */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800 font-display">
            Data Mentah Hasil Pencarian GBIF
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 font-mono">
            {filteredOccurrences.length} Catatan
          </span>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Internal Grid Search */}
          <div className="relative flex-1 md:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari dalam tabel..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* CSV Download Trigger */}
          <button
            onClick={handleDownloadCSV}
            disabled={occurrences.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
              occurrences.length === 0
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm"
            }`}
            title="Download Spreadsheet CSV"
            id="btn-download-csv"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100 font-semibold">
            <tr>
              <th className="px-4 py-3 font-display">Nama Ilmiah</th>
              <th className="px-4 py-3 font-display">Kategori / Klasifikasi</th>
              <th className="px-4 py-3 font-display">Basis Rekor</th>
              <th className="px-4 py-3 font-display">Tahun</th>
              <th className="px-4 py-3 font-display">Negara</th>
              <th className="px-4 py-3 font-display">Kolektor / Institusi</th>
              <th className="px-4 py-3 text-right font-display">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedData.length > 0 ? (
              paginatedData.map((occ) => {
                const isSelected = selectedOccurrence?.key === occ.key;
                const hasCoord = occ.decimalLatitude !== undefined && occ.decimalLongitude !== undefined;
                const basisLabel = BASIS_OF_RECORD_LABELS[occ.basisOfRecord] || occ.basisOfRecord;
                
                return (
                  <tr
                    key={occ.key}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isSelected ? "bg-emerald-50/40 font-medium" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="italic">{occ.scientificName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {occ.key}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 font-semibold">{occ.family || "-"}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{occ.kingdom} &bull; {occ.class || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {basisLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{occ.year || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {occ.country || COUNTRY_CODES[occ.countryCode || ""] || occ.countryCode || "-"}
                    </td>
                    <td className="px-4 py-3 max-w-[150px] truncate" title={occ.recordedBy || occ.institutionCode}>
                      <div className="truncate">{occ.recordedBy || "-"}</div>
                      <div className="text-[10px] text-slate-400 truncate">{occ.institutionCode || ""} {occ.collectionCode ? `(${occ.collectionCode})` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasCoord ? (
                          <button
                            onClick={() => handleLocateOnMap(occ)}
                            className="p-1.5 hover:bg-emerald-100 hover:text-emerald-800 text-emerald-600 rounded-lg transition-all"
                            title="Tandai lokasi di peta"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-1.5 text-slate-300 cursor-not-allowed"
                            title="Tidak ada koordinat GPS"
                          >
                            <MapPin className="w-3.5 h-3.5 stroke-dashed" />
                          </button>
                        )}
                        <a
                          href={`https://www.gbif.org/occurrence/${occ.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-blue-100 hover:text-blue-800 text-blue-600 rounded-lg transition-all"
                          title="Buka rincian lengkap di GBIF"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada data ditemukan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Silakan sesuaikan filter pencarian atau kata kunci pencarian Anda.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Menampilkan halaman <strong className="text-slate-700">{currentPage}</strong> dari <strong className="text-slate-700">{totalPages}</strong>
          </span>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1 border rounded-lg transition-colors ${
                currentPage === 1
                  ? "border-slate-100 bg-white text-slate-300 cursor-not-allowed"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1 border rounded-lg transition-colors ${
                currentPage === totalPages
                  ? "border-slate-100 bg-white text-slate-300 cursor-not-allowed"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
