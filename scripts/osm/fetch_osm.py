"""
Fetch OpenStreetMap data for buildings, roads, and landuse from Overpass API.

Usage:
    python scripts/osm/fetch_osm.py \
        --lat 42.5513326 --lon -73.3792285 \
        --radius-miles 2 \
        --out-dir data/osm/stephentown
"""

import argparse
import json
import math
import time
from pathlib import Path
from typing import Any, Dict, List

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Retry settings for Overpass API (can be rate-limited)
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


def miles_to_meters(miles: float) -> float:
    return miles * 1609.344


def build_overpass_query(lat: float, lon: float, radius_meters: float) -> str:
    """
    Build Overpass QL query to fetch buildings, roads, and landuse.
    Uses 'around' for circular area query.
    """
    return f"""
[out:json][timeout:120];
(
  // Buildings
  way["building"](around:{radius_meters},{lat},{lon});
  relation["building"](around:{radius_meters},{lat},{lon});

  // Roads and paths
  way["highway"](around:{radius_meters},{lat},{lon});

  // Landuse areas
  way["landuse"](around:{radius_meters},{lat},{lon});
  relation["landuse"](around:{radius_meters},{lat},{lon});

  // Natural features
  way["natural"](around:{radius_meters},{lat},{lon});
  relation["natural"](around:{radius_meters},{lat},{lon});

  // Water bodies
  way["water"](around:{radius_meters},{lat},{lon});
  way["waterway"](around:{radius_meters},{lat},{lon});
  relation["water"](around:{radius_meters},{lat},{lon});

  // Amenities (POIs)
  node["amenity"](around:{radius_meters},{lat},{lon});
  way["amenity"](around:{radius_meters},{lat},{lon});
);
out body;
>;
out skel qt;
"""


def fetch_overpass(query: str) -> Dict[str, Any]:
    """Execute Overpass query with retries."""
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                OVERPASS_URL,
                data={"data": query},
                timeout=180,
                headers={"User-Agent": "AshesAndAether-WorldBuilder/0.1"},
            )
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                print(f"Overpass request failed ({e}), retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
            else:
                raise
    return {}


def parse_elements(data: Dict[str, Any]) -> Dict[str, List[Dict]]:
    """
    Parse Overpass response into categorized elements.
    Returns dict with 'nodes', 'ways', 'relations', and derived categories.
    """
    elements = data.get("elements", [])

    nodes: Dict[int, Dict] = {}
    ways: List[Dict] = []
    relations: List[Dict] = []

    # First pass: collect all nodes
    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = {
                "id": el["id"],
                "lat": el["lat"],
                "lon": el["lon"],
                "tags": el.get("tags", {}),
            }

    # Second pass: collect ways and resolve node references
    for el in elements:
        if el["type"] == "way":
            way_nodes = []
            for node_id in el.get("nodes", []):
                if node_id in nodes:
                    way_nodes.append({
                        "lat": nodes[node_id]["lat"],
                        "lon": nodes[node_id]["lon"],
                    })

            ways.append({
                "id": el["id"],
                "tags": el.get("tags", {}),
                "nodes": way_nodes,
            })

        elif el["type"] == "relation":
            relations.append({
                "id": el["id"],
                "tags": el.get("tags", {}),
                "members": el.get("members", []),
            })

    # Categorize by type
    buildings = [w for w in ways if "building" in w["tags"]]
    roads = [w for w in ways if "highway" in w["tags"]]
    landuse = [w for w in ways if "landuse" in w["tags"]]
    natural = [w for w in ways if "natural" in w["tags"]]
    water = [w for w in ways if "water" in w["tags"] or "waterway" in w["tags"]]
    amenities = [
        n for n in nodes.values() if "amenity" in n.get("tags", {})
    ] + [w for w in ways if "amenity" in w["tags"]]

    return {
        "nodes": list(nodes.values()),
        "ways": ways,
        "relations": relations,
        "buildings": buildings,
        "roads": roads,
        "landuse": landuse,
        "natural": natural,
        "water": water,
        "amenities": amenities,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch OSM data for buildings, roads, and features."
    )
    parser.add_argument("--lat", type=float, required=True, help="Center latitude.")
    parser.add_argument("--lon", type=float, required=True, help="Center longitude.")
    parser.add_argument(
        "--radius-miles", type=float, default=2.0, help="Radius in miles."
    )
    parser.add_argument(
        "--out-dir", type=str, default="data/osm", help="Output directory."
    )
    args = parser.parse_args()

    radius_meters = miles_to_meters(args.radius_miles)
    print(f"Fetching OSM data: center=({args.lat}, {args.lon}), radius={args.radius_miles}mi ({radius_meters:.0f}m)")

    query = build_overpass_query(args.lat, args.lon, radius_meters)
    print("Querying Overpass API...")

    raw_data = fetch_overpass(query)
    parsed = parse_elements(raw_data)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save raw response
    with open(out_dir / "raw.json", "w", encoding="utf-8") as f:
        json.dump(raw_data, f)

    # Save categorized data
    for category in ["buildings", "roads", "landuse", "natural", "water", "amenities"]:
        items = parsed.get(category, [])
        with open(out_dir / f"{category}.json", "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)
        print(f"  {category}: {len(items)} features")

    # Save metadata
    metadata = {
        "center": {"lat": args.lat, "lon": args.lon},
        "radiusMiles": args.radius_miles,
        "radiusMeters": radius_meters,
        "counts": {
            "buildings": len(parsed["buildings"]),
            "roads": len(parsed["roads"]),
            "landuse": len(parsed["landuse"]),
            "natural": len(parsed["natural"]),
            "water": len(parsed["water"]),
            "amenities": len(parsed["amenities"]),
            "totalNodes": len(parsed["nodes"]),
            "totalWays": len(parsed["ways"]),
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    with open(out_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nOSM data saved to {out_dir}")
    print(f"Total: {len(parsed['buildings'])} buildings, {len(parsed['roads'])} roads")


if __name__ == "__main__":
    main()
