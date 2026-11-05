import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
// WebGL v headless Chromiu – "angle" je doporučený renderer pro three.js
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
