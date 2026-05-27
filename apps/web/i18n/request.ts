import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = (await {
    en: () => import('../messages/en.json'),
    hi: () => import('../messages/hi.json'),
    gu: () => import('../messages/gu.json'),
    ta: () => import('../messages/ta.json'),
    bn: () => import('../messages/bn.json'),
    mr: () => import('../messages/mr.json'),
    te: () => import('../messages/te.json'),
  }[locale]!()).default;

  return {
    locale,
    messages
  };
});