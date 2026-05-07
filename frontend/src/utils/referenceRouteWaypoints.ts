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

/*
 * Editable curated control points.
 *
 * These points are not decoded from maps.app.goo.gl. Google short links do not
 * expose the hidden Google route polyline without a configured Google routing
 * API. Route Config saves these free reference points to Firebase AdminRoutes,
 * then admins can fine-tune them with manual map editing and place search.
 * Reverse route references below are the same waypoint lists in reverse order.
 */

const FVR_PITX_FORWARD: ReferenceWaypoint[] = [
  { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 },
  { name: "Balasing - San Jose Road", lat: 14.84186, lng: 121.04077 },
  { name: "Balasing - San Jose Road 2", lat: 14.83912, lng: 121.03942 },
  { name: "Roquero Avenue Junction", lat: 14.8357, lng: 121.03796 },
  { name: "Sapang Palay / San Jose Road", lat: 14.83142, lng: 121.03726 },
  { name: "San Jose Heights", lat: 14.82758, lng: 121.03861 },
  { name: "SJDM City Proper North", lat: 14.82164, lng: 121.04145 },
  { name: "SJDM City Proper", lat: 14.81571, lng: 121.04477 },
  { name: "Quirino Highway / San Jose del Monte", lat: 14.80934, lng: 121.04743 },
  { name: "Towerville / Quirino Highway", lat: 14.80346, lng: 121.04876 },
  { name: "Muzon / Quirino Highway Approach", lat: 14.79742, lng: 121.04985 },
  { name: "Tungkong Mangga North", lat: 14.79082, lng: 121.05271 },
  { name: "Tungkong Mangga / Quirino Highway", lat: 14.78596, lng: 121.05418 },
  { name: "Quirino Highway / Graceville", lat: 14.77762, lng: 121.0565 },
  { name: "Quirino Highway / Grotto", lat: 14.76874, lng: 121.05858 },
  { name: "Quirino Highway / Amparo", lat: 14.75988, lng: 121.06026 },
  { name: "Quirino Highway / Lagro", lat: 14.74854, lng: 121.06072 },
  { name: "SM City Fairview / Regalado", lat: 14.7358, lng: 121.0589 },
  { name: "Fairview Center Mall", lat: 14.7297, lng: 121.0626 },
  { name: "Commonwealth / Fairview", lat: 14.71836, lng: 121.07136 },
  { name: "Commonwealth / Dona Carmen", lat: 14.70858, lng: 121.0793 },
  { name: "Commonwealth / Litex", lat: 14.69804, lng: 121.08538 },
  { name: "Batasan / Commonwealth", lat: 14.68914, lng: 121.09502 },
  { name: "Commonwealth / Ever Gotesco", lat: 14.68458, lng: 121.08814 },
  { name: "Don Antonio / Commonwealth", lat: 14.68064, lng: 121.08172 },
  { name: "Tandang Sora / Commonwealth", lat: 14.67316, lng: 121.07736 },
  { name: "Luzon Avenue / Commonwealth", lat: 14.66682, lng: 121.07472 },
  { name: "UP-Ayala Technohub / Commonwealth", lat: 14.65924, lng: 121.06978 },
  { name: "Philcoa / Commonwealth", lat: 14.6537, lng: 121.0633 },
  { name: "Quezon Memorial Circle North", lat: 14.6531, lng: 121.0552 },
  { name: "Quezon Memorial Circle / Quezon Avenue", lat: 14.6508, lng: 121.049 },
  { name: "Quezon Avenue / East Avenue", lat: 14.64262, lng: 121.0463 },
  { name: "GMA Kamuning / EDSA", lat: 14.63536, lng: 121.04355 },
  { name: "EDSA / Kamias", lat: 14.62866, lng: 121.04674 },
  { name: "Araneta Center Cubao / EDSA", lat: 14.61962, lng: 121.05214 },
  { name: "Santolan / EDSA", lat: 14.60872, lng: 121.05674 },
  { name: "Ortigas / EDSA", lat: 14.58513, lng: 121.05672 },
  { name: "Shaw / EDSA", lat: 14.58131, lng: 121.05395 },
  { name: "Boni / EDSA", lat: 14.57386, lng: 121.04886 },
  { name: "Guadalupe / EDSA", lat: 14.56629, lng: 121.04519 },
  { name: "Buendia / EDSA", lat: 14.5542, lng: 121.03425 },
  { name: "Ayala / EDSA", lat: 14.55042, lng: 121.02568 },
  { name: "Magallanes / EDSA", lat: 14.53598, lng: 121.01953 },
  { name: "EDSA Taft / Pasay Rotonda", lat: 14.53702, lng: 121.00192 },
  { name: "Roxas Boulevard / EDSA", lat: 14.53538, lng: 120.99786 },
  { name: "Roxas Boulevard / Baclaran", lat: 14.53032, lng: 120.99482 },
  { name: "NAIA Road / Roxas Boulevard", lat: 14.52318, lng: 120.99372 },
  { name: "Macapagal Boulevard / NAIA Road", lat: 14.5202, lng: 120.9948 },
  { name: "Aseana Avenue / Macapagal", lat: 14.5146, lng: 120.9924 },
  { name: "PITX", lat: 14.50942, lng: 120.99102 }
];

const FVR_STCRUZ_FORWARD: ReferenceWaypoint[] = [
  { name: "FVR / Sapang Palay Terminal", lat: 14.84312, lng: 121.04125 },
  { name: "Sapang Palay Terminal Exit", lat: 14.84162, lng: 121.04062 },
  { name: "Sapang Palay Main Road 1", lat: 14.83996, lng: 121.03942 },
  { name: "Sapang Palay Main Road 2", lat: 14.83722, lng: 121.03795 },
  { name: "Sapang Palay / San Jose Road", lat: 14.83461, lng: 121.03715 },
  { name: "San Jose Heights / Sapang Palay", lat: 14.82872, lng: 121.03872 },
  { name: "SJDM Proper North", lat: 14.82164, lng: 121.04145 },
  { name: "SJDM Proper", lat: 14.81571, lng: 121.04477 },
  { name: "Towerville / SJDM", lat: 14.80697, lng: 121.04651 },
  { name: "Muzon Junction", lat: 14.8006, lng: 121.04 },
  { name: "Muzon Terminal", lat: 14.79285, lng: 121.03138 },
  { name: "Muzon Road 1", lat: 14.78951, lng: 121.02584 },
  { name: "Muzon Road 2", lat: 14.78782, lng: 121.02095 },
  { name: "Muzon Road 3", lat: 14.78561, lng: 121.01672 },
  { name: "Loma de Gato / SJDM-Marilao Road", lat: 14.78194, lng: 121.01083 },
  { name: "San Jose del Monte Connector", lat: 14.77866, lng: 121.00521 },
  { name: "Balsik / Connector", lat: 14.77321, lng: 120.99864 },
  { name: "Lias / Marilao Road", lat: 14.76692, lng: 120.98847 },
  { name: "Marilao Connector 1", lat: 14.76042, lng: 120.97962 },
  { name: "Marilao Connector 2", lat: 14.75534, lng: 120.97231 },
  { name: "Marilao Town Approach", lat: 14.75179, lng: 120.96691 },
  { name: "Marilao / NLEX Approach", lat: 14.74242, lng: 120.95626 },
  { name: "NLEX Marilao Southbound", lat: 14.73381, lng: 120.95511 },
  { name: "NLEX Bocaue Southbound", lat: 14.72413, lng: 120.95514 },
  { name: "NLEX Marilao South", lat: 14.71767, lng: 120.95606 },
  { name: "NLEX Meycauayan North", lat: 14.70492, lng: 120.95774 },
  { name: "NLEX Meycauayan", lat: 14.69131, lng: 120.96137 },
  { name: "NLEX Valenzuela North", lat: 14.68144, lng: 120.96521 },
  { name: "NLEX Paso de Blas", lat: 14.67188, lng: 120.97117 },
  { name: "NLEX Balintawak Approach", lat: 14.66352, lng: 120.98635 },
  { name: "Balintawak / Cloverleaf", lat: 14.65784, lng: 120.99818 },
  { name: "A. Bonifacio North", lat: 14.65087, lng: 120.99958 },
  { name: "A. Bonifacio Avenue", lat: 14.64648, lng: 120.99929 },
  { name: "A. Bonifacio South", lat: 14.64154, lng: 120.99783 },
  { name: "A. Bonifacio / La Loma", lat: 14.63328, lng: 120.99476 },
  { name: "Blumentritt North", lat: 14.62784, lng: 120.99062 },
  { name: "Blumentritt", lat: 14.62258, lng: 120.98676 },
  { name: "Lacson / Dimasalang", lat: 14.61742, lng: 120.98854 },
  { name: "Lacson Avenue", lat: 14.61397, lng: 120.98967 },
  { name: "UST / Lacson", lat: 14.60936, lng: 120.98958 },
  { name: "Recto Approach", lat: 14.60664, lng: 120.98711 },
  { name: "Recto / Doroteo Jose", lat: 14.60467, lng: 120.98367 },
  { name: "ST. CRUZ Manila Terminal Area", lat: 14.60206, lng: 120.98141 }
];

const reverseReferenceWaypoints = (points: ReferenceWaypoint[]) =>
  points.map((point) => ({ ...point })).reverse();

export const REFERENCE_ROUTE_WAYPOINTS: Record<ReferenceRouteKey, ReferenceWaypoint[]> = {
  "fvr-pitx-forward": FVR_PITX_FORWARD,
  "pitx-fvr-reverse": reverseReferenceWaypoints(FVR_PITX_FORWARD),
  "fvr-stcruz-forward": FVR_STCRUZ_FORWARD,
  "stcruz-fvr-reverse": reverseReferenceWaypoints(FVR_STCRUZ_FORWARD)
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
  return REFERENCE_ROUTE_WAYPOINTS[getReferenceRouteKey(selectedLineId, direction)].map(
    (point) => ({ ...point })
  );
}
