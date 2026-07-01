'use client';

/**
 * Mol* viewer for AlphaFold / PDB structures. Loaded dynamically so the
 * 1MB+ molstar bundle doesn't ship with every page.
 *
 * Usage:
 *   <MoleculeViewer uniProtAccession="P12345" />
 *   <MoleculeViewer pdbId="1ake" />
 *   <MoleculeViewer source={{ url: "...", format: "pdb" }} />
 */

import { useEffect, useRef } from 'react';

export interface MoleculeViewerProps {
  uniProtAccession?: string;
  pdbId?: string;
  source?: { url: string; format: 'pdb' | 'mmcif' | 'pdbqt' };
  height?: number;
}

export function MoleculeViewer({
  uniProtAccession,
  pdbId,
  source,
  height = 480,
}: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let plugin: { dispose: () => void } | null = null;
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const { createPluginUI } = await import('molstar/lib/mol-plugin-ui');
      const { renderReact18 } = await import('molstar/lib/mol-plugin-ui/react18');
      const { DefaultPluginUISpec } = await import('molstar/lib/mol-plugin-ui/spec');
      const spec = DefaultPluginUISpec();

      const inst = await createPluginUI({
        target: containerRef.current,
        render: renderReact18,
        spec: {
          ...spec,
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              regionState: { left: 'hidden', top: 'hidden', right: 'hidden', bottom: 'hidden' },
            },
          },
        },
      });
      if (cancelled) {
        inst.dispose();
        return;
      }
      plugin = inst;

      let url: string;
      let format: 'pdb' | 'mmcif' | 'pdbqt' = 'mmcif';
      if (uniProtAccession) {
        url = `https://alphafold.ebi.ac.uk/files/AF-${uniProtAccession}-F1-model_v4.cif`;
      } else if (pdbId) {
        url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
      } else if (source) {
        url = source.url;
        format = source.format;
      } else {
        return;
      }
      const data = await inst.builders.data.download({ url, isBinary: false });
      const trajectory = await inst.builders.structure.parseTrajectory(data, format);
      await inst.builders.structure.hierarchy.applyPreset(trajectory, 'default');
    })();
    return () => {
      cancelled = true;
      plugin?.dispose();
    };
  }, [uniProtAccession, pdbId, source]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-md overflow-hidden border border-border"
      style={{ height }}
    />
  );
}
