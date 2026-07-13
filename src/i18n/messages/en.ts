/**
 * English message catalog — the CANONICAL shape. Every other locale is typed as
 * `Dictionary` (= `typeof en`), so TypeScript fails the build if any locale is
 * missing a key: 100% coverage of the translated surfaces is compiler-enforced.
 *
 * Brand names ("OpenDiscover", "AURORA", "biolab") and engine identifiers are
 * intentionally left untranslated.
 */
export const en = {
  nav: {
    lab: 'Lab',
    play: 'Play',
    challenge: 'Challenge',
    discover: 'Discover',
    gallery: 'Gallery',
    tv: 'TV',
    discoveries: 'Discoveries',
    about: 'About',
    signIn: 'Sign in',
    signOut: 'Sign out',
    language: 'Language',
    skipToContent: 'Skip to content',
  },
  footer: {
    tagline:
      'A deterministic in-silico biology lab you can play. 80 engines, plain-language help, and a watchable citizen-science game — every run reproduces byte-for-byte.',
    star: 'Star on GitHub',
    exploreTitle: 'Explore',
    projectTitle: 'Project',
    theLab: 'The Lab',
    playAurora: 'Play AURORA',
    dailyChallenge: 'Daily challenge',
    gallery: 'Gallery',
    labTv: 'Lab TV',
    about: 'About',
    discoveries: 'Discoveries',
    github: 'GitHub ↗',
    license: 'Code: MIT · Data & discoveries: CC-BY 4.0',
    disclaimer: 'In-silico results are models, not clinical or applied claims.',
  },
  dashboard: {
    reviewQueue: 'Review queue →',
    submissions: 'Submissions',
    discoveries: 'Discoveries',
    avgNovelty: 'Avg novelty',
    recentSubmissions: 'Recent submissions',
    noSubmissions: 'No submissions yet.',
    colProtocol: 'Protocol',
    colSliceKey: 'Slice key',
    colStatus: 'Status',
    colNovelty: 'Novelty',
    colDate: 'Date',
    colTracker: 'Tracker',
    track: 'Track →',
    yourDiscoveries: 'Your discoveries',
    novelty: 'novelty',
    rep: 'rep',
  },
};
