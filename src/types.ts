/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GBIFOccurrence {
  key: number;
  scientificName: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  year?: number;
  month?: number;
  day?: number;
  country?: string;
  countryCode?: string;
  basisOfRecord: string;
  recordedBy?: string;
  locality?: string;
  eventDate?: string;
  institutionCode?: string;
  collectionCode?: string;
  catalogNumber?: string;
  license?: string;
}

export interface GBIFFilters {
  scientificName: string;
  taxonKey?: number;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  yearStart: number;
  yearEnd: number;
  basisOfRecord: string[];
  country: string;
  limit: number;
  hasCoordinate: boolean;
}

export interface GBIFSearchResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  count: number;
  results: GBIFOccurrence[];
}

export interface TaxonSuggestion {
  key: number;
  scientificName: string;
  rank: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
}

export interface SearchPreset {
  label: string;
  scientificName: string;
  taxonKey?: number;
  kingdom?: string;
  yearStart: number;
  yearEnd: number;
  description: string;
}

// Indonesian Label mappings for Basis of Record
export const BASIS_OF_RECORD_LABELS: Record<string, string> = {
  PRESERVED_SPECIMEN: "Spesimen Diawetkan",
  HUMAN_OBSERVATION: "Observasi Manusia",
  MACHINE_OBSERVATION: "Observasi Mesin",
  MATERIAL_SAMPLE: "Sampel Material",
  LIVING_SPECIMEN: "Spesimen Hidup",
  FOSSIL_SPECIMEN: "Fosil",
  OCCURRENCE: "Kejadian Umum",
  LITERATURE: "Catatan Literatur",
  UNKNOWN: "Tidak Diketahui"
};

// ISO 2-letter Country Codes mapping to Country Names (Indonesian/English)
export const COUNTRY_CODES: Record<string, string> = {
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapura",
  PH: "Filipina",
  TH: "Thailand",
  VN: "Vietnam",
  AU: "Australia",
  NZ: "Selandia Baru",
  US: "Amerika Serikat",
  GB: "Britania Raya",
  JP: "Jepang",
  CN: "Tiongkok",
  IN: "India",
  BR: "Brasil",
  ZA: "Afrika Selatan",
  DE: "Jerman",
  FR: "Prancis",
  NL: "Belanda",
  CA: "Kanada",
  MG: "Madagaskar",
  EC: "Ekuador",
  CO: "Kolombia",
  PE: "Peru",
  CR: "Kosta Rika",
};
