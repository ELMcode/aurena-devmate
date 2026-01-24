export type ODataParams = {
  filter?: string;
  select?: string;
  orderby?: string;
  expand?: string;
  top?: string;
  skip?: string;
  raw: Record<string, string>;
};

export type ParsedProjectionRequest = {
  projection: string;
  resource: string;
  odata: ODataParams;
};

const PROJECTION_MARKER = '/ifsapplications/projection/v1/';

export function parseProjectionRequest(url: string): ParsedProjectionRequest | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const { pathname, searchParams } = parsed;
  const markerIndex = pathname.indexOf(PROJECTION_MARKER);
  if (markerIndex === -1) return null;

  const afterMarker = pathname.slice(markerIndex + PROJECTION_MARKER.length); // CustomerOrderHandling.svc/CustomerOrderSet
  const [projectionSegment, ...rest] = afterMarker.split('/');
  if (!projectionSegment) return null;

  const projection = projectionSegment.replace(/\.svc$/i, '');
  const resource = rest.join('/');

  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const odata: ODataParams = {
    raw,
    filter: searchParams.get('$filter') ?? undefined,
    select: searchParams.get('$select') ?? undefined,
    orderby: searchParams.get('$orderby') ?? undefined,
    expand: searchParams.get('$expand') ?? undefined,
    top: searchParams.get('$top') ?? undefined,
    skip: searchParams.get('$skip') ?? undefined,
  };

  return {
    projection,
    resource,
    odata,
  };
}
