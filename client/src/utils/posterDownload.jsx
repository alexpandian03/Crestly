import React from 'react';
import ReactDOM from 'react-dom';
import api from '../services/api';
import PosterCanvas from '../components/PosterCanvas';
import { exportPoster } from './exportPoster';
import { canvasBaseColor } from './brandRender';
import { designBrandKit, designTemplate } from './posterDesign';

/**
 * Renders `<PosterCanvas>` offscreen at full resolution and downloads the exact poster file.
 */
export async function exportPosterDocument({
  brandKit,
  template,
  content,
  orgName = '',
  format = 'png',
  view = null,
}) {
  const effectiveBrandKit = content?.design?.brandKit || brandKit;
  const effectiveTemplate = template || content?.design?.template;
  const width = effectiveTemplate?.size?.width || 1080;
  const height = effectiveTemplate?.size?.height || 1350;
  const bgColor = canvasBaseColor(effectiveBrandKit, effectiveTemplate);

  const org = (orgName || effectiveBrandKit?.orgName || 'poster').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const title = (content?.title || 'poster').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `${org}-${title}`.replace(/-+/g, '-').slice(0, 60);

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    z-index: -1;
    pointer-events: none;
  `;
  document.body.appendChild(container);

  let settleResolve;
  const settled = new Promise((resolve) => {
    settleResolve = resolve;
  });

  try {
    await new Promise((resolve) => {
      ReactDOM.render(
        <PosterCanvas
          brandKit={effectiveBrandKit}
          template={effectiveTemplate}
          content={content}
          view={view}
          isExporting={true}
          onLayoutSettled={settleResolve}
        />,
        container,
        resolve
      );
    });

    await Promise.race([settled, new Promise((r) => setTimeout(r, 3500))]);

    const node = container.firstElementChild;
    const imgs = node ? Array.from(node.querySelectorAll('img')) : [];
    await Promise.all(
      imgs.map((img) => (typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()))
    );
    await new Promise((r) => setTimeout(r, 200));

    return await exportPoster(node, format, filename, { width, height }, bgColor);
  } finally {
    ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
  }
}

/**
 * Fetches the full saved poster record + snapshot and downloads the exact rendered poster.
 */
export async function downloadSavedPoster(
  posterId,
  { fallbackPoster = null, fallbackBrandKit = null, fallbackTemplate = null, format = 'png' } = {}
) {
  if (!posterId) throw new Error('Poster not found.');

  const response = await api.get(`/posters/${posterId}`);
  const payload = response.data?.data;
  const loaded = payload?.poster;
  if (!response.data?.success || !loaded) {
    throw new Error('We could not load this poster to download.');
  }

  const resolvedBrandKit = designBrandKit(loaded.design, fallbackBrandKit);
  const resolvedTemplate = designTemplate(loaded.design, payload?.template || fallbackTemplate);
  const resolvedContent = {
    ...(loaded.content || {}),
    title: loaded.content?.title || loaded.title || fallbackPoster?.title || 'poster',
    image: loaded.content?.imageUrl || loaded.content?.image || '',
  };

  return exportPosterDocument({
    brandKit: resolvedBrandKit,
    template: resolvedTemplate,
    content: resolvedContent,
    orgName: resolvedBrandKit?.orgName || '',
    format,
  });
}
