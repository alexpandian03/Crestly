import ReactDOM from 'react-dom';
import api from '../services/api';
import PosterCanvas from '../components/PosterCanvas';
import { renderPosterJpeg } from './exportPoster';
import { canvasBaseColor } from './brandRender';

const THUMBNAIL_MAX_BYTES = 300 * 1024;

/**
 * Draws the poster offscreen with the brand kit and template it was saved with and uploads
 * the small JPEG as its card picture. Best-effort: a failure never bothers the user.
 */
export async function renderAndUploadThumbnail(
  posterId,
  { brandKit, template, content, view = null },
  { shouldAbort = () => false } = {}
) {
  if (!posterId || !brandKit || !template || !content) return false;
  const width = template?.size?.width || 1080;
  const height = template?.size?.height || 1350;
  const backgroundColor = canvasBaseColor(brandKit, template);

  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;overflow:hidden;z-index:-1;pointer-events:none;`;
  document.body.appendChild(container);
  try {
    let settleResolve;
    const settled = new Promise((resolve) => {
      settleResolve = resolve;
    });
    await new Promise((resolve) => {
      ReactDOM.render(
        <PosterCanvas
          brandKit={brandKit}
          template={template}
          content={content}
          view={view}
          onLayoutSettled={settleResolve}
        />,
        container,
        resolve
      );
    });
    await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, 3500))]);
    if (shouldAbort()) return false;

    const node = container.firstElementChild;
    if (!node) return false;
    await Promise.all(
      Array.from(node.querySelectorAll('img')).map((img) =>
        typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()
      )
    );

    let blob = await renderPosterJpeg(node, { width, height }, { targetWidth: 400, quality: 0.7, backgroundColor });
    if (blob && blob.size > THUMBNAIL_MAX_BYTES) {
      blob = await renderPosterJpeg(node, { width, height }, { targetWidth: 400, quality: 0.5, backgroundColor });
    }
    if (!blob || blob.size > THUMBNAIL_MAX_BYTES || shouldAbort()) return false;

    const form = new FormData();
    form.append('image', blob, 'thumbnail.jpg');
    await api.post(`/posters/${posterId}/thumbnail`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return true;
  } catch {
    return false;
  } finally {
    ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
  }
}
