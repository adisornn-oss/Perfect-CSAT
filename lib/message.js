import { getProduct, getSettings, templateFor } from './data.js';
import { appUrl } from './notify.js';

export const surveyUrl = (req, tok) => `${appUrl(req)}/r/${tok}`;

export async function messageFor(req, c) {
  const [p, s, tpl] = await Promise.all([getProduct(c.product), getSettings(), templateFor(c.product, c.channel)]);
  const link = surveyUrl(req, c.token);
  const text = tpl
    .replace(/\{product\}/g, p?.name || c.product)
    .replace(/\{agent\}/g, c.agentNick)
    .replace(/\{case\}/g, c.no)
    .replace(/\{days\}/g, String(s.linkTtlDays))
    .replace(/\{link\}/g, link);
  return { link, text };
}
