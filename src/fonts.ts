import {loadFont as montserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as poppins} from '@remotion/google-fonts/Poppins';
import {loadFont as rubik} from '@remotion/google-fonts/Rubik';
import {loadFont as nunito} from '@remotion/google-fonts/Nunito';

// latin-ext = česká a rumunská diakritika
const opts = {weights: ['700', '800', '900'] as ('700' | '800' | '900')[], subsets: ['latin', 'latin-ext'] as ('latin' | 'latin-ext')[]};

export const {fontFamily} = montserrat('normal', opts);

export const FONTS = {
  montserrat: fontFamily,
  poppins: poppins('normal', opts).fontFamily,
  rubik: rubik('normal', opts).fontFamily,
  nunito: nunito('normal', opts).fontFamily,
};
export type FontKey = keyof typeof FONTS;
