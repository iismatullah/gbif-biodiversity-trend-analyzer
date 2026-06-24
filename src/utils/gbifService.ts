/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GBIFFilters, GBIFSearchResponse, TaxonSuggestion } from "../types";

const GBIF_API_BASE = "/api/gbif";

/**
 * Searches GBIF occurrence database based on filters.
 */
export async function searchOccurrences(filters: GBIFFilters): Promise<GBIFSearchResponse> {
  const params = new URLSearchParams();

  // Taxonomic filters
  if (filters.taxonKey) {
    params.append("taxonKey", filters.taxonKey.toString());
  } else if (filters.scientificName && filters.scientificName.trim() !== "") {
    params.append("scientificName", filters.scientificName.trim());
  }

  if (filters.kingdom && filters.kingdom !== "ALL") {
    params.append("kingdom", filters.kingdom);
  }
  if (filters.phylum && filters.phylum.trim() !== "") {
    params.append("phylum", filters.phylum.trim());
  }
  if (filters.class && filters.class.trim() !== "") {
    params.append("class", filters.class.trim());
  }
  if (filters.order && filters.order.trim() !== "") {
    params.append("order", filters.order.trim());
  }
  if (filters.family && filters.family.trim() !== "") {
    params.append("family", filters.family.trim());
  }
  if (filters.genus && filters.genus.trim() !== "") {
    params.append("genus", filters.genus.trim());
  }

  // Temporal range
  if (filters.yearStart && filters.yearEnd) {
    params.append("year", `${filters.yearStart},${filters.yearEnd}`);
  }

  // Location filters
  if (filters.country && filters.country !== "ALL") {
    params.append("country", filters.country);
  }

  // Coordinates indicator
  if (filters.hasCoordinate) {
    params.append("hasCoordinate", "true");
  }

  // Basis of Record (can have multiple values)
  if (filters.basisOfRecord && filters.basisOfRecord.length > 0) {
    filters.basisOfRecord.forEach((basis) => {
      params.append("basisOfRecord", basis);
    });
  }

  // Pagination limit
  params.append("limit", filters.limit.toString());

  const url = `${GBIF_API_BASE}/occurrence/search?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GBIF API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch occurrences from GBIF", error);
    throw error;
  }
}

/**
 * Suggests taxon scientific names based on autocomplete input queries.
 */
export async function suggestScientificNames(query: string): Promise<TaxonSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const url = `${GBIF_API_BASE}/species/suggest?q=${encodeURIComponent(query)}&limit=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GBIF Species Suggest API Error: ${response.status}`);
    }
    const data = await response.json();
    return data as TaxonSuggestion[];
  } catch (error) {
    console.error("Failed to fetch species suggestions from GBIF", error);
    return [];
  }
}
