/**
 * The mock picture provider: one fixed stock illustration, no network call and no key, so the
 * whole picture path can be used and tested before a paid provider is switched on.
 */

export const MOCK_IMAGE_URL =
  'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1200';

export async function generateWithMockImage() {
  return { url: MOCK_IMAGE_URL };
}

export default { generateWithMockImage };
