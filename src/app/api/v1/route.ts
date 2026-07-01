import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    version: '1.0',
    name: 'OpenDiscover Public API',
    endpoints: {
      discoveries: '/api/v1/discoveries',
      protocols: '/api/v1/protocols',
    },
    rateLimit: '30 requests/minute per IP',
    license: 'Data: CC-BY 4.0',
    docs: 'https://github.com/opendiscover/opendiscover',
  });
}
