// Vendored React Bits components (reactbits.dev, MIT) are untyped JSX — TS
// infers wrong prop shapes from their defaults (e.g. width must be a number).
// Funnel them through one loosely-typed barrel; the props tables live in each
// component file.
import type { ComponentType } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import GlassSurfaceJs from "./GlassSurface";
import GradualBlurJs from "./GradualBlur";
import LogoLoopJs from "./LogoLoop";
import SpecularButtonJs from "./SpecularButton";
import StrandsJs from "./Strands";

export const GlassSurface = GlassSurfaceJs as ComponentType<any>;
export const GradualBlur = GradualBlurJs as ComponentType<any>;
export const LogoLoop = LogoLoopJs as ComponentType<any>;
export const SpecularButton = SpecularButtonJs as ComponentType<any>;
export const Strands = StrandsJs as ComponentType<any>;
