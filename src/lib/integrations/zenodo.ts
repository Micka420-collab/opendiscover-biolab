export interface ZenodoMetadata {
  title: string;
  description: string;
  creators: Array<{ name: string; orcid?: string }>;
  keywords: string[];
  license: 'cc-by-4.0';
  upload_type: 'dataset';
  communities?: Array<{ identifier: string }>;
}

export interface ZenodoDepositResult {
  depositId: string;
  doi: string;
  doiUrl: string;
  recordUrl: string;
}

const baseUrl =
  process.env.NODE_ENV === 'production' ? 'https://zenodo.org' : 'https://sandbox.zenodo.org';

async function zenodoFetch(path: string, init: RequestInit): Promise<Response> {
  const token = process.env.ZENODO_ACCESS_TOKEN;
  if (!token) throw new Error('ZENODO_ACCESS_TOKEN is not set');

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zenodo ${init.method ?? 'GET'} ${path} failed [${res.status}]: ${body}`);
  }

  return res;
}

export async function createZenodoDeposit(
  metadata: ZenodoMetadata,
  files: Array<{ name: string; content: string }>,
): Promise<ZenodoDepositResult> {
  const createRes = await zenodoFetch('/api/deposit/depositions', {
    method: 'POST',
    body: JSON.stringify({
      metadata: {
        upload_type: metadata.upload_type,
        title: metadata.title,
        description: metadata.description,
        creators: metadata.creators.map((c) =>
          c.orcid ? { name: c.name, orcid: c.orcid } : { name: c.name },
        ),
        keywords: metadata.keywords,
        license: metadata.license,
        ...(metadata.communities ? { communities: metadata.communities } : {}),
      },
    }),
  });

  const deposit = await createRes.json();
  const bucketUrl: string = deposit.links.bucket;
  const depositId: string = String(deposit.id);

  for (const file of files) {
    const uploadRes = await fetch(`${bucketUrl}/${encodeURIComponent(file.name)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.ZENODO_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: file.content,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text().catch(() => '');
      throw new Error(
        `Zenodo file upload for "${file.name}" failed [${uploadRes.status}]: ${body}`,
      );
    }
  }

  const publishRes = await zenodoFetch(`/api/deposit/depositions/${depositId}/actions/publish`, {
    method: 'POST',
    body: '',
  });

  const data = await publishRes.json();

  return {
    depositId,
    doi: data.doi,
    doiUrl: `https://doi.org/${data.doi}`,
    recordUrl: data.links.record_html,
  };
}
