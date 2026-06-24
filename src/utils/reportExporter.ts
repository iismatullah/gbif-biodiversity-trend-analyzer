/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { GBIFFilters, BASIS_OF_RECORD_LABELS } from "../types";

/**
 * Resolves oklch() color functions in a style string to their equivalent hex or rgb/rgba string.
 * This utilizes the browser's native Canvas API color resolver.
 */
function resolveOklchColors(styleValue: string): string {
  if (!styleValue || typeof styleValue !== "string" || !styleValue.includes("oklch")) {
    return styleValue;
  }

  const oklchRegex = /oklch\([^)]+\)/g;
  return styleValue.replace(oklchRegex, (match) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = match;
        const resolved = ctx.fillStyle;
        if (resolved && resolved !== "transparent") {
          return resolved;
        }
      }
    } catch (e) {
      // ignore
    }
    if (match.includes("/")) {
      return "rgba(0, 0, 0, 0.1)";
    }
    return "#10b981"; // emerald default fallback
  });
}

/**
 * Recursively traverses a DOM element's tree and temporarily forces standard resolved
 * hex/rgb colors on any elements that use oklch computed colors. This guarantees
 * that html2canvas will read standard format colors directly from inline style overrides.
 */
function applyOklchInlinePolyfill(element: HTMLElement): () => void {
  const revertedStyles: { element: HTMLElement; originalStyles: { [key: string]: string } }[] = [];

  const colorProps = [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "fill",
    "stroke"
  ];

  function traverse(node: Element) {
    if (node instanceof HTMLElement) {
      const computed = window.getComputedStyle(node);
      const originalStyles: { [key: string]: string } = {};
      let hasOklch = false;

      colorProps.forEach((prop) => {
        const value = computed.getPropertyValue(prop);
        if (value && value.includes("oklch")) {
          originalStyles[prop] = node.style.getPropertyValue(prop);
          const resolved = resolveOklchColors(value);
          node.style.setProperty(prop, resolved, "important");
          hasOklch = true;
        }
      });

      if (hasOklch) {
        revertedStyles.push({ element: node, originalStyles });
      }
    }

    // Traverse children
    for (let i = 0; i < node.children.length; i++) {
      traverse(node.children[i]);
    }
  }

  traverse(element);

  // Return function to restore original inline styles perfectly
  return () => {
    revertedStyles.forEach(({ element, originalStyles }) => {
      Object.entries(originalStyles).forEach(([prop, originalValue]) => {
        if (originalValue) {
          element.style.setProperty(prop, originalValue);
        } else {
          element.style.removeProperty(prop);
        }
      });
    });
  };
}

/**
 * Temporarily wraps a function execution with a monkey-patch of window.getComputedStyle
 * that intercepts and converts oklch() color values to standard rgb/hex formats.
 * This prevents html2canvas from crashing with "unsupported color function" errors.
 */
async function withOklchPolyfill<T>(fn: () => Promise<T>): Promise<T> {
  const originalGetComputedStyle = window.getComputedStyle;

  window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
    const style = originalGetComputedStyle.call(window, elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === "getPropertyValue") {
          return function (propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            if (typeof val === "string" && val.includes("oklch")) {
              return resolveOklchColors(val);
            }
            return val;
          };
        }

        const value = Reflect.get(target, prop);
        if (typeof value === "string" && value.includes("oklch")) {
          return resolveOklchColors(value);
        }
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      }
    });
  };

  try {
    return await fn();
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

/**
 * Downloads a specific DOM element as a high-resolution PNG image.
 */
export async function exportElementAsPNG(elementId: string, fileName: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID ${elementId} not found`);
    return;
  }

  const cleanup = applyOklchInlinePolyfill(element);

  try {
    const canvas = await withOklchPolyfill(async () => {
      return await html2canvas(element, {
        scale: 2, // High resolution scaling
        useCORS: true, // Allow external tiles and images (critical for Leaflet maps!)
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
      });
    });

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Gagal mengekspor gambar PNG:", error);
    alert("Terjadi kesalahan saat mengekspor gambar PNG. Silakan coba lagi.");
  } finally {
    cleanup();
  }
}

/**
 * Downloads a specific DOM element as a PDF page.
 */
export async function exportElementAsPDF(elementId: string, fileName: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID ${elementId} not found`);
    return;
  }

  const cleanup = applyOklchInlinePolyfill(element);

  try {
    const canvas = await withOklchPolyfill(async () => {
      return await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
      });
    });

    const imgWidth = 210; // A4 size width in mm
    const pageHeight = 297; // A4 size height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    const doc = new jsPDF("p", "mm", "a4");
    let position = 10; // margin top

    doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth - 20, imgHeight - 20);
    doc.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Gagal mengekspor dokumen PDF:", error);
    alert("Terjadi kesalahan saat mengekspor dokumen PDF.");
  } finally {
    cleanup();
  }
}

function drawChartPlaceholder(doc: jsPDF, x: number, y: number, message: string) {
  doc.setFillColor("#f8fafc");
  doc.rect(x, y, 180, 80, "F");
  doc.setDrawColor("#cbd5e1");
  doc.rect(x, y, 180, 80, "S");
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#64748b");
  doc.text(message, x + 15, y + 36);
  doc.text("Tips: Pastikan tab 'Tren & Statistik' aktif sebelum mengunduh untuk menyertakan grafik.", x + 15, y + 42);
}

/**
 * Generates and downloads a comprehensive multi-page research-grade PDF report
 * containing metadata, overview stats, the interactive map, and all analytics charts.
 */
export async function exportComprehensivePDF(
  filters: GBIFFilters,
  stats: {
    totalRecords: number;
    yearSpan: string;
    coordinateCount: number;
    topCountry: string;
    topGenus: string;
    qualityScore: number;
  }
) {
  return withOklchPolyfill(async () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
    const primaryColor = "#059669"; // emerald-600
    const textColor = "#1e293b"; // slate-800

    // PAGE 1: TITLE & STATISTICAL OVERVIEW
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor);
    doc.text("LAPORAN ANALISIS BIBLIOMETRIK BIODIVERSITAS", 15, 25);
    
    doc.setFontSize(12);
    doc.setTextColor("#64748b");
    doc.setFont("Helvetica", "normal");
    doc.text("Dihasilkan secara otomatis via GBIF Biodiversity Trend Analyzer", 15, 31);
    doc.text(`Waktu Pembuatan: ${new Date().toLocaleString("id-ID")}`, 15, 37);

    // Filter details box
    doc.setFillColor("#f8fafc");
    doc.rect(15, 45, 180, 42, "F");
    doc.setDrawColor("#cbd5e1");
    doc.rect(15, 45, 180, 42, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text("PARAMETER FILTER ANALISIS:", 20, 51);

    doc.setFont("Helvetica", "normal");
    doc.text(`Nama Ilmiah / Takson: ${filters.scientificName || "Semua Spesies (Global)"}`, 20, 58);
    doc.text(`Kerajaan (Kingdom): ${filters.kingdom}`, 20, 64);
    doc.text(`Rentang Tahun: ${filters.yearStart} - ${filters.yearEnd}`, 20, 70);
    doc.text(`Lokasi Negara: ${filters.country === "ALL" ? "Global" : filters.country}`, 20, 76);
    doc.text(`Batas Maksimal Data: ${filters.limit} catatan`, 20, 82);

    // Overview Statistics Cards
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.text("RINGKASAN STATISTIK:", 15, 98);

    const statsGridY = 104;
    // Card 1
    doc.setFillColor("#ecfdf5"); // emerald-50
    doc.rect(15, statsGridY, 56, 25, "F");
    doc.setDrawColor("#a7f3d0");
    doc.rect(15, statsGridY, 56, 25, "S");
    doc.setFontSize(8);
    doc.setTextColor("#047857");
    doc.text("TOTAL DATA REKOR", 18, statsGridY + 6);
    doc.setFontSize(14);
    doc.setFont("Helvetica", "bold");
    doc.text(stats.totalRecords.toLocaleString("id-ID"), 18, statsGridY + 16);

    // Card 2
    doc.setFillColor("#f0fdfa"); // teal-50
    doc.rect(77, statsGridY, 56, 25, "F");
    doc.setDrawColor("#99f6e4");
    doc.rect(77, statsGridY, 56, 25, "S");
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor("#0f766e");
    doc.text("RENTANG TAHUN", 80, statsGridY + 6);
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text(stats.yearSpan, 80, statsGridY + 16);

    // Card 3
    doc.setFillColor("#f8fafc"); // slate-50
    doc.rect(139, statsGridY, 56, 25, "F");
    doc.setDrawColor("#e2e8f0");
    doc.rect(139, statsGridY, 56, 25, "S");
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor("#475569");
    doc.text("AKURASI GEOSPASIAL", 142, statsGridY + 6);
    doc.setFontSize(13);
    doc.setFont("Helvetica", "bold");
    doc.text(`${stats.coordinateCount} Titik Peta`, 142, statsGridY + 16);

    // Secondary row of stats
    const statsGridY2 = 134;
    doc.setFillColor("#eff6ff"); // blue-50
    doc.rect(15, statsGridY2, 88, 22, "F");
    doc.setDrawColor("#bfdbfe");
    doc.rect(15, statsGridY2, 88, 22, "S");
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor("#1d4ed8");
    doc.text("NEGARA TERTINGGI DALAM DATA", 18, statsGridY2 + 6);
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.text(stats.topCountry || "Tidak Diketahui", 18, statsGridY2 + 14);

    doc.setFillColor("#faf5ff"); // purple-50
    doc.rect(107, statsGridY2, 88, 22, "F");
    doc.setDrawColor("#e9d5ff");
    doc.rect(107, statsGridY2, 88, 22, "S");
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor("#6d28d9");
    doc.text("NILAI KESIAPAN PENELITIAN DATA (DATA QUALITY)", 110, statsGridY2 + 6);
    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.text(`${stats.qualityScore}% Kualitas Fitur`, 110, statsGridY2 + 14);

    // PAGE 2: CHARTS & ANALYTICS TRENDS
    doc.addPage();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor);
    doc.text("ANALISIS TEMPORAL & TAKSONOMI BIODIVERSITAS", 15, 20);

    // Capture Chart 1: Temporal Trend
    const chartTemporal = document.getElementById("chart-card-temporal");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text("1. Tren Persebaran Populasi Secara Temporal (Tahun ke Tahun)", 15, 28);
    if (chartTemporal) {
      const cleanupTemporal = applyOklchInlinePolyfill(chartTemporal);
      try {
        const canvas1 = await html2canvas(chartTemporal, { scale: 1.5 });
        const img1 = canvas1.toDataURL("image/jpeg", 0.9);
        doc.addImage(img1, "JPEG", 15, 32, 180, 80);
      } catch (err) {
        console.error("Gagal menangkap grafik temporal:", err);
        drawChartPlaceholder(doc, 15, 32, "Gagal menangkap grafik tren temporal.");
      } finally {
        cleanupTemporal();
      }
    } else {
      drawChartPlaceholder(doc, 15, 32, "Grafik tren temporal tidak aktif di tab saat ini.");
    }

    // Capture Chart 2: Taxonomic Diversity
    const chartTaxonomic = document.getElementById("chart-card-taxonomic");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text("2. Komposisi Keragaman Taksonomi Generik (Keanekaragaman Genus)", 15, 118);
    if (chartTaxonomic) {
      const cleanupTaxonomic = applyOklchInlinePolyfill(chartTaxonomic);
      try {
        const canvas2 = await html2canvas(chartTaxonomic, { scale: 1.5 });
        const img2 = canvas2.toDataURL("image/jpeg", 0.9);
        doc.addImage(img2, "JPEG", 15, 122, 180, 80);
      } catch (err) {
        console.error("Gagal menangkap grafik taksonomi:", err);
        drawChartPlaceholder(doc, 15, 122, "Gagal menangkap grafik taksonomi.");
      } finally {
        cleanupTaxonomic();
      }
    } else {
      drawChartPlaceholder(doc, 15, 122, "Grafik taksonomi tidak aktif di tab saat ini.");
    }

    // PAGE 3: SEASONALITY & METADATA QUALITY
    doc.addPage();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor);
    doc.text("ANALISIS MUSIMAN & BASIS DATA PENELITIAN", 15, 20);

    // Capture Chart 3: Seasonality Month
    const chartSeasonal = document.getElementById("chart-card-seasonal");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text("3. Tren Distribusi Musiman (Pencatatan Berdasarkan Bulan)", 15, 28);
    if (chartSeasonal) {
      const cleanupSeasonal = applyOklchInlinePolyfill(chartSeasonal);
      try {
        const canvas3 = await html2canvas(chartSeasonal, { scale: 1.5 });
        const img3 = canvas3.toDataURL("image/jpeg", 0.9);
        doc.addImage(img3, "JPEG", 15, 32, 180, 80);
      } catch (err) {
        console.error("Gagal menangkap grafik musiman:", err);
        drawChartPlaceholder(doc, 15, 32, "Gagal menangkap grafik tren musiman.");
      } finally {
        cleanupSeasonal();
      }
    } else {
      drawChartPlaceholder(doc, 15, 32, "Grafik tren musiman tidak aktif di tab saat ini.");
    }

    // Capture Chart 4: Basis of Record
    const chartBasis = document.getElementById("chart-card-basis");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text("4. Distribusi Catatan Berdasarkan Basis Pengamatan (Methodology)", 15, 118);
    if (chartBasis) {
      const cleanupBasis = applyOklchInlinePolyfill(chartBasis);
      try {
        const canvas4 = await html2canvas(chartBasis, { scale: 1.5 });
        const img4 = canvas4.toDataURL("image/jpeg", 0.9);
        doc.addImage(img4, "JPEG", 15, 122, 180, 80);
      } catch (err) {
        console.error("Gagal menangkap grafik basis data:", err);
        drawChartPlaceholder(doc, 15, 122, "Gagal menangkap grafik basis pengamatan.");
      } finally {
        cleanupBasis();
      }
    } else {
      drawChartPlaceholder(doc, 15, 122, "Grafik basis pengamatan tidak aktif di tab saat ini.");
    }

    // FOOTER INFO ON LAST PAGE
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor("#94a3b8");
    doc.text("Data bersumber secara dinamis dari Global Biodiversity Information Facility (GBIF) Public API.", 15, 215);
    doc.text("Analisis ini bersifat otomatis dan ditujukan untuk tujuan pelaporan ilmiah, konservasi, serta pembelajaran bibliometrik.", 15, 219);

    const safeScientificName = filters.scientificName ? filters.scientificName.trim().replace(/\s+/g, "_") : "Global";
    doc.save(`Laporan_GBIF_Biodiversitas_${safeScientificName}.pdf`);
    } catch (error) {
      console.error("Gagal membuat laporan komprehensif PDF:", error);
      alert("Gagal mengekspor laporan komprehensif PDF.");
    }
  });
}
