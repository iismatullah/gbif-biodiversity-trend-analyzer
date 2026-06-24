/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GBIFOccurrence } from "../types";

/**
 * Bulletproof client-side CSV Parser that handles quoted values, commas,
 * different line endings, and returns structured objects based on headers.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        row[row.length - 1] += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Column delimiter
      row.push("");
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      // Row delimiter
      if (char === "\r" && nextChar === "\n") {
        i++; // skip next character
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }

  if (lines.length < 2) return [];

  // Headers are the first row
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 1 && line[0] === "") continue; // skip empty line

    const record: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      record[header] = line[colIndex] !== undefined ? line[colIndex].trim() : "";
    });
    data.push(record);
  }

  return data;
}

/**
 * Maps parsed CSV key-values to standard GBIFOccurrence structures.
 * Detects common spelling, aliases, and variations of headers.
 */
export function mapCSVToOccurrences(rawRecords: Record<string, string>[]): GBIFOccurrence[] {
  return rawRecords.map((rec, index) => {
    // Find value by checking variations of standard header keys
    const getValue = (keys: string[]): string | undefined => {
      for (const k of keys) {
        if (rec[k] !== undefined) return rec[k];
      }
      return undefined;
    };

    const key = parseInt(getValue(["gbifid", "gbif key", "key", "id"]) || "") || index + 1;
    
    const scientificName = getValue(["scientificname", "scientific_name", "species", "taxon", "name"]) || "Spesies Tidak Diketahui";
    const kingdom = getValue(["kingdom", "kerajaan", "kingdom_name"]) || "ANIMALIA";
    const phylum = getValue(["phylum", "filum", "phylum_name"]) || "";
    const className = getValue(["class", "kelas", "class_name"]) || "";
    const order = getValue(["order", "ordo", "order_name"]) || "";
    const family = getValue(["family", "famili", "family_name"]) || "";
    const genus = getValue(["genus", "genus_name"]) || "";
    
    const latStr = getValue(["decimallatitude", "latitude", "lat", "decimal_latitude", "y"]);
    const decimalLatitude = latStr ? parseFloat(latStr) : undefined;

    const lngStr = getValue(["decimallongitude", "longitude", "lng", "lon", "decimal_longitude", "x"]);
    const decimalLongitude = lngStr ? parseFloat(lngStr) : undefined;

    const yearStr = getValue(["year", "tahun", "date_year", "tahun_pencatatan"]);
    const year = yearStr ? parseInt(yearStr) : undefined;

    const monthStr = getValue(["month", "bulan", "date_month"]);
    const month = monthStr ? parseInt(monthStr) : undefined;

    const dayStr = getValue(["day", "hari", "date_day"]);
    const day = dayStr ? parseInt(dayStr) : undefined;

    const country = getValue(["country", "negara", "country_name"]) || "";
    const countryCode = getValue(["countrycode", "country_code", "kode_negara"]) || "";

    const basisOfRecord = (getValue(["basisofrecord", "basis_of_record", "type", "record_basis"]) || "HUMAN_OBSERVATION")
      .toUpperCase()
      .replace(/\s+/g, "_");

    const recordedBy = getValue(["recordedby", "recorded_by", "collector", "kolektor", "penemu"]) || "";
    const locality = getValue(["locality", "lokasi", "place", "tempat", "address"]) || "";
    const eventDate = getValue(["eventdate", "event_date", "date", "tanggal"]) || "";
    const institutionCode = getValue(["institutioncode", "institution_code", "institusi"]) || "";

    return {
      key,
      scientificName,
      kingdom,
      phylum,
      class: className,
      order,
      family,
      genus,
      decimalLatitude: decimalLatitude !== undefined && !isNaN(decimalLatitude) ? decimalLatitude : undefined,
      decimalLongitude: decimalLongitude !== undefined && !isNaN(decimalLongitude) ? decimalLongitude : undefined,
      year: year !== undefined && !isNaN(year) ? year : undefined,
      month: month !== undefined && !isNaN(month) ? month : undefined,
      day: day !== undefined && !isNaN(day) ? day : undefined,
      country,
      countryCode,
      basisOfRecord,
      recordedBy,
      locality,
      eventDate,
      institutionCode
    };
  });
}
