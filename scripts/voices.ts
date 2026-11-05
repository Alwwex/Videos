import type {Lang} from '../src/engine/schema';

/**
 * Vybrané hlasy z knihovny ElevenLabs (rodilí mluvčí, nejpoužívanější v daném jazyce).
 * První v seznamu je výchozí. Hlas se při prvním použití sám přidá do tvé knihovny.
 */
export type LibVoice = {id: string; owner: string; name: string; gender: 'male' | 'female'; preview: string; note: string; find?: string};

export const VOICE_CATALOG: Record<Lang, LibVoice[]> = {
  cs: [
    {
      id: 'uYFJyGaibp4N2VwYQshk',
      owner: '745c0ac83b17e6556141cf657f6d875d35ec36cd6f10c72f86cddac1d4187857',
      name: 'Adam - Velvety and Conversational',
      gender: 'male',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/ZpYbCaSd2uMVjSr1tTgZPFLl0J92/voices/uYFJyGaibp4N2VwYQshk/P9QQG2a62C0lhe2HlcbL.mp3',
      note: 'přirozený, konverzační – doporučeno',
    },
    {
      id: 'vP4R9CqQI4q0HlVrXJWj',
      owner: 'e2036e5cc7991a27d4a4a92ab1b6bef1cecb302d7a823d74912346b90872b9aa',
      name: 'Zdeněk - Strong and Deep',
      gender: 'male',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7cd873f3f6034203861b4134e1fdfff4/voices/vP4R9CqQI4q0HlVrXJWj/8ead5ebc-1d82-4a88-9382-2d29ab93969d.mp3',
      note: 'hluboký, dokumentární',
    },
    {
      id: 'KIDKfqJyZ6ASuyzsKfh5',
      find: 'language=cs&sort=usage_character_count_1y',
      owner: '2ccae164de26dd439e08892fde21a9dba30e53de7fde58868c38175a6aa7ab72',
      name: 'Jan - Kind Educator',
      gender: 'male',
      preview: '',
      note: 'vlídný, vysvětlující',
    },
    {
      id: 'MpbYQvoTmXjHkaxtLiSh',
      owner: '491c1f82dfa01b434411a681d6c35ac8ad7b9de5a6f59361017f5e0324114e46',
      name: 'Anet - Youthful and Lively',
      gender: 'female',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/Lxslac0DMQfxUxRl8QN7Z94dYON2/voices/MpbYQvoTmXjHkaxtLiSh/hS3NsIINKt5zDt0MdAkF.mp3',
      note: 'mladá, energická',
    },
  ],
  en: [
    {
      id: '1SM7GgM6IMuvQlz2BwM3',
      find: 'language=en&sort=trending',
      owner: '024c9393c6380665357f60b1062c863cd635d79791f13d6f0a834a319d5ff56c',
      name: 'Mark - Casual, Relaxed and Light',
      gender: 'male',
      preview: '',
      note: 'casual, natural – recommended',
    },
    {
      id: 'DMyrgzQFny3JI1Y1paM5',
      find: 'language=en&sort=trending',
      owner: '37242178387aa74ac807790c7307e81312f0791cf06777a4791b86d941a77525',
      name: 'Donovan - Articulate, Strong and Deep',
      gender: 'male',
      preview: '',
      note: 'deep, strong',
    },
    {
      id: 'Nhs7eitvQWFTQBsf0yiT',
      owner: 'd3f3664a15c8cecb66283708fbb7e9f17e4dd962eda140443d9289a906700bcd',
      name: 'Sarah - Approachable and Informative',
      gender: 'female',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/kGguywYBM6ZDW5j5xFRCvBmzqL92/voices/Nhs7eitvQWFTQBsf0yiT/D6QJtXoAUfIBGei8I0WT.mp3',
      note: 'friendly explainer',
    },
  ],
  ro: [
    {
      id: 'OlBp4oyr3FBAGEAtJOnU',
      owner: '495a061f9b7930e3c37627d5b711c6f999daccbb88f8b98d76ca5db18eaa98cd',
      name: 'Jora Slobod - Calm, Deep and Reassuring',
      gender: 'male',
      preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/OlBp4oyr3FBAGEAtJOnU/Uub5cEzcyVo34vqgA9cA.mp3',
      note: 'nejpoužívanější – doporučeno',
    },
    {
      id: 'S98OhkhaxeAKHEbhoLi7',
      find: 'language=ro&sort=cloned_by_count',
      owner: '680d8372961c8e7b6462bba3a42f41b25fe12910de1e0f9d4473439ba1c0f32b',
      name: 'Andrei - Sophisticated and Empathetic',
      gender: 'male',
      preview: '',
      note: 'vřelý, přirozený',
    },
    {
      id: 'QtObtrglHRaER8xlDZsr',
      owner: '7b4ade2460d4015f3d1d0f0edfd28430981dedc8473137ac27ba334625af652a',
      name: 'Andreea - Joyful and Optimistic',
      gender: 'female',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/c3fc22eb8f254859a88f7a85e1c41377/voices/QtObtrglHRaER8xlDZsr/a2ad1e8b-4643-420c-b2b6-f619a6c41d8e.mp3',
      note: 'veselá, pro sociální sítě',
    },
    {
      id: '5asM3ZxsegvXfXI5vqKQ',
      owner: 'a441d3c418b709745a62838c232ac435766f49a0cf9eb801b2efb6cd707b1b56',
      name: 'Bogdan - Melancholic and Smooth',
      gender: 'male',
      preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/2fE1hRuXFjUFllADtpFlaNnqZCv2/voices/5asM3ZxsegvXfXI5vqKQ/WlshpjGzAl8BOGDEE6Qg.mp3',
      note: 'mladý, klidný',
    },
  ],
};

export const DEFAULT_VOICE: Record<Lang, string> = {cs: VOICE_CATALOG.cs[0].id, en: VOICE_CATALOG.en[0].id, ro: VOICE_CATALOG.ro[0].id};

export const findVoice = (id: string): LibVoice | undefined =>
  (Object.values(VOICE_CATALOG) as LibVoice[][]).flat().find((v) => v.id === id);

/** Zdarma hlasy Microsoft Edge (záloha, když nejsou kredity). */
export const EDGE_DEFAULT: Record<Lang, string> = {
  cs: 'cs-CZ-AntoninNeural',
  en: 'en-US-AndrewMultilingualNeural',
  ro: 'ro-RO-EmilNeural',
};
