/**
 * Plain-language help cards for the LAB ENGINES — the "?" on each engine page that
 * explains, with no background required, what the simulator models, why it matters, and
 * what to try. Same {@link HelpCard} shape as the challenge cards, keyed by engine slug.
 *
 * Generated then accuracy- and accessibility-VERIFIED from each engine description by the
 * engine-help-content generate->verify workflow (every card checked against the real model).
 * A test enforces that the prose is jargon-free (no equations or Greek symbols) and that
 * every registered engine has a card.
 */

import type { HelpCard } from './help-content';

/** Plain-language cards, keyed by engine slug. */
export const ENGINE_HELP: Record<string, HelpCard> = {
  izhikevich: {
    plainWhat:
      'This is a tiny model of a single brain cell, called a neuron. It copies the way a real neuron slowly builds up a charge and then suddenly "fires" a quick electrical pulse, called a spike, before resetting and starting all over again.',
    plainWhy:
      'Spikes are how brain cells send messages to one another, so they are the basic language of thinking, feeling and moving. With just a few dial settings, this one simple model can copy many real firing styles — steady tappers, fast chatterers, and cells that fire in bursts — which helps scientists understand the brain and build smarter computers inspired by it.',
    plainHow:
      'Try turning up the "current" — the push you give the cell — and watch the trace. With a gentle push the cell stays quiet, but past a tipping point it starts firing spikes over and over; push harder and it usually fires more often. The spike count and firing rate tell you how busy the cell is, and the regularity number tells you whether it fires like a steady metronome or in messy, uneven bursts.',
    terms: [
      {
        term: 'spike',
        meaning:
          'A quick electrical pulse a brain cell sends as its message; here it shows as a sharp jump in the trace.',
      },
      {
        term: 'membrane potential',
        meaning: "The tiny voltage across a cell's outer skin that builds up until the cell fires.",
      },
      { term: 'firing rate (Hz)', meaning: 'How many spikes happen each second.' },
      {
        term: 'regularity number',
        meaning:
          'A measure of how evenly spaced the spikes are: near zero means a steady, metronome-like beat; higher means uneven or bursty.',
      },
    ],
  },
  cloning: {
    plainWhat:
      'This is a pretend DNA workbench. It takes a strand of DNA, finds the exact spots where special "cutter" proteins snip it, and shows you the pieces you\'d get. It can also glue pieces back together where their ends overlap and match, which is how scientists build new stretches of DNA.',
    plainWhy:
      'Cutting DNA at chosen spots and stitching chosen pieces together is how people make things like insulin-producing cells, better crops, and medical tests. Doing it on a screen first lets you plan the real experiment and avoid wasting time and materials at the bench.',
    plainHow:
      'Pick one or more cutter proteins and watch how the DNA breaks into pieces. The main result is a list of piece sizes, drawn like the glowing bands on a real lab gel, biggest at the top. Try adding a second cutter or switching one out and watch the number of pieces and the band pattern change.',
    terms: [
      {
        term: 'restriction enzyme',
        meaning:
          'A protein that acts like tiny scissors, cutting DNA only where it finds one exact short run of letters.',
      },
      {
        term: 'overhang (sticky end)',
        meaning:
          'A short single-strand tail left at a cut end; ends whose tails or overlapping letters match can snap together like Velcro, which helps pieces join.',
      },
      {
        term: 'circular DNA (plasmid)',
        meaning: 'A DNA loop with no ends, like the ring-shaped DNA found inside many bacteria.',
      },
    ],
  },
  pcr: {
    plainWhat:
      'This is a virtual copy-machine for DNA. You give it a stretch of DNA and two short "search tag" snippets, and it works out which piece of the DNA would get copied and how long that piece is — plus how well those two tags are likely to behave in a real lab.',
    plainWhy:
      "Copying a chosen piece of DNA is one of the most-used tricks in all of biology and medicine — it's behind COVID tests, DNA fingerprinting at crime scenes, and checking for inherited diseases. Trying the tags on a computer first saves people the time, money, and guesswork of testing them for real.",
    plainHow:
      'Type in your own two short tag snippets, or leave them blank and let the tool design a matching pair for you. Then watch the "amplicon length" — that number tells you how big the copied piece would be. Keep an eye on the warnings too: they flag tags that might stick to themselves, fold up, or grip the DNA too differently from each other to work well together.',
    terms: [
      {
        term: 'Primer',
        meaning:
          'A short snippet of DNA that acts like a bookmark, telling the copy-machine where to start.',
      },
      {
        term: 'Amplicon',
        meaning:
          'The exact piece of DNA that ends up getting copied, sitting between the two bookmarks.',
      },
      {
        term: 'Melting temperature (Tm)',
        meaning:
          'How much heat it takes for a bookmark to let go of the DNA — a rough guide to how snugly it grips.',
      },
    ],
  },
  'mass-spec': {
    plainWhat:
      'This tool copies what a lab machine called a mass spectrometer does to a tiny piece of protein. It takes a short chain of protein building blocks (a peptide), imagines the chain being snapped apart at each link, and works out the exact weight of every broken piece.',
    plainWhy:
      'This is how scientists actually figure out which protein is in a sample, from disease research to reading what is in your blood or your food. Each protein leaves its own set of weights, like a fingerprint, so matching those weights back to a known chain tells you exactly what you are looking at.',
    plainHow:
      "Type a peptide using letters for its building blocks and watch the list of predicted piece-weights appear. Try making the chain longer, or swapping one letter for another, and notice how every weight shifts. The main number, the weight of the whole peptide, is the machine's first clue to what the protein is.",
    terms: [
      {
        term: 'peptide',
        meaning:
          'A short chain of protein building blocks joined in a row, like beads on a string.',
      },
      {
        term: 'b/y fragment ions',
        meaning:
          'The two kinds of broken pieces you get when the chain snaps at a link — one counted from each end of the chain.',
      },
      {
        term: 'm/z (mass-to-charge)',
        meaning:
          "The reading the machine actually gives each piece; it stands in for the piece's weight, and heavier pieces sit further along the scale.",
      },
    ],
  },
  properties: {
    plainWhat:
      "Type in a protein's sequence — the string of amino-acid building blocks that make it up — and this tool works out its basic physical traits, like how heavy it is, whether it's oily or water-loving, and how sturdy it is likely to be in a test tube. It's the same quick read-out that lab scientists get from a classic online tool before they ever touch a real sample.",
    plainWhy:
      'Proteins are the tiny machines that run every living thing, and knowing these basic traits helps scientists guess how a protein will behave before spending time and money in the lab — will it dissolve, stay in one piece, or fall apart? That saves effort when designing medicines, vaccines, and other useful proteins.',
    plainHow:
      'Paste a sequence and watch the summary: the "stability" read-out tells you whether this protein is likely to hold together or fall apart in a test tube. Try swapping in different amino-acid letters and watch the weight, the oiliness score, and the stability flag shift — and see the charge curve slide as you imagine the surrounding liquid turning more acidic or more basic.',
    terms: [
      {
        term: 'amino-acid sequence',
        meaning:
          'The ordered string of building blocks that spells out a protein, written as single letters.',
      },
      {
        term: 'isoelectric point (pI)',
        meaning:
          'The acidity level of the surrounding liquid at which the protein carries no overall electric charge.',
      },
      {
        term: 'GRAVY / hydropathy',
        meaning:
          'A score for how oily (water-avoiding) versus water-loving the protein tends to be.',
      },
    ],
  },
  'fitzhugh-nagumo': {
    plainWhat:
      'This is a simple model of a single nerve cell and how it "fires" — the quick electrical pulse brain cells and heart cells use to send signals. It\'s a stripped-down stand-in for the real thing that still captures the important behavior: a cell that mostly sits quietly but can suddenly jump to life.',
    plainWhy:
      'Firing pulses like these are how your brain thinks, your nerves feel, and your heart keeps beating. Seeing when a cell stays calm, fires once, or fires over and over helps people understand how living tissue passes messages — and what can go wrong when that rhythm breaks.',
    plainHow:
      'Try slowly turning up the input current (the steady "push" on the cell) and watch the wiggly line. With a gentle push the cell settles quietly. Turn it up and it starts firing spike after spike, like a steady heartbeat. Push it too hard and, surprisingly, it goes quiet again. The firing rate readout tells you how fast it\'s pulsing.',
    terms: [
      {
        term: 'input current',
        meaning:
          'the steady electrical push given to the cell — the main dial you change to make it fire or rest',
      },
      {
        term: 'firing / spike',
        meaning: "a quick jump-and-drop in the cell's voltage, the pulse it uses to send a signal",
      },
      {
        term: 'phase portrait',
        meaning:
          "a second picture that plots the cell's voltage against its recovery; a closed loop means it's firing over and over",
      },
    ],
  },
  'two-state-folding': {
    plainWhat:
      'Proteins are tiny living machines that only work when they are folded into just the right shape. This lab shows how a protein flips between its neat folded shape and a loose, useless unfolded one as you heat it up or cool it down.',
    plainWhy:
      'Whether a protein stays folded decides if it can do its job in your body, in medicines, or in food. Knowing the temperature where it falls apart helps scientists design sturdier drugs and understand why some things spoil or stop working when they get too hot or too cold.',
    plainHow:
      'Try dragging the melting temperature up or down and watch the "fraction folded" curve slide with it. The surprise: the protein comes apart when it gets too hot AND when it gets too cold, with a sweet spot of best sturdiness somewhere in between. The main number to watch is how much of the protein stays folded at room temperature.',
    terms: [
      {
        term: 'melting temperature',
        meaning:
          'The temperature where exactly half the protein has come unfolded — a handy marker of how sturdy it is.',
      },
      {
        term: 'fraction folded',
        meaning:
          'How much of the protein is still in its working shape, from all of it (1) down to none of it (0).',
      },
      {
        term: 'cold denaturation',
        meaning:
          'The surprising way a protein can also fall apart when it gets too cold, not just when it gets too hot.',
      },
    ],
  },
  crispr: {
    plainWhat:
      'This is a planner for gene editing. You paste in a stretch of DNA, and it finds the best spots where a molecular "scissors" tool (like the famous CRISPR system) can grab on and make a cut, then hands you a short matching "address tag" of RNA that guides the scissors to exactly that spot.',
    plainWhy:
      'Being able to change one exact letter of DNA is how scientists study genes, grow hardier crops, and build new treatments for diseases like sickle-cell. The catch is that the scissors can accidentally cut similar-looking spots elsewhere, so picking a guide that hits its one target and nothing else is the whole ballgame.',
    plainHow:
      'Paste a DNA sequence and switch the enzyme between the two options to watch the list of possible cut sites change. For each candidate you get two headline numbers: how well it should cut its intended spot, and how "unique" it is (a high score means it is unlikely to snip anywhere else). Chase a guide that scores high on both, since the best picks are the ones that do well on each.',
    terms: [
      {
        term: 'CRISPR',
        meaning:
          'A natural tool, borrowed from bacteria, that scientists use like programmable scissors to cut DNA at a chosen spot.',
      },
      {
        term: 'guide RNA',
        meaning:
          'A short tag that matches one spot in the DNA and steers the scissors there, like typing an address into a map.',
      },
      {
        term: 'PAM',
        meaning:
          'A tiny landmark sequence right next to the target; the scissors can only grab on where one of these is present.',
      },
    ],
  },
  alignment: {
    plainWhat:
      'This lab lines up two strings of letters that stand for the building blocks of DNA, RNA, or proteins, and slides them past each other to find the best way they overlap. Where the letters match, the two sequences share something in common.',
    plainWhy:
      'Comparing sequences is how scientists tell whether two living things are related, spot the part of a gene that a harmful mutation changed, or find the shared piece two proteins use to do the same job. It is one of the everyday workhorse tools of modern biology and medicine.',
    plainHow:
      "Paste in two sequences and watch the two lined-up rows appear, with a bar under every spot where the letters agree. The identity number tells you what share of the lined-up spots actually match, so higher means the two are more alike. Try switching from 'global' (match them end to end) to 'local' (find just the single best-matching stretch) and see how the answer changes when the sequences are only partly similar.",
    terms: [
      {
        term: 'gap',
        meaning:
          'A little space added into one sequence so the rest of the letters can line up better, standing for a missing or extra piece.',
      },
      {
        term: 'identity',
        meaning: 'How much of the lined-up region actually matches, shown as a percentage.',
      },
      {
        term: 'local vs global',
        meaning:
          'Global lines the two sequences up from start to finish; local hunts for just the single best-matching stretch inside them.',
      },
    ],
  },
  'hp-folding': {
    plainWhat:
      'A protein is a long chain of beads that folds up into a specific shape. This is a simple puzzle version of that: some beads are "water-fearing" and some are "water-loving," and the model hunts for the neatly folded shape where the water-fearing beads cluster together in the middle, tucked away from the surrounding water.',
    plainWhy:
      "The shape a protein folds into decides what it does in your body, and misfolding is behind diseases like Alzheimer's. This stripped-down puzzle lets anyone see the core idea of why chains fold the way they do, which is one of biology's biggest open questions.",
    plainHow:
      'Type a string of H and P beads and press run to watch it fold. You\'ll get two numbers. One is a count of how many water-fearing beads ended up touching in the folded shape. The other is an "energy" score that slides further and further below zero as more of those touches pile up, so a lower score means a tighter, more stable fold. Try giving it more steps, or moving the H beads to different spots in your string, and watch how the final packed shape and its scores change.',
    terms: [
      {
        term: 'H (hydrophobic)',
        meaning:
          'A water-fearing bead that wants to hide in the middle of the fold, away from water.',
      },
      {
        term: 'P (polar)',
        meaning: 'A water-loving bead that is happy sitting on the outside, in the water.',
      },
      {
        term: 'contact',
        meaning:
          "Two water-fearing beads that end up side by side in the folded shape but aren't already joined next to each other along the chain; more contacts means a tighter, more stable fold.",
      },
      {
        term: 'energy score',
        meaning:
          'A number that drops one step below zero for every touch between water-fearing beads; the lower it goes, the better and more stable the fold.',
      },
    ],
  },
  grn: {
    plainWhat:
      "Genes inside a cell can switch each other on and off, like tiny circuits. This lab lets you wire up a few genes and watch how much of each one's protein the cell makes over time.",
    plainWhy:
      'These gene circuits are how living cells make decisions, keep time, and remember which "mode" they\'re in. Understanding and building them is the heart of synthetic biology, from bacteria that sense disease to cells engineered to make medicine.',
    plainHow:
      'Start with the "repressilator" circuit, where three genes take turns silencing each other, and watch the three protein levels rise and fall in a steady rhythm, like a built-in clock. Then try the "toggle switch": nudge which gene starts higher and watch the whole circuit lock into one winner and stay there, a cellular memory. The chart shows each protein\'s amount over time, telling you whether the circuit ticks like a clock, flips like a switch, or just settles down.',
    terms: [
      {
        term: 'gene',
        meaning: 'A single instruction in a cell that tells it to make a specific protein.',
      },
      { term: 'repressor', meaning: 'A protein that turns another gene down or off.' },
      {
        term: 'protein concentration',
        meaning: "How much of a gene's product is floating in the cell right now.",
      },
    ],
  },
  'enzyme-kinetics': {
    plainWhat:
      'Enzymes are tiny helpers in your body and in every living thing that speed up chemical reactions, like turning food into energy. This lab shows how fast an enzyme does its job as you give it more and more raw material to work on, and what happens when a blocker gets in the way.',
    plainWhy:
      'Almost everything alive runs on enzymes, and most medicines work by slowing a chosen enzyme down. Understanding how fast enzymes work, and how blockers slow them, is the same thinking used to design real drugs.',
    plainHow:
      'Try slowly increasing the amount of raw material and watch the speed climb fast at first, then flatten out as the enzyme gets as busy as it can ever be. Then add a blocker and see the curve change: the top speed tells you how fast the enzyme can go flat out, and the "half-speed point" tells you how much material it takes to get it working at half that pace.',
    terms: [
      {
        term: 'Substrate',
        meaning:
          'The raw material an enzyme works on, like the ingredient it turns into something new',
      },
      {
        term: 'Top speed (Vmax)',
        meaning:
          "The fastest an enzyme can work once it is completely swamped with material and can't go any quicker",
      },
      {
        term: 'Inhibitor',
        meaning:
          "A blocker that gets in the enzyme's way and slows it down, the way many medicines do",
      },
    ],
  },
  sequence: {
    plainWhat:
      'This is a reading desk for the code inside living things. You paste in a strand of DNA, RNA, or a protein, and it tells you what that string of letters actually spells out and how it behaves.',
    plainWhy:
      'DNA is the instruction book every cell follows to build the tiny protein machines that keep us alive. Being able to read it, find the "start here" signals, and turn it into the protein it makes is the everyday groundwork behind medicine, vaccines, and understanding how life works.',
    plainHow:
      'Paste a DNA sequence and watch it hunt down every stretch that could be a real gene, then spell out the protein the longest one would build. Try making your sequence richer in the letters G and C and see the melting temperature climb, since those two letters grip the twin strands together more tightly.',
    terms: [
      {
        term: 'DNA / RNA',
        meaning:
          "The chain of chemical letters (A, C, G, T, and U) that stores and carries a cell's instructions.",
      },
      {
        term: 'Protein',
        meaning: 'The working machine a cell builds by following a stretch of those instructions.',
      },
      {
        term: 'ORF (reading frame)',
        meaning:
          "A run of code with a clear 'start' and 'stop', marking a piece that could actually be turned into a protein.",
      },
      {
        term: 'Melting temperature',
        meaning:
          'How much heat it takes to pull the two strands of DNA apart; strands rich in G and C hold on tighter, so they need more heat.',
      },
    ],
  },
  'resting-potential': {
    plainWhat:
      'Every living cell holds a tiny electrical charge across its thin outer skin, a bit like a tiny battery. This lab works out how strong that voltage is, using the amounts of salty particles inside and outside the cell and how easily each kind can slip through the skin.',
    plainWhy:
      "This little voltage is what lets your nerves fire, your heart beat, and your muscles move. When the balance of salts goes wrong (for example, too much potassium in the blood), that voltage shifts and can become dangerous, so understanding it helps explain how the body works and what happens when it doesn't.",
    plainHow:
      "Try raising the potassium outside the cell and watch the resting voltage climb toward zero. The main number, the resting potential, tells you how charged the cell's battery is, and the graph shows how that battery weakens as potassium builds up outside, the same thing that makes high blood potassium risky.",
    terms: [
      {
        term: 'resting potential',
        meaning:
          'The steady voltage a calm cell holds across its outer skin, measured in millivolts (thousandths of a volt).',
      },
      {
        term: 'potassium / sodium / chloride',
        meaning:
          'The three main salty particles whose amounts inside and outside the cell set the voltage.',
      },
      {
        term: 'permeability',
        meaning:
          "How easily a particular particle can slip through the cell's skin; the easier one passes, the more it decides the voltage.",
      },
    ],
  },
  'wilson-cowan': {
    plainWhat:
      'This models how big teams of brain cells behave together, instead of tracking one cell at a time. There are two teams: an "on" team that excites activity and an "off" team that calms it down, and each one nudges itself and the other.',
    plainWhy:
      'This tug-of-war between the "on" and "off" teams is where the brain\'s natural rhythms come from — the steady waves of activity that show up when you think, focus, or sleep. Understanding it helps scientists make sense of healthy brain rhythms and what goes wrong in conditions like epilepsy.',
    plainHow:
      'Try turning up the outside push on the "on" team and watch the main result: the two curves may quietly settle to a steady level, or they may start chasing each other up and down forever in a repeating rhythm. When it says "sustained oscillation," you\'ve found a brain-like rhythm; the period tells you how long each repeat takes.',
    terms: [
      {
        term: 'excitatory / inhibitory',
        meaning: 'The two teams of brain cells: one revs activity up, the other quiets it down.',
      },
      {
        term: 'limit cycle',
        meaning:
          'A rhythm that keeps repeating on its own instead of fading away or settling flat.',
      },
      {
        term: 'fixed point',
        meaning: 'A calm steady state where activity stops changing and holds still.',
      },
    ],
  },
  'secondary-structure': {
    plainWhat:
      'Proteins are long chains built from 20 kinds of building blocks called amino acids, and those chains fold into little shapes. This tool reads the order of building blocks you type in and guesses which parts of the chain twist into a spiral, which parts lie flat and stretched-out, and which parts stay loose and floppy. It also spots short spots where the chain makes a sharp bend to double back on itself.',
    plainWhy:
      'The shape a protein folds into is what lets it do its job, whether that is fighting germs, carrying oxygen, or digesting food. Getting a quick first sketch of that shape from just the sequence of building blocks helps scientists, students, and curious people understand how a protein might work. It is a rough first guess, not the final word, but it is a fast and useful starting point.',
    plainHow:
      'Type a protein sequence (or use the example) and watch the colored map: it labels every spot as a spiral (H), a flat stretch (E), or loose (C), tells you what share of the chain is each, and counts how many sharp bends it found. Try swapping in different building blocks and see how spiral-loving ones grow the spiral regions while others turn them flat or floppy.',
    terms: [
      {
        term: 'amino acid',
        meaning:
          'One of the 20 building blocks that link up in a row to make a protein; each is written as a single letter.',
      },
      { term: 'helix (H)', meaning: 'A part of the chain that coils up like a spiral staircase.' },
      {
        term: 'sheet (E)',
        meaning:
          'A part of the chain that lies flat and stretched out, often lining up side by side like pleats.',
      },
      {
        term: 'coil (C)',
        meaning: 'A part of the chain that stays loose and floppy, without a set shape.',
      },
      {
        term: 'turn (beta-turn)',
        meaning: 'A short spot where the chain makes a sharp bend and folds back on itself.',
      },
    ],
  },
  'hodgkin-huxley': {
    plainWhat:
      'This models how a single nerve cell fires an electrical "spike" — the tiny voltage pulse your brain and nerves use to send messages. It recreates the famous experiment on a squid\'s giant nerve fiber that first explained how these pulses work.',
    plainWhy:
      'Every thought, heartbeat, and muscle twitch depends on nerve cells firing these pulses. Understanding them is the foundation of brain science, and it helps explain how nerves carry signals, and why some medicines and diseases change the way they work.',
    plainHow:
      'Try turning up the "stimulus current" — the electric nudge you give the cell — and watch the membrane potential trace. Below a certain nudge, nothing much happens: just a small bump that fades. Push past the tipping point and the cell suddenly fires a full spike. Keep the nudge switched on for longer, and the cell fires again and again in a steady rhythm. The count of spikes and how fast they fire tells you how strongly the cell is responding.',
    terms: [
      {
        term: 'membrane potential',
        meaning:
          "The tiny voltage difference across a nerve cell's outer skin — it jumps up sharply when the cell fires.",
      },
      {
        term: 'action potential',
        meaning:
          "The full electrical 'spike' a nerve cell fires to pass a message along — it either happens fully or not at all.",
      },
      {
        term: 'ion channels',
        meaning:
          "Tiny gates in the cell's surface that open and close to let charged particles in and out, creating the spike.",
      },
    ],
  },
  'metabolic-pathway': {
    plainWhat:
      'Inside every living cell, food gets passed down an assembly line: one worker changes it a little, hands it to the next worker, and so on until you get the finished product. This lab follows that assembly line moment by moment, watching how much of each half-finished piece builds up over time and how fast the whole line ends up running.',
    plainWhy:
      'These cell assembly lines are how living things turn food into energy and the parts they need to grow. Understanding where a line speeds up or clogs helps scientists design better medicines, brew and ferment things, and grow cells that make useful stuff like fuels or drugs.',
    plainHow:
      "Give each worker on the line a top speed, then hit run and watch the half-finished pieces fill up until the whole line settles into a steady, unchanging pace. Try lowering just one worker's top speed and see the line's throughput drop to match them — the lab even points out that worker as your bottleneck, the step whose top speed sets the pace for everyone else.",
    terms: [
      {
        term: 'flux',
        meaning:
          "How much material flows through the line each moment — the line's throughput, or how busy it is.",
      },
      {
        term: 'steady state',
        meaning:
          'When the line has settled into a smooth, unchanging pace and the amounts stop rising or falling.',
      },
      {
        term: 'bottleneck',
        meaning:
          'The step with the lowest top speed, which limits how fast the whole line can go no matter how fast the others are.',
      },
    ],
  },
  'branching-growth': {
    plainWhat:
      'This is a game of chance played out by a tiny group of living cells, like a small clump that could grow into a tumor or a patch of stem cells. Each round, every cell flips its own private coin: it either dies, sits still and does nothing, or splits into two.',
    plainWhy:
      'The same simple rule decides whether a handful of cells fizzles out and disappears, or takes off and keeps growing without stopping, which is exactly the difference between a threat your body clears on its own and one that keeps spreading. Because every cell decides on its own, luck matters most when the group is very small, so understanding it helps make sense of how cancers can start and how living things survive their fragile early days.',
    plainHow:
      'Nudge the "divide" chance up a little and watch the population line curve upward and take off, then nudge it down and watch the cells dwindle toward zero. Because chance is involved, the lab runs the whole story many times over and shows you the average, next to the prediction the math makes. The headline number to watch is the chance the whole group dies out completely: it tells you whether this little colony is doomed to vanish or likely to keep growing.',
    terms: [
      {
        term: 'generation',
        meaning: 'One round where every cell takes its turn to die, stay, or split.',
      },
      {
        term: 'extinction probability',
        meaning:
          'The chance the whole group of cells eventually dies out and disappears completely.',
      },
      {
        term: 'mean offspring',
        meaning:
          'The average number of cells each cell leaves behind for the next round; above one tends to grow, below one tends to fade.',
      },
    ],
  },
  'wright-fisher': {
    plainWhat:
      'This models how a gene comes in two versions inside a group of living things, and how the mix of those two versions shifts from one generation to the next. Because only a limited number of offspring are born each round, luck alone can slowly make one version more common until it takes over completely or vanishes for good.',
    plainWhy:
      'This is how new traits spread through a population, or quietly disappear, over many generations. It helps explain why small groups lose their variety faster, and it underpins how scientists study evolution, protect endangered species, and understand how living things change over time.',
    plainHow:
      'Try shrinking the group size and watch how much faster one gene version wins out purely by chance. Then give one version a survival advantage, or start it out more or less common, and watch the "fixation" number, which is the share of test runs where that version completely took over.',
    terms: [
      {
        term: 'allele',
        meaning: 'One of the two versions a gene can come in, like two spellings of the same word.',
      },
      {
        term: 'genetic drift',
        meaning:
          'Random shifts in how common a gene version is, just from the luck of who happens to have offspring.',
      },
      {
        term: 'fixation',
        meaning:
          'When one gene version becomes the only one left, and the other has completely disappeared.',
      },
    ],
  },
  fba: {
    plainWhat:
      'This models the chemistry inside a tiny living cell, like a bacterium. Food comes in, gets passed along a web of little chemical steps, and the cell uses it to grow. The lab works out how fast every step can run at the same time so that nothing piles up and nothing runs dry, then finds the very fastest the cell could grow.',
    plainWhy:
      'This is how scientists predict how fast microbes grow and what they can make. It helps design bacteria and yeast that brew medicines, fuels, and foods, and it helps us understand how living cells feed themselves.',
    plainHow:
      "Try lowering the food supply (the glucose uptake cap) and watch the growth number drop. In the built-in example, feeding half as much food gives half as much growth. The main result, the growth flux, tells you the fastest the cell could possibly grow with the food and limits you gave it. If you set things up so the cell can't work at all, the growth simply comes back as zero.",
    terms: [
      { term: 'flux', meaning: 'How fast a single chemical step runs inside the cell.' },
      {
        term: 'steady state',
        meaning:
          'A balanced setup where every ingredient is made exactly as fast as it is used up, so nothing builds up or runs out.',
      },
      {
        term: 'objective / biomass',
        meaning: 'The thing the cell is trying to do most of — here, grow as much as possible.',
      },
      {
        term: 'glucose uptake cap',
        meaning:
          'The most food (sugar) the cell is allowed to take in — the main limit you can turn up or down.',
      },
    ],
  },
  kuramoto: {
    plainWhat:
      'This models how a crowd of things that each keep their own rhythm can suddenly fall into step together, like a field of fireflies ending up flashing all at once, heart-pacemaker cells beating as one, or an audience drifting into synchronized clapping.',
    plainWhy:
      'Getting in sync (or failing to) shows up everywhere that matters to us: a steady heartbeat, sleep clocks in the brain, power grids staying in time. Understanding when a group locks together helps explain both healthy rhythms and glitches.',
    plainHow:
      'Turn up the "coupling" slider (how strongly each member pays attention to the others) and watch the coherence line climb from near zero toward one. That line tells you how in-step the crowd is: nudge coupling past the tipping point and a scattered group snaps into a shared beat.',
    terms: [
      {
        term: 'coherence',
        meaning:
          'A score from 0 to 1 for how in-step the group is: 0 means everyone does their own thing, 1 means perfectly together.',
      },
      {
        term: 'coupling',
        meaning: 'How strongly each member tunes its rhythm to the rest of the crowd.',
      },
      {
        term: 'critical coupling',
        meaning:
          'The tipping-point strength: below it the crowd stays scattered, above it they start to sync.',
      },
    ],
  },
  phylogenetics: {
    plainWhat:
      'This tool builds a family tree for living things by comparing their genetic code. You give it the same stretch of code read from a few different species, lined up letter by letter, and it works out who is most closely related to whom.',
    plainWhy:
      'Comparing genetic code is how scientists figure out how life on Earth is connected, trace where a virus came from, and see how creatures changed over millions of years. It turns tiny spelling differences in genes into a picture of the branches of life.',
    plainHow:
      'Paste in a few sequences and watch it draw the tree: species whose code barely differs sit on nearby branches, while big differences push them far apart. Try switching the tree-building method (Neighbor-Joining or UPGMA) and watch the branches rearrange, and check the "tree height" to see how much change has piled up along the longest path from the root out to a tip.',
    terms: [
      {
        term: 'nucleotide sequence',
        meaning:
          'A stretch of genetic code, written as a string of letters (A, C, G, and T) that spells out the instructions inside living things. This works for DNA or RNA.',
      },
      {
        term: 'branch length',
        meaning:
          'How much genetic change happened along a branch of the tree; longer means more differences piled up.',
      },
      {
        term: 'Newick',
        meaning:
          'A compact text format that writes out the whole tree as one line, so a computer can store or redraw it.',
      },
    ],
  },
  'hardy-weinberg': {
    plainWhat:
      'Living things carry two copies of each gene, and each copy can come in different versions. You tell this tool how many individuals in a group carry each combination of versions. It then works out whether the group looks like one where partners pair up completely at random.',
    plainWhy:
      'When a group drifts away from that "random pairing" pattern, it\'s a clue that something interesting is happening: perhaps relatives are pairing up with relatives, the group is really two separate groups mixed together, or nature is quietly favoring one version over another. Spotting that helps scientists study wildlife, conservation, and human health.',
    plainHow:
      'Type in how many individuals you counted with each gene combination, then watch the "departs from random mating" result. Try piling everyone into the two matched-pair groups and leaving hardly any in the mixed group, and you\'ll see the score jump, which means the group no longer looks like random pairing.',
    terms: [
      {
        term: 'heterozygosity',
        meaning:
          'How common it is to carry two different versions of the gene rather than two matching ones.',
      },
      {
        term: 'inbreeding coefficient',
        meaning:
          "A number that rises when relatives pair up, leaving fewer individuals with two mismatched gene versions than you'd expect.",
      },
      {
        term: 'chi-square test',
        meaning:
          'A standard yes/no math check for whether the real counts stray further from the expected pattern than plain chance would explain.',
      },
    ],
  },
  'moran-process': {
    plainWhat:
      'Imagine a small crowd of living things that always stays the same size, where one new kind (a mutant) has just appeared among the usual kind. Over and over, one random individual has a baby and one random individual dies, so the head count never changes. This lab follows how the number of the new kind wanders up and down by pure chance, with a gentle push in its favour if it happens to be better at having babies.',
    plainWhy:
      'This is how a brand-new trait either takes over a whole group or disappears for good. It helps explain why even a helpful change can vanish through bad luck, and why an ordinary one can sometimes spread everywhere. That tug-of-war between luck and advantage sits right at the heart of how living things evolve.',
    plainHow:
      'Try turning up how good the new kind is at having babies and watch the "fixation probability" climb, that is the chance the new kind eventually fills the whole crowd. Then shrink the crowd and see how much more the outcome is left to pure luck. The lab shows both an exact calculated chance and the result of running many random trials, so you can watch the two agree.',
    terms: [
      {
        term: 'mutant',
        meaning: 'An individual of the new kind, different from the usual ones in the crowd',
      },
      {
        term: 'fixation',
        meaning: 'When the new kind spreads to every single individual, taking over completely',
      },
      {
        term: 'relative fitness',
        meaning:
          'How good the new kind is at having offspring compared to the usual kind; above 1 means better, below 1 means worse, exactly 1 means no difference',
      },
    ],
  },
  'luria-delbruck': {
    plainWhat:
      'This recreates a famous 1943 experiment with bacteria. You grow lots of separate little dishes of the same germs, then hit each dish with a virus that only a few "resistant" germs can survive, and count how many survivors are in every dish.',
    plainWhy:
      'It answered a huge question: do living things change randomly by luck, or only because their surroundings force them to? The surprising answer here — that the change happens by chance, all on its own, before the danger ever shows up — is a cornerstone of how we understand evolution, and why germs turn resistant to the things meant to kill them.',
    plainHow:
      'Watch the "variance-to-mean ratio." If survivors only popped up at the last second when the virus arrived, every dish would have a similar count and that number would sit near 1. Instead you get a few wild "jackpot" dishes with huge numbers, which pushes the ratio way above 1 — proof the change happened early and by luck. Try raising the number of dishes or the chance of a change, and watch how big the biggest jackpot gets.',
    terms: [
      {
        term: 'resistant mutant',
        meaning: 'A germ that, purely by chance, can survive the thing that kills the others.',
      },
      {
        term: 'jackpot',
        meaning:
          'A dish with a giant number of survivors, because one lucky change happened early and all its offspring inherited it.',
      },
      {
        term: 'variance-to-mean ratio',
        meaning:
          'A number showing how uneven the dish-to-dish counts are; far above 1 means the changes were early and driven by chance, near 1 would mean they were forced by the virus.',
      },
    ],
  },
  'lotka-volterra': {
    plainWhat:
      'This models how two animal populations rise and fall together over time: a prey animal (like rabbits) and the predator that eats it (like foxes). More rabbits feed more foxes, more foxes eat down the rabbits, then the foxes go hungry and fade, and the rabbits bounce back, over and over.',
    plainWhy:
      'Understanding these boom-and-bust cycles helps people manage wildlife, fisheries, and pests. It even explains a surprise: spraying to kill a pest and its natural enemy at once can end up leaving you with MORE pests on average, because you also wiped out what was keeping them in check.',
    plainHow:
      "Try bumping up how fast the prey breed, or how hard the predator hits, then watch the two population lines swing up and down like a chase that never quite ends. Each population has its own balance point that it keeps circling around — and here's the neat part: if you average a population over a full set of ups and downs, that average lands right on its own balance point.",
    terms: [
      {
        term: 'equilibrium',
        meaning:
          'The balance point a population hovers around as it rises and falls, never staying still but always circling back to it.',
      },
      {
        term: 'orbit (cycle)',
        meaning:
          'The repeating loop of the two populations going up and down in turn, like a wheel that keeps coming back to where it started.',
      },
    ],
  },
  gillespie: {
    plainWhat:
      "This models how tiny groups of things bump into each other and change, one event at a time, when the numbers are so small that pure luck matters. It comes ready with three stories: things being born and dying, foxes chasing rabbits, and a gene flicking on and off to make little bursts of a cell's working parts.",
    plainWhy:
      'Inside a living cell there are often just a handful of copies of something, so chance really shakes the outcome — two identical cells can end up quite different. Seeing that randomness helps scientists understand why life is noisy and how cells cope with it.',
    plainHow:
      'Pick the foxes-and-rabbits story and watch the two lines swing up and down in wobbly, uneven waves — sometimes a population even crashes to zero and stays there for good. Try the birth-and-death story instead and change the birth rate: the headline "mean" number tells you roughly how many copies stick around once things settle down. Keep the same seed and you get the exact same run every time, so you can compare fairly.',
    terms: [
      {
        term: 'molecule count',
        meaning:
          'How many copies of a thing there are right now, always a whole number like 0, 1, 2.',
      },
      {
        term: 'seed',
        meaning:
          'A starting number for the dice roll; the same seed replays the exact same random run.',
      },
      {
        term: 'absorbing state',
        meaning:
          'A dead end where nothing can change anymore, like a population that has hit zero.',
      },
    ],
  },
  'ewens-sampling': {
    plainWhat:
      "Imagine scooping up a handful of living things from one population and reading a tiny matching piece of their DNA. Over time, random copying mistakes create brand-new versions of a gene, and this tool predicts how that handful splits into different versions — how many kinds you'd expect to see, and how common or rare each one is.",
    plainWhy:
      "It gives scientists a baseline for what pure chance and plain mutation look like, with no survival advantage helping any version win. When real DNA doesn't match this prediction, that's a clue something interesting is going on — like a trait being favored, or a population that recently shrank or boomed.",
    plainHow:
      'Try turning up the mutation-rate dial and watch the "expected number of alleles" climb — faster mutation means more distinct versions in your sample, and more of them showing up as one-of-a-kind rarities. Turn it down and the handful collapses toward just a few shared versions. The "homozygosity" number tells you the chance that two random picks from the sample carry the very same version.',
    terms: [
      {
        term: 'allele',
        meaning:
          'One particular version of a gene; different individuals can carry different versions.',
      },
      {
        term: 'homozygosity',
        meaning:
          'The chance that two random picks from your sample happen to carry the exact same version of the gene.',
      },
      {
        term: 'scaled mutation rate',
        meaning:
          'A single dial combining how big the population is and how often new gene versions appear; higher means more variety.',
      },
    ],
  },
  coalescent: {
    plainWhat:
      'Take a small group of living things of the same kind and trace their family trees backwards in time. This tool works out, on average, how those separate family lines join up as you go further back, until they all meet at a single shared ancestor that every one of them is descended from.',
    plainWhy:
      'The pattern of shared ancestors gets written into DNA over time. By knowing what a normal family tree should look like, scientists can read the small differences between individuals to estimate how big a population was, how varied and healthy it is, and whether something unusual (like a recent disaster or a helpful trait spreading quickly) has left its mark on the group.',
    plainHow:
      'Try raising the sample size (how many individuals you pick) and watch the "time to shared ancestor" number: past a point it barely grows, because the very last two family lines to join take about half of the whole wait all on their own, no matter how many you started with. Then nudge the variation dial up and watch the expected number of DNA differences climb right alongside it.',
    terms: [
      {
        term: 'shared ancestor',
        meaning:
          'The single individual, far back in time, that every member of your sample is descended from.',
      },
      {
        term: 'segregating sites',
        meaning:
          'Spots in the DNA where individuals in the group differ from one another; more of them means more variety.',
      },
      {
        term: 'sample size',
        meaning: 'How many individuals you pick to study the family tree of.',
      },
      {
        term: 'variation dial',
        meaning:
          'A setting for how much genetic change builds up in the group; turning it up means more DNA differences to find.',
      },
    ],
  },
  breeding: {
    plainWhat:
      'This is a virtual breeding lab for plants and animals. You pick two parents and the traits they carry (like round or wrinkled seeds, or coat colour), then it works out every kind of baby they could have and how likely each one is. It even hands you a batch of made-up offspring to look at, one by one.',
    plainWhy:
      'Guessing which traits get passed on is the heart of gardening, farming, and understanding how families inherit features like eye colour or certain health conditions. This lets anyone see those odds in seconds, without waiting years for real plants or animals to grow up.',
    plainHow:
      'Give each parent their traits, then watch the "most common" baby and the whole mix of babies change. For a trait where one version simply wins, you get a lopsided split with two kinds of baby. Now switch that trait so the two versions blend in the middle instead: you get three kinds of baby, and the in-between blend actually turns out to be the most common one of all.',
    terms: [
      {
        term: 'allele',
        meaning:
          "One version of a trait a parent can pass down, like the 'round' or the 'wrinkled' option for seeds.",
      },
      {
        term: 'dominant / recessive',
        meaning:
          'A dominant version shows up even if only one parent gives it; a recessive one only shows when both parents give it.',
      },
      {
        term: 'mutation rate',
        meaning:
          'A small chance that a passed-down trait randomly flips to a different version, but only in the sample babies shown, not in the overall odds.',
      },
    ],
  },
  'logistic-map': {
    plainWhat:
      "This is a super-simple make-believe of an animal population that grows year after year but gets held back by crowding once it gets too big. Each new year's count depends only on last year's, worked out with one short rule used again and again.",
    plainWhy:
      'It shows a surprising truth: even the simplest rule can produce wildly unpredictable results. This helped scientists understand why some populations settle on a steady number, some bounce between a few values, and others swing about with no pattern at all — a big idea behind the study of chaos.',
    plainHow:
      'Slowly turn up the growth dial and watch the picture change: at low settings the population settles on one steady number, then it starts flipping between two, then four, and past about 3.57 it scatters into a fuzzy, never-repeating mess. The "chaotic" readout flips to yes once tiny changes in the starting point start leading to totally different futures.',
    terms: [
      {
        term: 'growth dial (r)',
        meaning:
          'How hard the population tries to grow each year; turning it higher pushes the model from calm to chaotic.',
      },
      {
        term: 'chaos',
        meaning:
          'When the numbers never settle into a repeating pattern, and a tiny change at the start leads somewhere completely different.',
      },
      {
        term: 'bifurcation diagram',
        meaning:
          'The map-like picture showing which population values you end up with for every setting of the growth dial.',
      },
    ],
  },
  'rock-paper-scissors': {
    plainWhat:
      'This models a game of rock-paper-scissors played by a whole population instead of two people. Each of the three moves beats one and loses to another, going in a circle, and this same loop really happens in nature, like three types of male lizards that keep taking turns being the most common.',
    plainWhy:
      'When no move can ever fully win, none of the three ever disappears, and this endless circle is one way nature keeps different types alive together instead of one crowding out the rest.',
    plainHow:
      'Try making a win worth more than a loss hurts, and watch the mix settle down toward an even three-way split. Then make a loss hurt more than a win is worth, and watch the swings grow bigger until one move nearly takes over before the circle flips again. The numbers tell you whether the population calms down, holds steady in endless loops, or swings wilder over time.',
    terms: [
      {
        term: 'frequency',
        meaning: "the share of the population currently playing one move, like 'half play rock'",
      },
      {
        term: 'cyclic dominance',
        meaning:
          'a rock-paper-scissors loop where each choice beats one other and loses to another, so there is no overall winner',
      },
      {
        term: 'equilibrium',
        meaning:
          'the balanced point where all three moves are equally common, so nothing pulls the mix toward one move or another',
      },
    ],
  },
  'substrate-inhibition': {
    plainWhat:
      "It models how fast tiny living things (microbes) grow when they feed on a chemical that helps them at first but becomes poisonous when there's too much of it. So as you add more food, growth speeds up, hits a sweet spot, then actually slows down again.",
    plainWhy:
      'Lots of real jobs rely on microbes eating things that turn toxic in big doses, like cleaning pollution out of water or breaking down chemical waste. Knowing the "just right" amount of food keeps the microbes healthy and working at their best instead of poisoning them.',
    plainHow:
      'Slide the food amount up and down and watch the growth curve: it climbs, reaches a peak, then dips as the food turns harmful. The tool marks the exact best food level and the range around it where growth stays at least half as fast as the peak, and shows a second curve for a microbe that never gets poisoned so you can see the difference.',
    terms: [
      { term: 'substrate', meaning: 'the food or chemical the microbes eat' },
      { term: 'growth rate', meaning: 'how quickly the microbes multiply' },
      { term: 'inhibition', meaning: 'the slowdown that happens when too much food turns toxic' },
    ],
  },
  'rosenzweig-macarthur': {
    plainWhat:
      'This is a model of two animals whose lives are tied together: prey (think rabbits) that live off plants, and predators (think foxes) that hunt the prey. It follows how the two populations rise and fall over time as the foxes catch rabbits and the rabbits breed and run out of food.',
    plainWhy:
      'Real nature really can behave like this, and it hides a famous surprise: giving the prey more food to help them can actually tip both animals into wild boom-and-bust swings instead of calm, steady numbers. That warning matters for anyone trying to protect wildlife, manage fishing, or run a farm without accidentally setting off chaos.',
    plainHow:
      'Try slowly turning up the "carrying capacity" (how much food and room the prey have) and watch the two population lines. At first they settle into calm, steady numbers, but once you pass a tipping point they suddenly break into big repeating boom-and-bust waves that never settle down again.',
    terms: [
      {
        term: 'carrying capacity',
        meaning:
          'the largest prey population the land can feed and hold; turning it up is like giving the prey more food and space',
      },
      {
        term: 'limit cycle',
        meaning:
          'a steady, never-ending rhythm of the populations booming and crashing over and over',
      },
      {
        term: 'paradox of enrichment',
        meaning:
          'the surprise that adding more food for the prey can make everything less stable, not more',
      },
    ],
  },
  'chemostat-competition': {
    plainWhat:
      'Imagine a tank where two kinds of tiny microbes live, both eating the same single food that trickles in at a steady rate while liquid is drained off just as fast. This shows you which microbe wins when both are hungry for the exact same meal.',
    plainWhy:
      "In nature, and in real lab and factory tanks, living things constantly compete for limited food. This reveals a famous rule: when two species need the exact same one resource, they can't both keep going forever — the one that gets by on less food takes over and the other fades away.",
    plainHow:
      'Try making one microbe better at surviving when food is scarce (lower its "break-even food level") and watch that species climb while the other drops to almost nothing. The "surviving species" readout tells you who wins: the winner is the one that can keep growing on the least food, because it eats the shared food down so low that its rival can\'t grow fast enough to replace the microbes being washed out, and starves.',
    terms: [
      {
        term: 'break-even food level',
        meaning:
          'The lowest amount of food a microbe needs just to hold steady, without growing or shrinking; the microbe that survives on the least food wins.',
      },
      {
        term: 'dilution rate',
        meaning:
          'How fast fresh liquid flows in and old liquid drains out, which sets how quickly microbes get washed out of the tank.',
      },
      {
        term: 'competitive exclusion',
        meaning:
          "The rule that two species living on one shared food can't coexist forever — one always crowds out the other.",
      },
    ],
  },
  'levins-metapopulation': {
    plainWhat:
      'Imagine a plant or animal that lives in many separate patches of good habitat, like ponds dotted across a valley or little woodlands scattered through farmland. This lab tracks what share of those patches have the species living in them, as it spreads into empty patches, dies out of others, and as some patches get bulldozed away for good.',
    plainWhy:
      'It helps explain how much wild habitat we can lose before a species vanishes for good, and it warns that clearing too much land can doom a species even when you can still spot it around today. That "delayed goodbye" is a real danger in conservation: the species looks fine, but it has already run out of room to keep going.',
    plainHow:
      'Slide up the amount of habitat destroyed and watch the line showing occupied patches. For a while the species hangs on, holding steady at a lower level. But push past a tipping point and the line slides all the way down to zero, and the species is gone from the whole region, sometimes only after a delay while a few patches still look occupied just before the collapse.',
    terms: [
      {
        term: 'occupancy',
        meaning: 'The share of habitat patches that currently have the species living in them.',
      },
      {
        term: 'extinction threshold',
        meaning:
          'The tipping point where so much habitat is gone that the species can no longer survive anywhere in the region.',
      },
      {
        term: 'extinction debt',
        meaning:
          'A delay where a species still seems present but is already doomed by past habitat loss.',
      },
    ],
  },
  bioreactor: {
    plainWhat:
      'This is a virtual tank where tiny living things like yeast or bacteria eat sugar, multiply, and make a useful product (think brewing beer or growing the cells that make medicine). You pick how the tank is run: a sealed batch that you start once and let finish, a tank you keep dripping fresh food into, or a tank with food flowing in one side and mixture flowing out the other in a steady stream.',
    plainWhy:
      'This is how we actually make beer, wine, yogurt, insulin, vaccines and lots of other things. Getting the settings right means more product from less food, which saves money and cuts waste in real factories.',
    plainHow:
      'Try lowering the amount of food the microbes start with, then watch the biomass line climb and flatten once the food runs out, and see how long it takes to run dry. In the steady-flow mode, try turning up the flow speed: push it too fast and the microbes get flushed out of the tank faster than they can breed, so the population crashes to nothing.',
    terms: [
      { term: 'biomass', meaning: 'how much living microbe stuff there is in the tank' },
      { term: 'substrate', meaning: 'the food (usually sugar) the microbes eat to grow' },
      {
        term: 'washout',
        meaning:
          'when fresh liquid flows through so fast the microbes are flushed out before they can multiply, and the tank empties of life',
      },
    ],
  },
  'replicator-dynamics': {
    plainWhat:
      'Imagine a huge crowd of animals (or people) who each follow one of two ways of behaving — say a pushy "grab it all" way or a calm "share it" way. Whichever way does better than the crowd average gets copied more, so over time the mix of the two shifts. This lab plays that copying process out and shows you where the crowd ends up.',
    plainWhy:
      "It's a simple way to understand why fighters, sharers, cooperators, and cheats can all survive together in nature, and why sometimes one behavior wins completely while another dies out. The same idea helps explain teamwork, standoffs, and standoffs breaking down in animals and people alike.",
    plainHow:
      'Change the four "score" numbers that say how well each behavior does against the other, then watch the line for how common the first behavior becomes over time. Depending on those scores and where you start, the crowd can drift to everyone doing it, drop to no one doing it, settle at a steady mix of both, or tip toward one or the other — and if the two behaviors happen to be perfectly matched, the crowd barely budges from where it began. The lab tells you which of these stories you got.',
    terms: [
      {
        term: 'strategy',
        meaning: 'One of the two ways of behaving that members of the crowd can follow',
      },
      {
        term: 'payoff',
        meaning:
          'A score for how well one behavior does when it meets another — bigger score means it gets copied more',
      },
      {
        term: 'stable mix (ESS)',
        meaning:
          'A steady blend of both behaviors that the crowd keeps returning to and neither one can take over',
      },
    ],
  },
  'beer-lambert': {
    plainWhat:
      'This is a color-detective for liquids. Shine light through a see-through sample that has two different colored substances mixed in it, and the tool figures out how much of each one is really there — just from the way the mix soaks up different colors of light.',
    plainWhy:
      "This is one of the most common real tests in science and medicine: it's how labs measure things like the amount of a protein, a drug, or a dye in a sample. The clever part here is untangling two mixed substances at once, so you can read each one separately without having to physically pull them apart.",
    plainHow:
      'Try moving the two substances\' favorite colors closer together, then watch the "Spectra separable" readout. When their colors are far apart the tool cleanly recovers how much of each you put in; slide them until they overlap and it warns you the two blur into one and can no longer be told apart. Also watch the peak height grow as you add more of either substance.',
    terms: [
      {
        term: 'absorbance',
        meaning:
          'How much light a sample soaks up instead of letting through — more substance means more soaking.',
      },
      {
        term: 'transmittance',
        meaning:
          'The flip side of soaking: the share of light that makes it all the way through the sample.',
      },
      {
        term: 'wavelength',
        meaning:
          "Which color of light you're shining — each substance drinks up some colors more than others.",
      },
    ],
  },
  'acid-base-titration': {
    plainWhat:
      'This is the classic school science moment where you slowly drip a strong cleaner-like liquid into a sour, weakly-acidic one, drop by drop, and watch how "sour vs. not-sour" changes. It traces that whole journey as a curve, so you can see the acid getting used up step by step.',
    plainWhy:
      "Measuring sourness this careful way is how labs figure out exactly how much acid is in something and how to keep a liquid's sourness steady. That steadiness matters for your blood, for medicines, foods, and drinks, which all stop working right if they turn too sour or not sour enough.",
    plainHow:
      'Add liquid a little at a time and watch the curve: for a long stretch it barely moves (the sourness is stubbornly resisting change), then it suddenly leaps up at one special point where the acid runs out. Try changing how strong the acid is and watch where that flat, resistant stretch sits and how big the sudden jump becomes.',
    terms: [
      {
        term: 'pH',
        meaning:
          'A simple 0-to-14 number for how sour a liquid is: low means very sour, 7 is neutral like pure water, high means the opposite of sour.',
      },
      {
        term: 'equivalence point',
        meaning:
          "The exact moment you've added just enough of the other liquid to use up all the acid — where the curve suddenly jumps.",
      },
      {
        term: 'buffer',
        meaning:
          'A liquid that stubbornly resists changing its sourness even as you add more to it — the flat part of the curve.',
      },
    ],
  },
  diffusion: {
    plainWhat:
      "Tiny things floating in water, like a speck of dust or a protein, never sit still. They get bumped from every side by the water's own jiggling and drift about in a wandering, zigzag path. This lab works out how quickly something spreads out that way, based on how big it is, how thick and syrupy the liquid is, and how warm it is.",
    plainWhy:
      'This slow wandering is how food, oxygen, and signals actually get around inside living cells, with no motor pushing them. It also lets scientists work backwards: by watching how fast something spreads, they can measure how big a molecule is, which is a real trick used to study proteins and design tiny medicines.',
    plainHow:
      'Try shrinking the particle\'s size, or warming things up, and watch the "diffusion coefficient" climb, meaning it spreads faster. Notice the wandering distance grows with the square root of time, so to go twice as far it needs four times as long, and check how many seconds it takes to drift across a tiny cell.',
    terms: [
      {
        term: 'diffusion coefficient',
        meaning:
          'A single number for how quickly something spreads through a liquid; bigger means faster wandering.',
      },
      {
        term: 'hydrodynamic radius',
        meaning:
          'The effective size of the particle as the surrounding liquid feels it while it drifts along.',
      },
      {
        term: 'viscosity',
        meaning: 'How thick or syrupy a liquid is; honey is high, water is low.',
      },
    ],
  },
  'oxygen-transfer': {
    plainWhat:
      'This shows how oxygen gets from air bubbles into the liquid where living cells are growing, like in a big tank brewing yeast or growing bacteria. The cells constantly breathe that oxygen, so the tank has to keep resupplying it fast enough by stirring and bubbling air through.',
    plainWhy:
      "Oxygen barely dissolves in water, so in a crowded tank of cells the oxygen usually runs short before the food does. If cells can't breathe, they get stressed or die, which can ruin a whole batch of medicine, food, or fuel. Growers need to know how much stirring and bubbling is enough to keep everything alive.",
    plainHow:
      'Try raising or lowering the oxygen supply strength and watch the "steady-state dissolved oxygen" number and the curve settle. If the supply is too weak, the tank flips to "oxygen-limited" and the oxygen level crashes below the safe line, telling you the cells can\'t get enough air. Boost the supply and watch the level climb back up and hold steady at a healthy value.',
    terms: [
      {
        term: 'dissolved oxygen',
        meaning: 'how much oxygen is floating in the liquid for cells to breathe',
      },
      {
        term: 'oxygen supply strength (kLa)',
        meaning:
          'how quickly the tank moves oxygen from bubbles into the liquid; bigger means faster resupply',
      },
      {
        term: 'oxygen-limited',
        meaning: "when the tank can't deliver oxygen fast enough and the cells start to run short",
      },
      {
        term: 'steady-state dissolved oxygen',
        meaning:
          "the settled oxygen level the liquid ends up holding once supply and the cells' breathing balance out",
      },
    ],
  },
  'nicholson-bailey': {
    plainWhat:
      'This models a tiny insect drama that plays out over and over: a "host" bug (like a caterpillar) that breeds each season, and a "parasitoid" wasp that lays its eggs inside those bugs. Each new wasp hatches from a bug it took over, so the two numbers rise and fall together, generation after generation.',
    plainWhy:
      "This is the classic experiment that taught scientists a surprising lesson: when a predator-like attacker depends completely on one prey, their numbers don't settle into a calm balance. Instead they swing wilder and wilder until one side dies out. It's why real pest control and conservation need extra buffers, like hiding spots or crowding limits, to keep both species alive.",
    plainHow:
      'Press run and watch the two population lines: instead of steadying, they swing higher and lower each cycle, a runaway boom and bust that keeps growing no matter what you set. Try nudging the host\'s breeding rate up or down and watch how it changes the size of the swings and where the calm point sits. The "outbreak vs equilibrium" number tells you how huge the wild swings get compared to that calm point the populations can never actually hold.',
    terms: [
      { term: 'host', meaning: 'The bug being attacked, like a caterpillar the wasp targets.' },
      {
        term: 'parasitoid',
        meaning: 'A wasp that lays eggs inside a host; the young grow by consuming it.',
      },
      {
        term: 'equilibrium',
        meaning:
          'The perfectly balanced numbers where things would hold steady, if only they could, but here they never do.',
      },
    ],
  },
  'van-deemter': {
    plainWhat:
      "Chromatography is a way scientists separate a mixture into its parts, like pulling apart the different dyes in a drop of ink. This lab models how a separating machine's speed changes how cleanly it does that job, so the different parts come out as clear, sharp signals instead of smudged, overlapping blobs.",
    plainWhy:
      'This is how labs check the purity of medicines, test food and water, and search for new drugs. Setting the flow speed right means faster results without losing the sharpness that lets you tell one ingredient from another.',
    plainHow:
      'Slide the flow speed up and down and watch the smudge line: go too slow and the parts spread out while they wait, go too fast and they smear on the way through. There is a "just right" speed in the dip of the curve where signals are sharpest, and the lab points it out for you, along with a score for how sharp and well-separated your signals will be at the speed you pick.',
    terms: [
      {
        term: 'plate height',
        meaning:
          'A measure of how smudged a signal gets as it travels through the machine; smaller means sharper, cleaner separation.',
      },
      {
        term: 'mobile-phase velocity',
        meaning: 'How fast the liquid carrying the mixture flows through the machine.',
      },
      {
        term: 'theoretical plates',
        meaning:
          'A score for how good the separation is; more plates means the parts come out more clearly told apart.',
      },
    ],
  },
  'osmotic-pressure': {
    plainWhat:
      "This shows how stuff dissolved in water pulls water toward it. The more little particles floating in the water, the harder it tugs water across a barrier like a cell's skin.",
    plainWhy:
      "It explains why a fresh-water fish can't live in the sea, why salted food doesn't spoil, and why the fluid a hospital drips into your arm has to be mixed just right so your blood cells don't puff up or shrivel.",
    plainHow:
      'Try raising how much you dissolve, or switch from sugar to salt (salt splits into two particles, so at the same amount it tugs twice as hard). Watch the pulling strength climb and the readout tell you whether a cell dropped in this water would swell up, stay steady, or shrink.',
    terms: [
      {
        term: 'osmotic pressure',
        meaning: 'how hard a watery mix pulls fresh water toward itself across a barrier',
      },
      {
        term: 'tonicity',
        meaning:
          "whether a liquid makes a cell swell, hold steady, or shrink compared with the cell's insides",
      },
      {
        term: 'particle count',
        meaning:
          'how many separate bits are floating in the water — what matters here, not what they are',
      },
    ],
  },
  'oxygen-hemoglobin': {
    plainWhat:
      'This models how the red stuff in your blood picks up oxygen in your lungs and hands it off to the rest of your body. It draws a curve showing how full of oxygen your blood gets as the amount of oxygen around it goes up or down.',
    plainWhy:
      'Every cell in you needs a steady supply of oxygen, and this hand-off is how it arrives. The clever S-shape of this curve is exactly what lets your blood grab lots of oxygen in your lungs and then let go of a big chunk of it right where hard-working muscles and organs need it most.',
    plainHow:
      'Try nudging the "half-point" pressure higher (like the shift that happens in warm, hard-exercising muscle) and watch the amount of oxygen handed off to tissues jump up. The readout tells you how full your blood is in the lungs, how full it still is coming back, and what share of its oxygen load it dropped off along the way.',
    terms: [
      {
        term: 'saturation',
        meaning: 'How full the blood is with oxygen, from empty to completely loaded.',
      },
      {
        term: 'partial pressure',
        meaning:
          'A measure of how much oxygen is present in one spot — high in the lungs, low in busy tissues.',
      },
      {
        term: 'half-point pressure',
        meaning:
          'The oxygen level at which the blood is exactly half full; a higher half-point means the blood lets go of oxygen more easily.',
      },
      {
        term: 'Bohr effect',
        meaning:
          'In warm, acidic, exercising tissue, blood lets go of extra oxygen right where it is needed.',
      },
    ],
  },
  'gibbs-equilibrium': {
    plainWhat:
      'This works out which way a chemical reaction naturally wants to go, and how much of the starting stuff turns into something new before the mixture settles into a steady balance. It also shows how heating or cooling can change that answer.',
    plainWhy:
      'Almost everything around you, from batteries and cooking to the reactions inside living cells, depends on whether a reaction runs on its own or needs a push. Knowing which way it goes, and how temperature can flip it, helps people design medicines, materials, and clean energy.',
    plainHow:
      'Slide the temperature up and down and watch the direction readout: some reactions that go one way when cold suddenly reverse when hot. A separate number tells you the share of the starting material that ends up transformed once the mixture settles, and a graph shows how that balance shifts as things get warmer or cooler.',
    terms: [
      {
        term: 'equilibrium',
        meaning:
          'The steady balance point where a reaction stops changing overall, because it goes forward and backward at the same speed.',
      },
      {
        term: 'spontaneous',
        meaning: 'A reaction that runs on its own, without needing an outside push.',
      },
      {
        term: 'product fraction',
        meaning:
          'The share of the starting material that has turned into the new substance once the mixture settles.',
      },
    ],
  },
  compartmental: {
    plainWhat:
      "This models how a disease spreads through a group of people over time. Everyone is sorted into buckets — like still-healthy, currently sick, and recovered — and the tool follows how people move from one bucket to the next as an outbreak plays out. Depending on the version you pick, it can also add a bucket for people who have caught it but aren't infectious yet, or a bucket for people who sadly die.",
    plainWhy:
      'It is the same kind of math public-health teams use to guess how bad an outbreak could get, how many people might be sick at the same time, and whether having enough people already immune can stop it from spreading.',
    plainHow:
      'Try turning up how easily the disease passes between people and watch the "peak" — the worst moment, when the most people are sick at once — climb higher and arrive sooner. The main number to watch tells you whether the outbreak takes off and grows or simply fizzles out, and it also shapes how big a share of everyone eventually catches it.',
    terms: [
      {
        term: 'R-zero (R0)',
        meaning:
          'The average number of people one sick person passes the disease on to. Above 1 it spreads; below 1 it dies out.',
      },
      {
        term: 'Herd-immunity threshold',
        meaning:
          'The share of people who need to be immune before the disease can no longer keep spreading.',
      },
      {
        term: 'Attack rate (final size)',
        meaning:
          'The fraction of the whole group that catches the disease by the time the outbreak is over.',
      },
      {
        term: 'Peak',
        meaning:
          'The busiest moment of the outbreak, when the largest number of people are sick at the same time.',
      },
    ],
  },
  'reed-frost': {
    plainWhat:
      "This models how a contagious illness spreads through a group of people, step by step, in waves called \"generations.\" In each wave, the people who are sick right now can pass the illness to people who haven't caught it yet. Those newly sick people then get better and can't pass it on again, so it's the next fresh wave that keeps things going. You watch how big the outbreak grows, wave after wave.",
    plainWhy:
      'Knowing how fast an illness spreads, how many people it eventually reaches, and how many need to be protected to stop it helps doctors, schools, and health workers plan vaccinations and decide when to act.',
    plainHow:
      'Try nudging the "spread number" up or down and watch the outbreak curve change: below one, it fizzles out fast; above one, it grows into a big wave. The results tell you what share of the whole group ends up catching it, which wave was the worst, and how many waves it lasted.',
    terms: [
      {
        term: 'Spread number (R0)',
        meaning:
          'The average number of new people one sick person passes the illness to. Above one, it grows; below one, it dies out.',
      },
      {
        term: 'Generation',
        meaning:
          "One round of spreading. Today's sick people infect the next batch, then get better; that next batch carries the illness onward.",
      },
      {
        term: 'Attack rate',
        meaning: 'The share of the whole group that catches the illness by the end.',
      },
      {
        term: 'Herd-immunity threshold',
        meaning:
          'How much of the group needs to be protected before the outbreak can no longer take off.',
      },
    ],
  },
  admet: {
    plainWhat:
      'This is a quick check that tells you whether a molecule could work as a pill you swallow. You give it a molecule — either as its recipe-like text code or as a few numbers describing it — and it scores how easily your body could take it in and use it.',
    plainWhy:
      "Most would-be medicines fail not because they can't fight the disease, but because the body can't take them in when you swallow them. Spotting that early, before anyone spends years and money actually making the molecule, saves huge effort and helps good medicines reach people faster.",
    plainHow:
      'Paste in a molecule (try aspirin\'s code: CC(=O)Oc1ccccc1C(=O)O) and watch the drug-likeness score — a number from 0 to 1 where higher means more pill-friendly. Then make the molecule bigger or greasier and watch the score drop and warning flags appear, showing you which classic "good medicine" limits it just broke.',
    terms: [
      {
        term: 'SMILES',
        meaning:
          "A short line of letters and symbols that spells out a molecule's structure, like a recipe written on one line.",
      },
      {
        term: 'drug-likeness score (QED)',
        meaning:
          'A single 0-to-1 rating of how much a molecule resembles a typical successful pill; higher is better.',
      },
      {
        term: "Lipinski's Rule of Five",
        meaning:
          'A famous checklist of size and greasiness limits that swallowable medicines usually stay within.',
      },
    ],
  },
  vaccination: {
    plainWhat:
      'This works out how many people in a group need a vaccine to stop a disease from spreading through everyone. You pick how catchy the disease is, how many people get the shot, and how well the shot works, and it tells you whether the outbreak fizzles out or takes off.',
    plainWhy:
      'When enough people are protected, a germ runs out of new people to jump to and the whole community is shielded — even babies and sick people who cannot get the shot. This is the idea behind vaccination campaigns that have wiped out diseases in real life.',
    plainHow:
      'Try sliding the vaccine coverage up and watch the "final epidemic size" fall toward zero — the moment it hits zero, you have reached the tipping point where the disease can no longer spread. Then make the disease more catchy and see how many more people you suddenly need to protect, and notice that a weaker shot can make full protection impossible.',
    terms: [
      {
        term: 'Critical coverage',
        meaning:
          'The share of people who need protecting before an outbreak can no longer take off.',
      },
      {
        term: 'Vaccine efficacy',
        meaning: 'How reliably the shot actually protects someone who gets it.',
      },
      {
        term: 'Herd immunity',
        meaning:
          "When enough people are protected that the disease can't spread, shielding everyone — even the unvaccinated.",
      },
      {
        term: 'Final epidemic size',
        meaning:
          'The share of the whole group who would catch the disease before the outbreak burns out.',
      },
    ],
  },
  'pk-two-compartment': {
    plainWhat:
      "This models what happens to a medicine after it's injected straight into a vein all at once. The drug spreads from the blood into the body's tissues and slowly seeps back, while the body steadily removes it, so you can watch its level in the blood rise and fall over time.",
    plainWhy:
      'Doctors need to know how long a medicine stays strong enough to work but not so strong it becomes harmful. This kind of picture helps decide the right dose and how often to give it, so treatments are both safe and effective.',
    plainHow:
      'Try lowering the clearance (how fast the body cleans the drug out) and watch the blood curve stay higher for longer. The two lines show the drug in the blood and in the tissues. The blood line starts at its peak the moment the drug goes in, then drops quickly at first as some of it moves into the tissues, and finally fades away slowly as the body clears it. The tissue line starts at zero, fills up as the drug soaks in, then empties again once the blood level falls.',
    terms: [
      { term: 'clearance', meaning: 'how quickly the body removes the drug from the blood' },
      { term: 'half-life', meaning: 'the time it takes for the drug level to fall by half' },
      {
        term: 'AUC',
        meaning: "the total drug exposure over time — how much the body 'sees' in all",
      },
    ],
  },
  'sir-endemic': {
    plainWhat:
      "This models how a catching illness spreads through a town where babies are born and people pass away over the years, so there's always a fresh supply of people who could catch it. Instead of one outbreak that burns out, the disease can settle in and stick around for good, like the way measles or whooping cough kept coming back in waves.",
    plainWhy:
      'Understanding whether a disease will vanish on its own or dig in and become a permanent part of a community helps decide how hard to push things like vaccination, and explains why some illnesses flared up again and again for generations before we had shots for them.',
    plainHow:
      'Try raising how easily the illness spreads and watch the "becomes endemic" result flip on: the town\'s sick count doesn\'t just crash to zero, it bounces up and down in shrinking waves before settling at a steady level. Watch the "endemic prevalence" number — that\'s the share of people you\'d expect to be sick once things calm down. Push spreading low enough and the disease dies out completely instead.',
    terms: [
      {
        term: 'endemic',
        meaning:
          'A disease that never fully goes away and stays present in a community at a steady low level.',
      },
      { term: 'prevalence', meaning: 'The share of people who are sick at a given moment.' },
      {
        term: 'reproduction number',
        meaning:
          'How many new people, on average, one sick person passes the illness to; above one it can take hold, at or below one it fades away.',
      },
    ],
  },
  sis: {
    plainWhat:
      'This models a catch-it-again illness — one that never leaves you immune, so once you get better you can catch it right back. Think of the common cold across a whole town, or some ongoing infections that keep circulating. It tracks what share of people are sick as time goes on.',
    plainWhy:
      "Some diseases don't burn out after one big wave — they settle in and stay for good, quietly keeping a steady slice of people sick. Knowing whether a bug will fade away or stick around helps health workers decide how hard to push things like treatment and prevention to finally stamp it out.",
    plainHow:
      'Try raising how easily the illness spreads, or lowering how fast people recover, and watch the sickness curve. If each sick person passes it to more than one other on average, the line climbs and then levels off at a steady share that never goes away — the disease is here to stay. Push spreading low enough and the line slides down to zero and the illness dies out. The final level tells you which fate wins.',
    terms: [
      {
        term: 'reproduction number',
        meaning:
          'The average number of new people one sick person infects. Above one, the illness stays; at or below one, it fades away.',
      },
      {
        term: 'endemic',
        meaning:
          'When a disease settles in and stays around a community for good instead of disappearing after one outbreak.',
      },
      { term: 'prevalence', meaning: 'The share of people who are sick at a given moment.' },
    ],
  },
  docking: {
    plainWhat:
      "This models how a small molecule (like a possible medicine) fits into a pocket on a much larger protein in your body. You hand it a few ways the small piece could be placed and turned inside the pocket, and it works out which fit sits most snugly, the way you'd try a key in a lock.",
    plainWhy:
      'Finding a molecule that fits a protein snugly is an early step in inventing new drugs. Trying out fits on a computer first saves scientists years of lab work and helps them zero in on the shapes worth testing for real.',
    plainHow:
      'Change one of the placements, moving the small molecule a little closer or turning it a different way, then add it to your list and compare. Watch the "best pose energy" number: a lower (more negative) number means a snugger, more comfortable fit. The tool sorts all your placements, tells you which one won, and shows how closely the two pieces end up touching.',
    terms: [
      {
        term: 'ligand',
        meaning: 'The small molecule being tested for fit, like a key going into a lock.',
      },
      {
        term: 'receptor',
        meaning: 'The larger protein with a pocket the small molecule slots into.',
      },
      {
        term: 'pose',
        meaning: 'One way of placing and turning the small molecule inside the pocket.',
      },
      {
        term: 'pose energy',
        meaning:
          'A score for how comfortable a fit is; a lower (more negative) score means a snugger, steadier fit.',
      },
    ],
  },
  'dose-response': {
    plainWhat:
      'This shows how much a drug actually does as you give more or less of it. It draws the classic S-shaped curve: a tiny dose does almost nothing, a middle dose does more, and past a certain point piling on extra barely helps because the effect has hit its ceiling.',
    plainWhy:
      "It's how scientists work out the right amount of a medicine: enough to work, but not so much that it's wasteful or harmful. It also helps them see whether two drugs taken together boost each other, cancel each other out, or just get in the way.",
    plainHow:
      "Slide the potency (the amount needed to reach the halfway effect) and watch the whole curve shift left or right; a smaller number means the drug works at a lower dose. Change the steepness to see the curve go from a gentle ramp to a sharp on/off switch, and read off the dose that gets you halfway to the drug's full effect. You can also feed in real measurements and let it find the best-fitting curve for you.",
    terms: [
      {
        term: 'EC50',
        meaning:
          "The dose that gets you halfway to the drug's biggest effect — a quick measure of how strong it is.",
      },
      {
        term: 'IC50',
        meaning:
          'For drugs that shut something down, the dose that cuts the response to half of its normal, untreated level.',
      },
      {
        term: 'Hill slope',
        meaning:
          'How steep the curve is — whether the effect turns on gradually or switches on suddenly.',
      },
    ],
  },
  'pk-oral-absorption': {
    plainWhat:
      'This models what happens to a pill after you swallow it: the medicine slowly soaks out of your stomach and gut into your blood, while your body is busy cleaning it back out at the same time. It draws the classic curve of how much drug is in your blood, starting at zero, climbing to a high point, then slowly fading away.',
    plainWhy:
      'This is the balance every medicine has to get right. Too little in your blood and the pill does nothing; too much and it can make you sick. Doctors and drug makers use exactly this kind of picture to choose a safe dose and decide how often you should take it.',
    plainHow:
      'Try raising the dose and watch the whole curve lift higher, or speed up how fast the drug soaks in and watch the peak arrive sooner and sharper. The key numbers to watch are the highest point the drug reaches in your blood and how long after swallowing it takes to get there.',
    terms: [
      {
        term: 'Bioavailability',
        meaning:
          'The share of the pill that actually makes it into your blood, since some is lost along the way.',
      },
      {
        term: 'Clearance',
        meaning:
          'How quickly your body (mostly your liver and kidneys) cleans the drug out of your blood.',
      },
      {
        term: 'Half-life',
        meaning: 'The time it takes for the amount of drug in your blood to drop to half.',
      },
    ],
  },
  'rna-fold': {
    plainWhat:
      'RNA is a long thread of chemical "letters" that a cell makes. Left alone, the thread folds back and sticks to itself, forming loops and stems. This lab takes a sequence you type and works out one neat shape it could fold into, choosing the folding that lets the most letters pair up.',
    plainWhy:
      "The shape an RNA thread folds into decides what job it can do in a living thing, from switching genes on and off to helping build proteins. Being able to guess that shape from just the letters helps scientists understand life and design things like vaccines and new medicines. This lab uses one of the oldest, simplest folding methods, so it's great for learning the idea rather than a stand-in for the heavy-duty tools scientists rely on.",
    plainHow:
      'Type a sequence and watch the dot-bracket picture: a matching ( and ) are two letters holding hands, and each dot is a letter left loose. Try the ready-made example, four G letters, then four A letters, then four C letters (GGGGAAAACCCC), and watch a tidy stem snap shut around the A letters in the middle, which stay loose as a little loop. The "base pairs" number tells you how many pairs formed (each pair is two letters), so more pairs means a more tightly folded thread.',
    terms: [
      {
        term: 'base pair',
        meaning:
          'Two RNA letters that fit together and hold hands, like puzzle pieces (A with U, G with C, and sometimes G with U).',
      },
      {
        term: 'dot-bracket',
        meaning:
          'A simple text picture of the fold: ( and ) mark two letters paired together, and . marks a loose, unpaired letter.',
      },
      {
        term: 'hairpin loop',
        meaning:
          "A small loop where the thread bends back on itself; the loop needs a few loose letters so the bend isn't too sharp.",
      },
      {
        term: 'stem',
        meaning:
          'A run of stacked base pairs sitting side by side, like a little zip holding two parts of the thread together.',
      },
    ],
  },
  'dna-melting': {
    plainWhat:
      'DNA is made of two matching strands that zip together like the two sides of a zipper. This lab heats them up and shows how the two strands come apart, or "melt," as it gets hotter.',
    plainWhy:
      'Splitting DNA apart by heating it is a key step in tests that read genes, spot viruses, or match a sample to a person. Knowing the exact temperature where the strands let go helps scientists design those tests so they work reliably.',
    plainHow:
      'Slide the temperature range and watch the curve slope downward from fully zipped to fully apart. The melting temperature is the halfway point where exactly half the strands have come undone. Try raising the amount of DNA in the mix and notice the melting temperature creep up a little, a giveaway that it takes two strands finding each other to zip up.',
    terms: [
      {
        term: 'Duplex',
        meaning: 'The zipped-together, double form of DNA where both matching strands are joined.',
      },
      {
        term: 'Melting temperature',
        meaning:
          'The temperature at which half the strands have come apart, a handy signpost for how tightly they hold together.',
      },
      {
        term: 'Transition width',
        meaning:
          'How wide a temperature span the melt takes; a narrow span means the strands let go sharply, all at once.',
      },
    ],
  },
  fret: {
    plainWhat:
      'This is a molecular tape measure. Scientists attach two tiny glowing tags to a protein or a strand of DNA. When the tags are very close, one hands its light-energy straight to the other instead of glowing on its own, and how much gets handed over tells you exactly how far apart they are.',
    plainWhy:
      "It lets people measure distances far smaller than anything you could ever see, without touching or breaking the thing they're looking at. That's how we watch proteins fold up, snap shut, or grab their partners as it happens, which helps us understand disease and design medicines.",
    plainHow:
      "Slide the distance between the two tags and watch the transfer number. Bring them close and almost all the energy jumps across (near 100%); pull them apart and the handoff fades fast to nearly nothing. Between those extremes there's a sweet spot where a small change in distance changes the number a lot — that's the range where this ruler works best, and the lab flags when your tags are inside it.",
    terms: [
      {
        term: 'transfer efficiency',
        meaning:
          "How much of the glow-energy gets passed from one tag to the other; high when they're close, low when far apart.",
      },
      {
        term: 'Forster radius',
        meaning:
          "The special distance where exactly half the energy gets handed over — the ruler's middle mark, set by which pair of tags you use.",
      },
      {
        term: 'nanometre',
        meaning:
          'A distance so tiny that many thousands would fit across the width of a single hair; the scale this ruler measures.',
      },
    ],
  },
  'worm-like-chain': {
    plainWhat:
      'This mimics what happens when scientists grab a single piece of DNA by its two ends and gently pull it straight. Left alone, DNA flops into a loose, tangled coil; this tool shows how hard you have to tug to stretch it out.',
    plainWhy:
      "DNA doesn't just sit still in your cells — it gets bent, packed, and pulled apart every time a cell copies itself or reads a gene. Knowing exactly how stretchy and springy DNA is helps scientists understand those everyday cell machines and build tiny tools that grab and handle one molecule at a time.",
    plainHow:
      'Try dragging the stretch closer to fully straight and watch the pull needed shoot up fast — at first the DNA gives easily like a soft rubber band, but as it runs out of slack it suddenly fights back hard. The curve you see is the same one real labs measure when they pull on one molecule with a beam of light or a magnet.',
    terms: [
      {
        term: 'persistence length',
        meaning:
          'How floppy or stiff the strand is — a bigger number means it stays straight over a longer stretch before it bends.',
      },
      {
        term: 'contour length',
        meaning: 'The full length of the strand if you pulled it completely straight, end to end.',
      },
    ],
  },
  'saturation-binding': {
    plainWhat:
      'This measures how tightly a drug or signalling molecule sticks to its target on a cell, and how many of those targets get filled. You set how sticky it is and how much is floating around.',
    plainWhy:
      'Almost every medicine works by latching onto a target in the body. How tightly it grips — and how much you need to fill the targets — sets the right dose and whether the drug works at all, so this is a bedrock measurement in drug design.',
    plainHow:
      'Make the molecule stickier and watch the binding curve climb with far less of it floating around; it always levels off once every target is taken. Try raising how much is around and watch the share of filled targets rise toward full.',
    terms: [
      {
        term: 'receptor',
        meaning: 'the target on a cell that a drug or signal molecule latches onto.',
      },
      {
        term: 'Kd (stickiness)',
        meaning:
          'the amount of molecule needed to fill half the targets — a smaller number means it sticks more tightly.',
      },
      { term: 'occupancy', meaning: 'the share of targets currently filled, from none to all.' },
    ],
  },
  'microbial-growth': {
    plainWhat:
      'This grows a population of microbes — like bacteria or yeast in a flask — and draws the famous S-shaped growth curve: a slow start, a fast-rising middle, then a level-off as the flask fills up and runs low on food and room.',
    plainWhy:
      'This curve shows up everywhere microbes matter: brewing, making medicine, food going off, or an infection taking hold. Knowing how fast a culture grows and when it will plateau lets people time a harvest, a dose, or a clean-up.',
    plainHow:
      'Turn up the growth rate and watch the curve rise and level off sooner; the population never climbs past the carrying capacity — the most the flask can hold. Try changing the starting amount or the capacity and watch when the culture hits its steepest, fastest-growing moment.',
    terms: [
      {
        term: 'carrying capacity',
        meaning: 'the biggest population the flask can support, where growth finally stops.',
      },
      {
        term: 'growth rate',
        meaning: 'how fast the population multiplies while there is still plenty of room.',
      },
      {
        term: 'inflection',
        meaning: 'the steepest, fastest-growing moment, which happens at half the capacity.',
      },
    ],
  },
  'stern-volmer': {
    plainWhat:
      'Some molecules glow when you shine light on them. This shows how adding a "quencher" — a molecule that bumps into the glowing one and steals its energy — makes the glow dimmer. You set how strong the quencher is and how much you add.',
    plainWhy:
      "Measuring how easily a glow gets dimmed tells scientists how exposed the glowing part is — for example, whether a glowing tag on a protein is out in the open or tucked away inside. It's a simple, powerful way to peek at a molecule's shape and surroundings.",
    plainHow:
      'Add more quencher and watch the glow fade; it plots as a straight line that climbs steeper the stronger the quencher. Try a stronger quencher and see how much less of it is needed to cut the glow in half.',
    terms: [
      {
        term: 'quencher',
        meaning:
          'a molecule that dims a glow by bumping into the glowing one and draining its energy.',
      },
      {
        term: 'fluorescence',
        meaning: 'the glow a molecule gives off shortly after it soaks up light.',
      },
      {
        term: 'Stern–Volmer constant',
        meaning: 'how strongly a quencher dims the glow; a bigger number means a steeper fade.',
      },
    ],
  },
  'radioactive-decay': {
    plainWhat:
      "Some things fade away at a steady pace — half of what's there disappears over a set time, then half of the rest, and so on. This follows that fading, whether it's a radioactive atom in an old bone, a medicine leaving your body, or a worn-out protein being recycled inside a cell.",
    plainWhy:
      "This same simple fading explains a lot: it's how scientists put an age on ancient bones and fossils by measuring leftover carbon, how doctors work out how often you need a pill, and how cells keep tidy by clearing out old parts.",
    plainHow:
      'Set the half-life — the time it takes for half to vanish — and watch the curve drop by half, then half again. Read off how much is left after a chosen time, or flip it around: a known leftover amount tells you how much time has passed, which is exactly how carbon dating works.',
    terms: [
      {
        term: 'half-life',
        meaning: 'the time it takes for half of the amount to disappear.',
      },
      {
        term: 'decay',
        meaning: 'fading away at a steady pace, always losing the same share of what is left.',
      },
      {
        term: 'carbon dating',
        meaning: "working out a sample's age from how much of a slowly-fading atom is still in it.",
      },
    ],
  },
  'enzyme-thermal': {
    plainWhat:
      "Every enzyme — a tiny protein machine that speeds up a chemical job in your body — works best at a particular temperature. This draws that bell-shaped curve: too cold and it's sluggish, too hot and it falls apart, with a sweet spot in the middle.",
    plainWhy:
      "It's why your body holds itself at about 37°C, why a high fever is dangerous, and why the enzymes in laundry detergent or in boiling hot-spring microbes are specially built to survive heat. Knowing the sweet spot lets scientists design enzymes that work where they are needed.",
    plainHow:
      'Warm things up and the enzyme speeds up — until it gets so hot the protein unravels and activity crashes. Try raising the melting temperature (how much heat it can take) and watch the whole sweet spot slide to a higher temperature.',
    terms: [
      {
        term: 'enzyme',
        meaning: 'a protein that speeds up a chemical reaction in a living thing.',
      },
      {
        term: 'denature',
        meaning: 'when heat makes a protein unravel and stop working.',
      },
      {
        term: 'optimal temperature',
        meaning: 'the sweet spot where the enzyme works fastest.',
      },
    ],
  },
  'recombination-map': {
    plainWhat:
      'Genes sit in a row along a chromosome, and this works out how far apart two of them are. It uses a simple clue: the further apart two genes lie, the more often they get shuffled onto different copies when eggs and sperm are made.',
    plainWhy:
      'This is how the very first gene maps were drawn, and it is still how scientists hunt down the gene behind an inherited disease — narrowing the search to a stretch of chromosome by seeing which genes travel together through families.',
    plainHow:
      'Set how far apart the two genes are and watch how often they get separated. For nearby genes the separation rate rises straight in step with distance — but for far-apart genes it flattens out near a half, because the shuffling can happen twice and cancel itself. Switch the mapping method to see how each one corrects for that.',
    terms: [
      {
        term: 'recombination',
        meaning:
          'the shuffling that puts two genes onto different chromosome copies when reproductive cells form.',
      },
      {
        term: 'centimorgan',
        meaning: 'the unit of genetic distance; roughly the distance that gives 1% shuffling.',
      },
      {
        term: 'crossover',
        meaning: 'a swap between the two chromosome copies that reshuffles the genes along them.',
      },
    ],
  },
};

/** The plain-language help card for an engine, or null if none exists yet. */
export function helpForEngine(slug: string): HelpCard | null {
  return ENGINE_HELP[slug] ?? null;
}
