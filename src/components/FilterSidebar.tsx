/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { GBIFFilters, GBIFOccurrence, BASIS_OF_RECORD_LABELS, COUNTRY_CODES } from "../types";
import { parseCSV, mapCSVToOccurrences } from "../utils/csvParser";
import { SAMPLE_OPTIONS } from "../utils/sampleDatasets";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  BookOpen, 
  Info, 
  Trash2, 
  SlidersHorizontal,
  Calendar, 
  Globe, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  X, 
  Loader2,
  Filter
} from "lucide-react";

interface FilterSidebarProps {
  filters: GBIFFilters;
  onFiltersChange: (newFilters: GBIFFilters) => void;
  onLoadDataset: (occurrences: GBIFOccurrence[], datasetName: string) => void;
  activeDatasetName: string;
  loading: boolean;
  occurrences: GBIFOccurrence[];
}

const PRESET_SPECIES_GROUPS = [
  {
    category: "🇮🇩 Indonesia (Endemik & Ikonik)",
    options: [
      { value: "Panthera tigris sumatrae", label: "🐯 Harimau Sumatra (Panthera tigris sumatrae)" },
      { value: "Pongo abelii", label: "🦧 Orangutan Sumatra (Pongo abelii)" },
      { value: "Varanus komodoensis", label: "🦎 Komodo (Varanus komodoensis)" },
      { value: "Rhinoceros sondaicus", label: "🦏 Badak Jawa (Rhinoceros sondaicus)" },
      { value: "Leucopsar rothschildi", label: "🐦 Jalak Bali (Leucopsar rothschildi)" },
      { value: "Bubalus depressicornis", label: "🐃 Anoa (Bubalus depressicornis)" },
      { value: "Macrocephalon maleo", label: "🐔 Burung Maleo (Macrocephalon maleo)" },
      { value: "Nisaetus bartelsi", label: "🦅 Elang Jawa (Nisaetus bartelsi)" },
      { value: "Nasalis larvatus", label: "🐒 Bekantan (Nasalis larvatus)" },
      { value: "Babyrousa", label: "🐗 Babirusa (Babyrousa)" },
      { value: "Manis javanica", label: "🪵 Trenggiling Sunda (Manis javanica)" },
      { value: "Nepenthes", label: "🌱 Kantong Semar (Nepenthes)" },
      { value: "Rafflesia arnoldii", label: "🌸 Rafflesia Arnoldii (Rafflesia arnoldii)" },
    ]
  },
  {
    category: "🌏 Asia & Asia Tenggara",
    options: [
      { value: "Panthera tigris", label: "🐯 Harimau (Panthera tigris)" },
      { value: "Elephas maximus", label: "🐘 Gajah Asia (Elephas maximus)" },
      { value: "Ailuropoda melanoleuca", label: "🐼 Panda Raksasa (Ailuropoda melanoleuca)" },
      { value: "Panthera uncia", label: "🐆 Macan Tutul Salju (Panthera uncia)" },
      { value: "Tapirus indicus", label: "🦓 Tapir Asia (Tapirus indicus)" },
      { value: "Tarsius", label: "🐒 Tarsius (Tarsius)" },
    ]
  },
  {
    category: "🐨 Australia & Oseania",
    options: [
      { value: "Macropus rufus", label: "🦘 Kangguru Merah (Macropus rufus)" },
      { value: "Phascolarctos cinereus", label: "🐨 Koala (Phascolarctos cinereus)" },
      { value: "Ornithorhynchus anatinus", label: "🦆 Platypus (Ornithorhynchus anatinus)" },
      { value: "Apteryx", label: "🐦 Burung Kiwi (Apteryx)" },
      { value: "Phalanger", label: "🐨 Kuskus (Phalanger)" },
    ]
  },
  {
    category: "🦅 Amerika Utara (AS, Kanada, dll)",
    options: [
      { value: "Ursus arctos horribilis", label: "🐻 Beruang Grizzly (Ursus arctos horribilis)" },
      { value: "Bison bison", label: "🦬 Bison Amerika (Bison bison)" },
      { value: "Haliaeetus leucocephalus", label: "🦅 Elang Botak (Haliaeetus leucocephalus)" },
      { value: "Vulpes vulpes", label: "🦊 Rubah Merah (Vulpes vulpes)" },
    ]
  },
  {
    category: "🐆 Amerika Selatan & Tengah (Brasil, Kosta Rika, dll)",
    options: [
      { value: "Panthera onca", label: "🐆 Jaguar (Panthera onca)" },
      { value: "Ara macao", label: "🦜 Macaw Merah (Ara macao)" },
      { value: "Agalychnis callidryas", label: "🐸 Katak Pohon Mata Merah (Agalychnis callidryas)" },
      { value: "Bradypus", label: "🦥 Sloth (Bradypus)" },
      { value: "Eunectes murinus", label: "🐍 Anaconda Hijau (Eunectes murinus)" },
    ]
  },
  {
    category: "🦁 Afrika & Madagaskar",
    options: [
      { value: "Panthera leo", label: "🦁 Singa Afrika (Panthera leo)" },
      { value: "Giraffa camelopardalis", label: "🦒 Jerapah (Giraffa camelopardalis)" },
      { value: "Loxodonta africana", label: "🐘 Gajah Semak Afrika (Loxodonta africana)" },
      { value: "Acinonyx jubatus", label: "🐆 Cheetah (Acinonyx jubatus)" },
      { value: "Lemur catta", label: "🐒 Lemur Ekor Cincin (Lemur catta)" },
    ]
  },
  {
    category: "🦌 Eropa & Asia Utara",
    options: [
      { value: "Canis lupus", label: "🐺 Serigala Abu-abu (Canis lupus)" },
      { value: "Cervus elaphus", label: "🦌 Rusa Merah (Cervus elaphus)" },
      { value: "Erinaceus europaeus", label: "🦔 Landak Eropa (Erinaceus europaeus)" },
    ]
  },
  {
    category: "🐋 Laut & Samudra (Global)",
    options: [
      { value: "Chelonia mydas", label: "🐢 Penyu Hijau (Chelonia mydas)" },
      { value: "Balaenoptera musculus", label: "🐋 Paus Biru (Balaenoptera musculus)" },
      { value: "Carcharodon carcharias", label: "🦈 Hiu Putih Besar (Carcharodon carcharias)" },
      { value: "Tursiops truncatus", label: "🐬 Lumba-lumba Hidung Botol (Tursiops truncatus)" },
    ]
  }
];

const SPECIES_AUTO_CONFIGS: Record<string, { country: string; kingdom: string }> = {
  "Panthera tigris sumatrae": { country: "ID", kingdom: "ANIMALIA" },
  "Pongo abelii": { country: "ID", kingdom: "ANIMALIA" },
  "Varanus komodoensis": { country: "ID", kingdom: "ANIMALIA" },
  "Rhinoceros sondaicus": { country: "ID", kingdom: "ANIMALIA" },
  "Leucopsar rothschildi": { country: "ID", kingdom: "ANIMALIA" },
  "Bubalus depressicornis": { country: "ID", kingdom: "ANIMALIA" },
  "Macrocephalon maleo": { country: "ID", kingdom: "ANIMALIA" },
  "Nisaetus bartelsi": { country: "ID", kingdom: "ANIMALIA" },
  "Nasalis larvatus": { country: "ID", kingdom: "ANIMALIA" },
  "Babyrousa": { country: "ID", kingdom: "ANIMALIA" },
  "Manis javanica": { country: "ID", kingdom: "ANIMALIA" },
  "Nepenthes": { country: "ID", kingdom: "PLANTAE" },
  "Rafflesia arnoldii": { country: "ID", kingdom: "PLANTAE" },
  
  "Elephas maximus": { country: "TH", kingdom: "ANIMALIA" },
  "Ailuropoda melanoleuca": { country: "CN", kingdom: "ANIMALIA" },
  "Panthera tigris": { country: "IN", kingdom: "ANIMALIA" },
  "Panthera uncia": { country: "CN", kingdom: "ANIMALIA" },
  "Tapirus indicus": { country: "MY", kingdom: "ANIMALIA" },
  "Tarsius": { country: "PH", kingdom: "ANIMALIA" },
  
  "Macropus rufus": { country: "AU", kingdom: "ANIMALIA" },
  "Phascolarctos cinereus": { country: "AU", kingdom: "ANIMALIA" },
  "Ornithorhynchus anatinus": { country: "AU", kingdom: "ANIMALIA" },
  "Apteryx": { country: "NZ", kingdom: "ANIMALIA" },
  "Phalanger": { country: "AU", kingdom: "ANIMALIA" },
  
  "Ursus arctos horribilis": { country: "US", kingdom: "ANIMALIA" },
  "Bison bison": { country: "US", kingdom: "ANIMALIA" },
  "Haliaeetus leucocephalus": { country: "US", kingdom: "ANIMALIA" },
  "Vulpes vulpes": { country: "GB", kingdom: "ANIMALIA" },
  
  "Panthera onca": { country: "BR", kingdom: "ANIMALIA" },
  "Ara macao": { country: "CR", kingdom: "ANIMALIA" },
  "Agalychnis callidryas": { country: "CR", kingdom: "ANIMALIA" },
  "Bradypus": { country: "BR", kingdom: "ANIMALIA" },
  "Eunectes murinus": { country: "BR", kingdom: "ANIMALIA" },
  
  "Panthera leo": { country: "ZA", kingdom: "ANIMALIA" },
  "Giraffa camelopardalis": { country: "ZA", kingdom: "ANIMALIA" },
  "Loxodonta africana": { country: "ZA", kingdom: "ANIMALIA" },
  "Acinonyx jubatus": { country: "ZA", kingdom: "ANIMALIA" },
  "Lemur catta": { country: "MG", kingdom: "ANIMALIA" },
  
  "Canis lupus": { country: "DE", kingdom: "ANIMALIA" },
  "Cervus elaphus": { country: "DE", kingdom: "ANIMALIA" },
  "Erinaceus europaeus": { country: "GB", kingdom: "ANIMALIA" },
  
  "Chelonia mydas": { country: "ALL", kingdom: "ANIMALIA" },
  "Balaenoptera musculus": { country: "ALL", kingdom: "ANIMALIA" },
  "Carcharodon carcharias": { country: "ALL", kingdom: "ANIMALIA" },
  "Tursiops truncatus": { country: "ALL", kingdom: "ANIMALIA" },
};

const KINGDOMS = [
  { value: "ALL", label: "Semua Kerajaan" },
  { value: "ANIMALIA", label: "Animalia (Hewan)" },
  { value: "PLANTAE", label: "Plantae (Tumbuhan)" },
  { value: "FUNGI", label: "Fungi (Jamur)" },
  { value: "PROTOZOA", label: "Protozoa" },
  { value: "BACTERIA", label: "Bacteria" },
  { value: "ARCHAEA", label: "Archaea" },
  { value: "CHROMISTA", label: "Chromista" }
];

export default function FilterSidebar({
  filters,
  onFiltersChange,
  onLoadDataset,
  activeDatasetName,
  loading,
  occurrences,
}: FilterSidebarProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAdvancedTaxonomy, setShowAdvancedTaxonomy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for live GBIF API Search
  const [apiQuery, setApiQuery] = useState("Panthera tigris");
  const [apiKingdom, setApiKingdom] = useState("ALL");
  const [apiCountry, setApiCountry] = useState("ALL");
  const [apiYearStart, setApiYearStart] = useState(1900);
  const [apiYearEnd, setApiYearEnd] = useState(2026);
  const [apiLimit, setApiLimit] = useState(500);
  const [apiHasCoordinate, setApiHasCoordinate] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccessMsg, setApiSuccessMsg] = useState<string | null>(null);

  const handleFetchGBIFData = async () => {
    if (apiQuery.trim() === "") {
      setApiError("Harap masukkan nama spesies atau kueri kata kunci terlebih dahulu.");
      return;
    }

    setApiLoading(true);
    setApiError(null);
    setApiSuccessMsg(null);

    try {
      let url = `/api/gbif/occurrence/search?limit=${apiLimit}`;

      // 1. Try to match species for higher precision
      try {
        const matchRes = await fetch(`/api/gbif/species/match?name=${encodeURIComponent(apiQuery)}`);
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          if (matchData.usageKey) {
            url += `&taxonKey=${matchData.usageKey}`;
          } else {
            url += `&q=${encodeURIComponent(apiQuery)}`;
          }
        } else {
          url += `&q=${encodeURIComponent(apiQuery)}`;
        }
      } catch (e) {
        url += `&q=${encodeURIComponent(apiQuery)}`;
      }

      // 2. Append parameters
      if (apiKingdom !== "ALL") {
        url += `&kingdom=${apiKingdom.toLowerCase()}`;
      }
      if (apiCountry !== "ALL") {
        url += `&country=${apiCountry}`;
      }
      if (apiHasCoordinate) {
        url += `&hasCoordinate=true`;
      }
      
      // Year range formatting
      url += `&year=${apiYearStart},${apiYearEnd}`;

      // 3. Perform Fetch
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server GBIF memberikan respons status ${response.status}`);
      }

      const data = await response.json();
      const rawResults = data.results || [];

      if (rawResults.length === 0) {
        throw new Error("Tidak ada data kejadian yang ditemukan untuk kueri ini di server GBIF.");
      }

      // 4. Map results to GBIFOccurrence
      const mappedOccurrences: GBIFOccurrence[] = rawResults.map((rec: any) => ({
        key: rec.key,
        scientificName: rec.scientificName || rec.species || "Spesies Tidak Diketahui",
        kingdom: rec.kingdom || "ANIMALIA",
        phylum: rec.phylum || "",
        class: rec.class || "",
        order: rec.order || "",
        family: rec.family || "",
        genus: rec.genus || "",
        decimalLatitude: typeof rec.decimalLatitude === "number" && !isNaN(rec.decimalLatitude) ? rec.decimalLatitude : undefined,
        decimalLongitude: typeof rec.decimalLongitude === "number" && !isNaN(rec.decimalLongitude) ? rec.decimalLongitude : undefined,
        year: typeof rec.year === "number" && !isNaN(rec.year) ? rec.year : undefined,
        month: typeof rec.month === "number" && !isNaN(rec.month) ? rec.month : undefined,
        day: typeof rec.day === "number" && !isNaN(rec.day) ? rec.day : undefined,
        country: rec.country || COUNTRY_CODES[rec.countryCode] || "",
        countryCode: rec.countryCode || "",
        basisOfRecord: rec.basisOfRecord || "HUMAN_OBSERVATION",
        recordedBy: rec.recordedBy || "",
        locality: rec.locality || "",
        eventDate: rec.eventDate || "",
        institutionCode: rec.institutionCode || "",
        collectionCode: rec.collectionCode || "",
        catalogNumber: rec.catalogNumber || "",
        license: rec.license || ""
      }));

      // 5. Update global app state via onLoadDataset
      const datasetLabel = `GBIF API: "${apiQuery}" (${mappedOccurrences.length} Rekor)`;
      onLoadDataset(mappedOccurrences, datasetLabel);
      
      // Update local form state for filters in sidebar so the user can filter the new dataset
      onFiltersChange({
        scientificName: apiQuery,
        kingdom: apiKingdom,
        phylum: "",
        class: "",
        order: "",
        family: "",
        genus: "",
        yearStart: apiYearStart,
        yearEnd: apiYearEnd,
        basisOfRecord: ["HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "MACHINE_OBSERVATION", "MATERIAL_SAMPLE", "LIVING_SPECIMEN"],
        country: apiCountry,
        limit: apiLimit,
        hasCoordinate: apiHasCoordinate,
      });

      setApiSuccessMsg(`Berhasil mengunduh ${mappedOccurrences.length} rekor kejadian.`);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Gagal memproses permintaan ke API GBIF.");
    } finally {
      setApiLoading(false);
    }
  };

  // Handle Drag & Drop events
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop file
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setUploadError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Manual File Selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Process and parse CSV File
  const processFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setUploadError("Hanya mendukung file format CSV (.csv).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error("File kosong atau tidak dapat dibaca.");
        }

        const rawRecords = parseCSV(text);
        if (rawRecords.length === 0) {
          throw new Error("Gagal membaca baris data. Pastikan file CSV Anda memiliki baris header.");
        }

        const mappedOccurrences = mapCSVToOccurrences(rawRecords);
        if (mappedOccurrences.length === 0) {
          throw new Error("Tidak ada baris data valid yang terpetakan ke spesifikasi GBIF.");
        }

        // Successfully parsed and mapped!
        onLoadDataset(mappedOccurrences, file.name);
        setUploadError(null);
      } catch (err: any) {
        setUploadError(err.message || "Gagal memproses file CSV.");
      }
    };
    reader.onerror = () => {
      setUploadError("Gagal membaca file dari penyimpanan.");
    };
    reader.readAsText(file);
  };

  const handleBasisOfRecordToggle = (basis: string) => {
    const isSelected = filters.basisOfRecord.includes(basis);
    const updated = isSelected
      ? filters.basisOfRecord.filter((b) => b !== basis)
      : [...filters.basisOfRecord, basis];

    onFiltersChange({
      ...filters,
      basisOfRecord: updated,
    });
  };

  const handleTextInputChange = (field: keyof GBIFFilters, val: string) => {
    onFiltersChange({
      ...filters,
      [field]: val,
    });
  };

  const handleNumberInputChange = (field: keyof GBIFFilters, val: number) => {
    onFiltersChange({
      ...filters,
      [field]: val,
    });
  };

  const handleCheckboxToggle = (field: "hasCoordinate") => {
    onFiltersChange({
      ...filters,
      [field]: !filters[field],
    });
  };

  return (
    <div id="filter-sidebar-wrapper" className="flex flex-col gap-5 bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm w-full">
      
      {/* SECTION: DATASET SOURCE PICKER */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-display">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Sumber Dataset (Biblioshiny)
        </h3>

        {/* Tab 1: Cari Database Berdasarkan API (Live GBIF Query) */}
        <div className="flex flex-col gap-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 shadow-inner">
          <div className="flex items-center gap-1.5 text-emerald-800">
            <Globe className="w-4 h-4" />
            <span className="text-xs font-bold font-display uppercase tracking-wider">Koneksi Real-Time GBIF</span>
          </div>
          
          <p className="text-[10px] text-slate-500 leading-normal">
            Pilih jenis spesies, nama ilmiah, atau genus di bawah ini untuk mengunduh dan menganalisis rekor langsung dari server global GBIF.
          </p>

          {/* Pilihan Spesies List */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pilih Spesies / Nama Ilmiah / Genus
            </label>
            <select
              value={apiQuery}
              onChange={(e) => {
                const val = e.target.value;
                setApiQuery(val);
                const config = SPECIES_AUTO_CONFIGS[val];
                if (config) {
                  setApiCountry(config.country);
                  setApiKingdom(config.kingdom);
                }
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
            >
              {PRESET_SPECIES_GROUPS.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Grid Kerajaan & Negara */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Kerajaan (Kingdom)
              </label>
              <select
                value={apiKingdom}
                onChange={(e) => setApiKingdom(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                {KINGDOMS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Lokasi Negara
              </label>
              <select
                value={apiCountry}
                onChange={(e) => setApiCountry(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-sans"
              >
                <option value="ALL">Dunia (Global)</option>
                {Object.entries(COUNTRY_CODES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rentang Tahun & Batas Rekor */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Rentang Tahun
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1700}
                  max={2026}
                  value={apiYearStart}
                  onChange={(e) => setApiYearStart(parseInt(e.target.value) || 1900)}
                  className="w-full px-1.5 py-1 text-center text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  min={1700}
                  max={2026}
                  value={apiYearEnd}
                  onChange={(e) => setApiYearEnd(parseInt(e.target.value) || 2026)}
                  className="w-full px-1.5 py-1 text-center text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Batas Rekor
              </label>
              <select
                value={apiLimit}
                onChange={(e) => setApiLimit(parseInt(e.target.value) || 500)}
                className="w-full px-1 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white text-center"
              >
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
          </div>

          {/* Checkbox hasCoordinate */}
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={apiHasCoordinate}
              onChange={(e) => setApiHasCoordinate(e.target.checked)}
              className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20"
            />
            <span className="text-[10px] text-slate-600 font-medium select-none">
              Hanya data dengan koordinat lokasi peta
            </span>
          </label>

          {/* Error & Success Messages */}
          {apiError && (
            <div className="p-2 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-100 rounded-lg">
              ⚠️ {apiError}
            </div>
          )}
          {apiSuccessMsg && (
            <div className="p-2 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg">
              ✅ {apiSuccessMsg}
            </div>
          )}

          {/* Trigger Button */}
          <button
            type="button"
            onClick={handleFetchGBIFData}
            disabled={apiLoading}
            className={`w-full py-2.5 rounded-xl text-xs font-bold font-display uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 ${
              apiLoading
                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50"
            }`}
          >
            {apiLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengunduh...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Cari & Ambil Data API
              </>
            )}
          </button>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* SECTION: CLIENT-SIDE INTERACTIVE FILTERS */}
      <div className="flex flex-col gap-4">
        
        {/* Sub-header for Parameters */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-display">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            Parameter Penyaringan
          </h3>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-medium">
            Lokal
          </span>
        </div>

        {/* Filter 1: Temporal (Rentang Tahun) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide font-display flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Rentang Tahun Temporal
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1700}
              max={2026}
              value={filters.yearStart}
              onChange={(e) => handleNumberInputChange("yearStart", parseInt(e.target.value) || 1900)}
              className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Mulai"
            />
            <span className="text-slate-400 text-xs font-medium">s/d</span>
            <input
              type="number"
              min={1700}
              max={2026}
              value={filters.yearEnd}
              onChange={(e) => handleNumberInputChange("yearEnd", parseInt(e.target.value) || 2026)}
              className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Akhir"
            />
          </div>
        </div>

        {/* Filter 2: Kingdom Select */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide font-display">
            Kerajaan (Kingdom)
          </label>
          <select
            value={filters.kingdom}
            onChange={(e) => handleTextInputChange("kingdom", e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
            id="select-kingdom"
          >
            {KINGDOMS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter 3: Country / Location */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide font-display flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            Lokasi Negara
          </label>
          <select
            value={filters.country}
            onChange={(e) => handleTextInputChange("country", e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
            id="select-country"
          >
            <option value="ALL">Global (Semua Negara)</option>
            {Object.entries(COUNTRY_CODES).map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </select>
        </div>

        {/* Filter 4: Basis of Record Checkboxes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide font-display">
            Basis Pencatatan (Record Basis)
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
            {Object.entries(BASIS_OF_RECORD_LABELS)
              .filter(([key]) => key !== "UNKNOWN")
              .map(([key, label]) => {
                const checked = filters.basisOfRecord.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-1 p-1 rounded-lg cursor-pointer text-[10px] font-medium transition-all select-none ${
                      checked
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/15"
                        : "bg-white hover:bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleBasisOfRecordToggle(key)}
                      className="hidden"
                    />
                    <div className={`w-3 h-3 rounded flex items-center justify-center border transition-all ${
                      checked 
                        ? "bg-emerald-600 border-emerald-600 text-white" 
                        : "bg-white border-slate-300"
                    }`}>
                      {checked && <Check className="w-2 h-2 stroke-[3]" />}
                    </div>
                    <span className="truncate" title={label}>{label}</span>
                  </label>
                );
              })}
          </div>
        </div>

        {/* Filter 5: Search Taxonomic Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide font-display">
            Cari Nama Spesies / Ilmiah
          </label>
          <div className="relative">
            <input
              type="text"
              value={filters.scientificName}
              onChange={(e) => handleTextInputChange("scientificName", e.target.value)}
              placeholder="Ketik kata kunci nama spesies..."
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans text-slate-800 placeholder:text-slate-400"
              id="input-taxonomy-search-local"
            />
            {filters.scientificName && (
              <button
                type="button"
                onClick={() => handleTextInputChange("scientificName", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
                title="Bersihkan kata kunci"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filter 6: Advanced Taxonomy Accordion */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvancedTaxonomy(!showAdvancedTaxonomy)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50/50 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Tingkat Taksonomi Lanjutan
            </span>
            {showAdvancedTaxonomy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdvancedTaxonomy && (
            <div className="p-3 bg-white border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-medium">Filum</label>
                <input
                  type="text"
                  placeholder="Cth: Chordata"
                  value={filters.phylum}
                  onChange={(e) => handleTextInputChange("phylum", e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-medium">Kelas</label>
                <input
                  type="text"
                  placeholder="Cth: Mammalia"
                  value={filters.class}
                  onChange={(e) => handleTextInputChange("class", e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-medium">Ordo</label>
                <input
                  type="text"
                  placeholder="Cth: Carnivora"
                  value={filters.order}
                  onChange={(e) => handleTextInputChange("order", e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 font-medium">Famili</label>
                <input
                  type="text"
                  placeholder="Cth: Felidae"
                  value={filters.family}
                  onChange={(e) => handleTextInputChange("family", e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-slate-500 font-medium">Genus</label>
                <input
                  type="text"
                  placeholder="Cth: Panthera"
                  value={filters.genus}
                  onChange={(e) => handleTextInputChange("genus", e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Filter 7: Checkbox and toggle options */}
        <div className="flex flex-col gap-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={filters.hasCoordinate}
              onChange={() => handleCheckboxToggle("hasCoordinate")}
              className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span>Hanya data berkoordinat peta</span>
          </label>
        </div>

      </div>
    </div>
  );
}
