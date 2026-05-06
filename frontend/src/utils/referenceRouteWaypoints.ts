export type ReferenceRouteKey =
  | "fvr-pitx-forward"
  | "pitx-fvr-reverse"
  | "fvr-stcruz-forward"
  | "stcruz-fvr-reverse";

export type ReferenceWaypoint = {
  name: string;
  lat: number;
  lng: number;
};

export const REFERENCE_GOOGLE_MAP_LINKS: Record<"fvr-pitx" | "fvr-stcruz", string> = {
  "fvr-pitx": "https://maps.app.goo.gl/afMZornDfTm4Rpzh9",
  "fvr-stcruz": "https://maps.app.goo.gl/aAXkcU3hhThpB9RG7"
};

/**
 * Curated control points.
 *
 * These are editable reference waypoints. They are NOT decoded directly from
 * Google Maps because maps.app.goo.gl does not expose the hidden Google route
 * polyline without Google Directions API.
 *
 * Flow:
 * 1. Admin clicks "Use reference route path".
 * 2. These points are saved to Firebase AdminRoutes.
 * 3. Admin can still use Manual edit route to fine-tune the path.
 */
export const REFERENCE_ROUTE_WAYPOINTS: Record<ReferenceRouteKey, ReferenceWaypoint[]> = {
  "fvr-stcruz-forward": [
    { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 },
    { name: "Sapang Palay Terminal Exit", lat: 14.84162, lng: 121.04062 },
    { name: "Sapang Palay Main Road 1", lat: 14.83996, lng: 121.03942 },
    { name: "Sapang Palay Main Road 2", lat: 14.83722, lng: 121.03795 },
    { name: "Sapang Palay / San Jose Road", lat: 14.83461, lng: 121.03715 },
    { name: "San Jose Road North", lat: 14.83081, lng: 121.03703 },
    { name: "San Jose Road Mid", lat: 14.82675, lng: 121.03812 },
    { name: "SJDM Proper North", lat: 14.82164, lng: 121.04145 },
    { name: "SJDM Proper", lat: 14.81571, lng: 121.04477 },
    { name: "SJDM South", lat: 14.81046, lng: 121.04558 },
    { name: "Towerville / SJDM", lat: 14.80697, lng: 121.04651 },
    { name: "Muzon Approach", lat: 14.80102, lng: 121.04012 },
    { name: "Muzon Terminal", lat: 14.79285, lng: 121.03138 },
    { name: "Muzon Road 1", lat: 14.78951, lng: 121.02584 },
    { name: "Muzon Road 2", lat: 14.78782, lng: 121.02095 },
    { name: "Muzon Road 3", lat: 14.78561, lng: 121.01672 },
    { name: "San Jose Road", lat: 14.78194, lng: 121.01083 },
    { name: "San Jose del Monte Connector", lat: 14.77866, lng: 121.00521 },
    { name: "Balsik / Connector", lat: 14.77321, lng: 120.99864 },
    { name: "SJLC Approach", lat: 14.76692, lng: 120.98847 },
    { name: "SJLC Korean Food Mart Area", lat: 14.76042, lng: 120.97962 },
    { name: "Marilao Connector 1", lat: 14.75534, lng: 120.97231 },
    { name: "Marilao Connector 2", lat: 14.75179, lng: 120.96691 },
    { name: "Marilao / NLEX Approach", lat: 14.74242, lng: 120.95626 },
    { name: "NLEX Marilao Southbound 1", lat: 14.73381, lng: 120.95511 },
    { name: "NLEX Marilao Southbound 2", lat: 14.72413, lng: 120.95514 },
    { name: "NLEX Southbound Marilao", lat: 14.71767, lng: 120.95606 },
    { name: "NLEX Meycauayan North", lat: 14.70492, lng: 120.95774 },
    { name: "NLEX Meycauayan", lat: 14.69131, lng: 120.96137 },
    { name: "NLEX Valenzuela North", lat: 14.68144, lng: 120.96521 },
    { name: "NLEX Valenzuela", lat: 14.67188, lng: 120.97117 },
    { name: "NLEX Balintawak Approach", lat: 14.66352, lng: 120.98635 },
    { name: "Balintawak / Cloverleaf", lat: 14.65784, lng: 120.99818 },
    { name: "A. Bonifacio North", lat: 14.65087, lng: 120.99958 },
    { name: "A. Bonifacio Avenue", lat: 14.64648, lng: 120.99929 },
    { name: "A. Bonifacio South", lat: 14.64154, lng: 120.99783 },
    { name: "A. Bonifacio / La Loma", lat: 14.63328, lng: 120.99476 },
    { name: "Blumentritt North", lat: 14.62784, lng: 120.99062 },
    { name: "Blumentritt", lat: 14.62258, lng: 120.98676 },
    { name: "Lacson Avenue North", lat: 14.61742, lng: 120.98854 },
    { name: "Lacson Avenue", lat: 14.61397, lng: 120.98967 },
    { name: "UST / Lacson", lat: 14.60936, lng: 120.98958 },
    { name: "Recto Approach", lat: 14.60664, lng: 120.98711 },
    { name: "Recto / Doroteo Jose", lat: 14.60467, lng: 120.98367 },
    { name: "ST. CRUZ Manila Terminal Area", lat: 14.60206, lng: 120.98141 }
  ],

  "stcruz-fvr-reverse": [
    { name: "ST. CRUZ Manila Terminal Area", lat: 14.60206, lng: 120.98141 },
    { name: "Recto / Doroteo Jose", lat: 14.60467, lng: 120.98367 },
    { name: "Recto Approach", lat: 14.60664, lng: 120.98711 },
    { name: "UST / Lacson", lat: 14.60936, lng: 120.98958 },
    { name: "Lacson Avenue", lat: 14.61397, lng: 120.98967 },
    { name: "Lacson Avenue North", lat: 14.61742, lng: 120.98854 },
    { name: "Blumentritt", lat: 14.62258, lng: 120.98676 },
    { name: "Blumentritt North", lat: 14.62784, lng: 120.99062 },
    { name: "A. Bonifacio / La Loma", lat: 14.63328, lng: 120.99476 },
    { name: "A. Bonifacio South", lat: 14.64154, lng: 120.99783 },
    { name: "A. Bonifacio Avenue", lat: 14.64648, lng: 120.99929 },
    { name: "A. Bonifacio North", lat: 14.65087, lng: 120.99958 },
    { name: "Balintawak / Cloverleaf", lat: 14.65784, lng: 120.99818 },
    { name: "NLEX Balintawak Approach", lat: 14.66352, lng: 120.98635 },
    { name: "NLEX Valenzuela", lat: 14.67188, lng: 120.97117 },
    { name: "NLEX Valenzuela North", lat: 14.68144, lng: 120.96521 },
    { name: "NLEX Meycauayan", lat: 14.69131, lng: 120.96137 },
    { name: "NLEX Meycauayan North", lat: 14.70492, lng: 120.95774 },
    { name: "NLEX Southbound Marilao", lat: 14.71767, lng: 120.95606 },
    { name: "NLEX Marilao Southbound 2", lat: 14.72413, lng: 120.95514 },
    { name: "NLEX Marilao Southbound 1", lat: 14.73381, lng: 120.95511 },
    { name: "Marilao / NLEX Approach", lat: 14.74242, lng: 120.95626 },
    { name: "Marilao Connector 2", lat: 14.75179, lng: 120.96691 },
    { name: "Marilao Connector 1", lat: 14.75534, lng: 120.97231 },
    { name: "SJLC Korean Food Mart Area", lat: 14.76042, lng: 120.97962 },
    { name: "SJLC Approach", lat: 14.76692, lng: 120.98847 },
    { name: "Balsik / Connector", lat: 14.77321, lng: 120.99864 },
    { name: "San Jose del Monte Connector", lat: 14.77866, lng: 121.00521 },
    { name: "San Jose Road", lat: 14.78194, lng: 121.01083 },
    { name: "Muzon Road 3", lat: 14.78561, lng: 121.01672 },
    { name: "Muzon Road 2", lat: 14.78782, lng: 121.02095 },
    { name: "Muzon Road 1", lat: 14.78951, lng: 121.02584 },
    { name: "Muzon Terminal", lat: 14.79285, lng: 121.03138 },
    { name: "Muzon Approach", lat: 14.80102, lng: 121.04012 },
    { name: "Towerville / SJDM", lat: 14.80697, lng: 121.04651 },
    { name: "SJDM South", lat: 14.81046, lng: 121.04558 },
    { name: "SJDM Proper", lat: 14.81571, lng: 121.04477 },
    { name: "SJDM Proper North", lat: 14.82164, lng: 121.04145 },
    { name: "San Jose Road Mid", lat: 14.82675, lng: 121.03812 },
    { name: "San Jose Road North", lat: 14.83081, lng: 121.03703 },
    { name: "Sapang Palay / San Jose Road", lat: 14.83461, lng: 121.03715 },
    { name: "Sapang Palay Main Road 2", lat: 14.83722, lng: 121.03795 },
    { name: "Sapang Palay Main Road 1", lat: 14.83996, lng: 121.03942 },
    { name: "Sapang Palay Terminal Exit", lat: 14.84162, lng: 121.04062 },
    { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 }
  ],

  "fvr-pitx-forward": [
    { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 },
    { name: "Sapang Palay Terminal Exit", lat: 14.84072, lng: 121.03988 },
    { name: "Sapang Palay Main Road", lat: 14.83586, lng: 121.03726 },
    { name: "SJDM Proper", lat: 14.81571, lng: 121.04477 },
    { name: "Muzon Terminal", lat: 14.79285, lng: 121.03138 },
    { name: "Quirino Highway / Novaliches Approach", lat: 14.74277, lng: 121.03574 },
    { name: "Novaliches Bayan", lat: 14.72018, lng: 121.03844 },
    { name: "Mindanao Avenue", lat: 14.68047, lng: 121.03246 },
    { name: "North Avenue / EDSA", lat: 14.65376, lng: 121.03236 },
    { name: "GMA Kamuning / EDSA", lat: 14.63536, lng: 121.04355 },
    { name: "Cubao / EDSA", lat: 14.61962, lng: 121.05214 },
    { name: "Ortigas / EDSA", lat: 14.58513, lng: 121.05672 },
    { name: "Guadalupe / EDSA", lat: 14.56629, lng: 121.04519 },
    { name: "Ayala / EDSA", lat: 14.55042, lng: 121.02568 },
    { name: "Magallanes", lat: 14.53598, lng: 121.01953 },
    { name: "Roxas Boulevard / NAIA Road", lat: 14.51962, lng: 120.99856 },
    { name: "PITX", lat: 14.50942, lng: 120.99102 }
  ],

  "pitx-fvr-reverse": [
    { name: "PITX", lat: 14.50942, lng: 120.99102 },
    { name: "Roxas Boulevard / NAIA Road", lat: 14.51962, lng: 120.99856 },
    { name: "Magallanes", lat: 14.53598, lng: 121.01953 },
    { name: "Ayala / EDSA", lat: 14.55042, lng: 121.02568 },
    { name: "Guadalupe / EDSA", lat: 14.56629, lng: 121.04519 },
    { name: "Ortigas / EDSA", lat: 14.58513, lng: 121.05672 },
    { name: "Cubao / EDSA", lat: 14.61962, lng: 121.05214 },
    { name: "GMA Kamuning / EDSA", lat: 14.63536, lng: 121.04355 },
    { name: "North Avenue / EDSA", lat: 14.65376, lng: 121.03236 },
    { name: "Mindanao Avenue", lat: 14.68047, lng: 121.03246 },
    { name: "Novaliches Bayan", lat: 14.72018, lng: 121.03844 },
    { name: "Quirino Highway / Novaliches Approach", lat: 14.74277, lng: 121.03574 },
    { name: "Muzon Terminal", lat: 14.79285, lng: 121.03138 },
    { name: "SJDM Proper", lat: 14.81571, lng: 121.04477 },
    { name: "Sapang Palay Main Road", lat: 14.83586, lng: 121.03726 },
    { name: "Sapang Palay Terminal Exit", lat: 14.84072, lng: 121.03988 },
    { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 }
  ]
};

export function getReferenceRouteKey(
  selectedLineId: "fvr-pitx" | "fvr-stcruz",
  direction: "forward" | "reverse"
): ReferenceRouteKey {
  if (selectedLineId === "fvr-pitx") {
    return direction === "forward" ? "fvr-pitx-forward" : "pitx-fvr-reverse";
  }

  return direction === "forward" ? "fvr-stcruz-forward" : "stcruz-fvr-reverse";
}

export function getReferenceRoutePoints(
  selectedLineId: "fvr-pitx" | "fvr-stcruz",
  direction: "forward" | "reverse"
) {
  return REFERENCE_ROUTE_WAYPOINTS[getReferenceRouteKey(selectedLineId, direction)];
}