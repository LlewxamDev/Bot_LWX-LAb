export type GitHubProject = {
  name: string;
  description: string;
  url: string;
  homepage?: string;
  language: string;
};

export const githubProjects: GitHubProject[] = [
  {
    name: 'AegisHub',
    description: 'Security analyzer for GitHub repositories with Rust engine, secret detection, scoring, and React dashboard.',
    url: 'https://github.com/Lamarq7eYT/AegisHub',
    language: 'Rust',
  },
  {
    name: 'AegisCore',
    description: 'Hybrid TypeScript and Rust web-defense platform for auth, sessions, risk scoring, observability, and secure APIs.',
    url: 'https://github.com/Lamarq7eYT/AegisCore',
    language: 'TypeScript',
  },
  {
    name: 'Portf-lio',
    description: 'Cinematic TypeScript portfolio built with React, Vite, Three.js, GSAP, Framer Motion, and interactive scenes.',
    url: 'https://github.com/Lamarq7eYT/Portf-lio',
    language: 'TypeScript',
  },
  {
    name: 'HackerPage',
    description: 'Immersive Three.js web experience about hacker history, cybersecurity incidents, and digital investigation.',
    url: 'https://github.com/Lamarq7eYT/HackerPage',
    language: 'HTML',
  },
  {
    name: 'CalcASM',
    description: 'Assembly x86-64 calculator with browser-based instruction visualizer for registers, flags, stack, and operations.',
    url: 'https://github.com/Lamarq7eYT/CalcASM',
    language: 'JavaScript',
  },
  {
    name: 'WhiteHolewithASM',
    description: 'Experimental white hole visualization built with Windows x64 Assembly, OpenGL, GLSL shaders, and WebGL preview.',
    url: 'https://github.com/Lamarq7eYT/WhiteHolewithASM',
    language: 'Assembly',
  },
];
