import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = (process.env.XEREBRO_BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  try {
    const headers: Record<string, string> = {
      cookie: request.headers.get('cookie') ?? '',
      'content-type': 'application/json',
    };
    const wsHeader = request.headers.get('x-workspace-id');
    if (wsHeader) headers['x-workspace-id'] = wsHeader;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty on reset
    }

    const response = await fetch(`${baseUrl}/api/policies/circuit-breakers/${id}/reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao rearmar disjuntor.' },
      { status: 503 }
    );
  }
}
