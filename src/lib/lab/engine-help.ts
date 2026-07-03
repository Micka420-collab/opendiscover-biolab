/**
 * Plain-language help cards for the LAB ENGINES — the "?" on each engine page that
 * explains, with no background required, what the simulator models, why it matters, and
 * what to try. Same {@link HelpCard} shape as the challenge cards, keyed by engine slug.
 *
 * Generated (and, where the verify pass ran before an API rate-limit, accuracy-verified)
 * from each engine description by the engine-help-content generate->verify workflow. Every
 * card is grounded in the real engine description; a test enforces that the prose is
 * jargon-free (no equations or Greek symbols) and that every registered engine has a card.
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
      'This models a cellular assembly line: a raw ingredient gets passed down a chain of tiny worker molecules (enzymes), each one turning it into the next thing until a final product piles up at the end. It follows how much of each in-between substance builds up over time and how fast the whole line runs.',
    plainWhy:
      'Assembly lines like this are how living cells turn food into energy and building blocks for life. Understanding where a line gets stuck helps scientists design better medicines and engineer microbes to brew useful things like fuels, foods, and drugs.',
    plainHow:
      "Give each worker a top speed, then watch the line settle down: once it's steady, every step passes stuff along at the same pace. Try lowering one worker's top speed and watch it become the bottleneck that holds back the whole line, while the final product piles up more slowly.",
    terms: [
      {
        term: 'enzyme',
        meaning: 'a tiny molecular worker in a cell that speeds up one specific chemical change',
      },
      {
        term: 'flux',
        meaning:
          'how fast stuff flows through the whole line, like items per minute on a conveyor belt',
      },
      { term: 'bottleneck', meaning: 'the slowest step, which sets the pace for the entire line' },
    ],
  },
  'branching-growth': {
    plainWhat:
      'This is a game of chance played out by a tiny group of living cells, like the start of a tumor or a patch of stem cells. Every round, each cell rolls its own dice: it either dies, sits still and does nothing, or splits into two new cells. Do that over and over and watch whether the little colony blossoms into a huge crowd or fizzles out to nothing.',
    plainWhy:
      'The same simple rules decide whether a handful of cancer cells fades away on its own or grows into a real tumor, and whether a few surviving cells can rebuild healthy tissue. Understanding when a tiny cell population takes off versus dies out helps doctors and scientists think about cancer, healing, and how life bounces back from small numbers.',
    plainHow:
      'Try nudging the chance of dividing up (or the chance of dying down) and watch the "extinction probability" — that\'s how likely the whole colony is to vanish completely. Below a tipping point almost every colony dies out; above it, some survive and explode in size. The tool runs the same setup hundreds of times, so you can compare what the math predicts against what actually happened in all those runs.',
    terms: [
      {
        term: 'extinction probability',
        meaning: 'the chance the whole cell colony eventually dies out completely, leaving nothing',
      },
      {
        term: 'generation',
        meaning: 'one round where every cell takes its turn to die, stay put, or split in two',
      },
      {
        term: 'mean offspring per cell',
        meaning:
          'the average number of cells each cell leaves behind next round; above one and the colony tends to grow, below one and it tends to shrink',
      },
    ],
  },
  'wright-fisher': {
    plainWhat:
      'This is a make-believe population of living things, where each one carries one of two versions of the same gene. It watches, generation after generation, how common each version becomes as the population has offspring, some versions get a survival edge, and pure luck shuffles who passes their genes on.',
    plainWhy:
      'It shows how a gene version can slowly take over a whole population or vanish forever, sometimes just by chance and sometimes because it helps survival. This is the basic story of evolution, and it helps explain everything from why some traits spread to how rare diseases stick around or fade in small populations.',
    plainHow:
      'Try shrinking the population and watch how much more often a gene version gets completely wiped out or takes over purely by luck. The main number to watch is the chance that one gene version ends up "winning" (filling the whole population): with no survival advantage it simply matches how common that version started out, but give it even a small edge and that chance climbs.',
    terms: [
      {
        term: 'allele',
        meaning: 'One of the two versions of the same gene that the simulation tracks.',
      },
      {
        term: 'fixation',
        meaning:
          'When one gene version has spread to every member of the population, so the other has disappeared.',
      },
      {
        term: 'genetic drift',
        meaning:
          'Random shifts in how common a gene version is, just from the luck of who happens to have offspring.',
      },
    ],
  },
  fba: {
    plainWhat:
      'This is a tiny virtual cell. It maps out all the little chemical steps a microbe uses to turn food (like sugar) into the parts it needs to grow, then works out the fastest way it could possibly grow with the food and limits you give it.',
    plainWhy:
      'Scientists use this same trick on real bacteria and yeast to guess how fast they grow and which food routes they lean on. That helps in brewing, making medicines, and designing microbes that produce useful things like fuels or drugs.',
    plainHow:
      'Try lowering the glucose (food) limit and watch the growth number drop right alongside it. The main result, the growth flux, tells you the best-case speed the cell can grow, and it also shows you which chemical steps are actually being used to get there.',
    terms: [
      {
        term: 'flux',
        meaning:
          'How fast stuff flows through one chemical step, like the flow rate through a pipe.',
      },
      {
        term: 'steady state',
        meaning:
          'A balanced setup where everything made inside is used up just as fast, so nothing piles up.',
      },
      {
        term: 'biomass / growth flux',
        meaning: 'The single number for how fast the cell is building new copies of itself.',
      },
    ],
  },
  kuramoto: {
    plainWhat:
      'This models how a crowd of things that each keep their own beat — like fireflies blinking, heart pacemaker cells, or a clapping audience — can fall into the same rhythm all on their own. Each one has its own natural pace, and they gently nudge each other every cycle.',
    plainWhy:
      'Getting in sync (or failing to) shows up everywhere in life: your heartbeat, sleep clocks in your brain, power grids, even people clapping together after a show. Understanding when a group snaps into a shared rhythm helps doctors and scientists spot healthy and unhealthy patterns in the body and beyond.',
    plainHow:
      'Try raising the coupling (how strongly each one listens to the others) and watch the coherence line climb. When the nudging is weak, everyone does their own thing and the line stays low and jittery; push past the tipping point and the whole crowd suddenly locks into step and the line shoots up toward 1 — that number tells you how in-sync the group is, where 0 is chaos and 1 is perfect togetherness.',
    terms: [
      {
        term: 'coupling',
        meaning:
          'How strongly each member pays attention to the rest of the group — turn it up and they synchronize more easily.',
      },
      {
        term: 'coherence (order parameter r)',
        meaning:
          'A single score from 0 to 1 for how in-step the whole group is: 0 is total disorder, 1 is everyone moving as one.',
      },
      {
        term: 'natural frequency',
        meaning: 'The personal pace each member would keep on its own if nobody else were around.',
      },
    ],
  },
  phylogenetics: {
    plainWhat:
      "This builds a family tree for living things by comparing the letter-strings of their DNA (or RNA). You give it a few creatures' matching genetic sequences, and it works out which ones are close cousins and which split apart long ago.",
    plainWhy:
      'Family trees like this show how humans, animals, plants, and viruses are all related and how they changed over time. Scientists use them to trace where a new virus came from, track how diseases spread, and understand the story of life on Earth.',
    plainHow:
      'Try feeding in a few sequences and watch the tree that comes out: creatures whose DNA matches closely sit on nearby branches, while very different ones sit far apart. Change the counting method or the tree-building style and watch the branch lengths shift, showing how much each creature has changed since they shared an ancestor.',
    terms: [
      {
        term: 'aligned sequences',
        meaning:
          'DNA strings lined up so the same positions can be compared letter by letter, like stacking two words to see which letters differ.',
      },
      {
        term: 'substitution model',
        meaning:
          'A recipe for estimating how many real changes happened, since the same spot can change more than once and hide earlier changes.',
      },
      {
        term: 'branch length',
        meaning:
          "How much a creature's DNA has changed along a branch; longer branches mean more changes since the split.",
      },
    ],
  },
  'hardy-weinberg': {
    plainWhat:
      "This looks at a trait that comes in two versions of a gene across a group of living things — like plants, animals, or people. You tell it how many individuals carry two copies of one version, one of each, or two copies of the other version, and it checks whether the group looks the way you'd expect if partners were pairing up completely at random.",
    plainWhy:
      'When a real group does NOT match the "random pairing" picture, something interesting is going on — maybe relatives are having offspring together, maybe one version helps survival, or maybe two separate groups got mixed together. Spotting that difference is how scientists notice hidden forces shaping a population.',
    plainHow:
      'Try typing in the counts of each type, then watch the "departs from expected" result. If you make the middle group (the mixed pairs) much smaller than the others, watch the test flip to "departs" — a clue that partners aren\'t pairing at random. The main number tells you whether your group is close enough to the random-pairing prediction or clearly different from it.',
    terms: [
      {
        term: 'allele frequency',
        meaning:
          'How common each of the two gene versions is in the whole group, as a share of the total.',
      },
      {
        term: 'heterozygosity',
        meaning:
          'The share of individuals carrying one of each gene version rather than a matching pair.',
      },
      {
        term: 'inbreeding coefficient',
        meaning:
          'A number that goes up when there are fewer mixed pairs than expected, often a sign relatives are breeding together.',
      },
    ],
  },
  'moran-process': {
    plainWhat:
      'This models a small, fixed-size group of living things where a new version of a gene appears in just one or a few members, and then, generation after generation, either spreads to everyone or dies out. Each turn one individual has offspring and one is replaced, so the group stays the same size while the count of the new type wanders up and down.',
    plainWhy:
      'This is at the heart of how evolution actually works in real, limited populations: luck (not just fitness) decides whether a brand-new trait takes over or vanishes. Even a helpful new gene often disappears by chance, and even a slightly weak one sometimes wins. Understanding this helps explain how species change, how diseases evolve, and why rare mutations matter.',
    plainHow:
      'Try nudging the "relative fitness" of the new type above 1 to make it stronger, or below 1 to make it weaker, and watch the "fixation probability" — your chance that it eventually spreads to the whole group. Notice that even a strong newcomer starting as a single individual usually still loses, and see the example trajectory climb toward the top (everyone) or fall to zero (gone).',
    terms: [
      {
        term: 'fixation',
        meaning: 'when the new type has spread to every single member of the group',
      },
      {
        term: 'relative fitness',
        meaning:
          'how good the new type is at having offspring compared to the original — above 1 is better, below 1 is worse',
      },
      {
        term: 'fixation probability',
        meaning:
          'the chance that the new type ends up taking over the whole group instead of dying out',
      },
    ],
  },
  'luria-delbruck': {
    plainWhat:
      'This recreates a famous 1943 experiment that asked a simple question: do germs "decide" to become resistant when they meet a threat, or were a few of them already resistant by pure chance? It grows many identical little batches of bacteria and counts how many survivors each batch has when hit by a bacteria-killing virus.',
    plainWhy:
      'It settled how resistance really appears: random copying mistakes happen while the bacteria are growing, long before any threat shows up. That is exactly why antibiotic resistance and drug-resistant infections can be lurking before we ever use the medicine, which shapes how doctors fight them today.',
    plainHow:
      'Try raising the mutation rate or the number of batches and watch the "variance-to-mean ratio." If survivors just popped up in a panic when the virus arrived, every batch would look about the same and this number would sit near 1. Instead you get a wild spread — most batches have almost none, while a lucky few hit the "jackpot" with huge numbers — and the ratio climbs far above 1. That big gap is the fingerprint that the resistant cells were already there, quietly passed down as the colony grew.',
    terms: [
      {
        term: 'jackpot',
        meaning:
          'A batch with a huge number of survivors, because a resistant cell appeared early and all its offspring inherited the trait.',
      },
      {
        term: 'variance-to-mean ratio',
        meaning:
          "A measure of how uneven the batches are. Near 1 means they're all similar; much bigger than 1 means a few batches are wildly higher than the rest.",
      },
      {
        term: 'mutation rate',
        meaning: 'How often a tiny random copying error happens as a cell divides.',
      },
    ],
  },
  'lotka-volterra': {
    plainWhat:
      'This models how two animal populations rise and fall together over time: a prey animal (like rabbits) and the predator that eats it (like foxes). More rabbits feed more foxes, more foxes eat down the rabbits, then the foxes go hungry and fade, and the rabbits bounce back, over and over.',
    plainWhy:
      'Understanding these boom-and-bust cycles helps people manage wildlife, fisheries, and pests. It even explains a surprise: spraying to kill a pest and its natural enemy at once can end up leaving you with MORE pests on average, because you also wiped out what was keeping them in check.',
    plainHow:
      'Try bumping up how fast the prey breed, or how deadly the predator is, then watch the two population lines swing up and down like a chase that never quite ends. The key numbers tell you the balance point each population circles around, and that both settle to that same balance point when you average them over full cycles.',
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
      "This models how tiny groups of things bump into each other and change, one event at a time, when the numbers are small enough that pure luck matters. It comes ready with three stories: things being born and dying, foxes chasing rabbits, and a gene switching on and off to make little bursts of a cell's building blocks.",
    plainWhy:
      'Inside a living cell there are often just a handful of copies of something, so chance really shakes the outcome — two identical cells can end up quite different. Seeing that randomness helps scientists understand why life is noisy and how cells cope with it.',
    plainHow:
      'Pick the foxes-and-rabbits story and watch the two lines swing up and down in wobbly, uneven waves — sometimes a population even crashes to zero and stays there. Try the birth-and-death story instead and change the birth rate: the headline "mean" number tells you roughly how many copies stick around once things settle. Keep the same seed and you get the exact same run every time, so you can compare fairly.',
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
      "Imagine scooping up a handful of living things from one population and reading a tiny piece of their DNA. Over time, random copying mistakes create brand-new versions of a gene, and this tool predicts how that handful splits into different versions — how many kinds you'd expect to see, and how common or rare each one is.",
    plainWhy:
      "It gives scientists a baseline for what pure chance and plain mutation look like, with no survival advantage helping any version win. When real DNA doesn't match this prediction, that's a clue something interesting is going on — like a trait being favored or a population that recently shrank or boomed.",
    plainHow:
      'Try turning up the mutation-rate dial and watch the "expected number of alleles" climb — faster mutation means more distinct versions in your sample, and more of them showing up as one-of-a-kind rarities. Turn it down and the handful collapses toward just a few shared versions. The "homozygosity" number tells you the chance that two individuals picked at random carry the very same version.',
    terms: [
      {
        term: 'allele',
        meaning:
          'One particular version of a gene; different individuals can carry different versions.',
      },
      {
        term: 'homozygosity',
        meaning:
          'The chance that two randomly picked individuals happen to carry the exact same version of the gene.',
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
      'Take a small group of living things of the same kind and trace their family trees backwards in time. This tool works out, on average, how those family lines merge together as you go back, until they all meet at one shared great-great-grandparent that every one of them descends from.',
    plainWhy:
      'The pattern of shared ancestors is written into DNA. By knowing what a normal family tree should look like, scientists can read the small differences between individuals to estimate how big a population was, how healthy and varied it is, and whether something unusual (like a recent disaster or a helpful trait spreading) has happened to it.',
    plainHow:
      'Try raising the sample size (how many individuals you pick) and watch the "time to common ancestor" number: it barely grows past a point, because the very last two family lines take about half the whole wait on their own. Then nudge the variation dial up and see the expected number of DNA differences climb right alongside it.',
    terms: [
      {
        term: 'common ancestor',
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
    ],
  },
  breeding: {
    plainWhat:
      'This is a virtual pea-and-pet breeding lab. You pick two parents and the traits they carry (like round or wrinkled seeds, coat colour, and so on), then it works out every kind of baby they could have and how likely each one is. It even hands you a batch of made-up offspring to look at.',
    plainWhy:
      'Guessing which traits get passed on is the heart of gardening, farming, and understanding how families inherit features like eye colour or certain health conditions. This lets anyone see those odds without waiting years for real plants or animals to grow.',
    plainHow:
      'Give each parent their traits, then watch the "most common" result and the mix of babies change. Try making one trait blend in the middle instead of one side winning, and see how the ratio of baby types shifts from a lopsided split to an even three-way spread.',
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
          'A small chance that a passed-down trait randomly flips to a different version in the sample babies shown.',
      },
    ],
  },
  'logistic-map': {
    plainWhat:
      "This is a super-simple model of an animal population that grows year after year but gets held back by crowding when it gets too big. Each new year's count depends only on last year's, using one short rule repeated over and over.",
    plainWhy:
      'It shows a surprising truth: even the simplest rule can produce wildly unpredictable results. This helped scientists understand why some populations settle into a steady number, some bounce between a few values, and others swing about with no pattern at all — a big idea behind the study of chaos.',
    plainHow:
      'Slowly turn up the growth dial and watch the picture change: at low values the population settles on one steady number, then it starts flipping between two, then four, and past about 3.6 it scatters into a fuzzy, never-repeating mess. The "chaotic" readout flips to yes once tiny changes in the starting point start leading to totally different futures.',
    terms: [
      {
        term: 'growth dial (r)',
        meaning:
          'How fast the population tries to grow each year; turning it higher pushes the model from calm to chaotic.',
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
          'a balanced point where all three moves are equally common and nothing pushes the mix to change',
      },
    ],
  },
  'substrate-inhibition': {
    plainWhat:
      "It models how fast tiny living things (microbes) grow when they feed on a chemical that helps them at first but becomes poisonous when there's too much of it. So as you add more food, growth speeds up, hits a sweet spot, then actually slows down again.",
    plainWhy:
      'Lots of real jobs rely on microbes eating things that turn toxic in big doses, like cleaning pollution out of water or breaking down chemical waste. Knowing the "just right" amount of food keeps the microbes healthy and working at their best instead of poisoning them.',
    plainHow:
      'Slide the food amount up and down and watch the growth curve: it climbs, reaches a peak, then dips as the food turns harmful. The tool marks the exact best food level and the safe range around it where growth stays strong, and shows a second curve for a microbe that never gets poisoned so you can see the difference.',
    terms: [
      { term: 'substrate', meaning: 'the food or chemical the microbes eat' },
      { term: 'growth rate', meaning: 'how quickly the microbes multiply' },
      { term: 'inhibition', meaning: 'the slowdown that happens when too much food turns toxic' },
    ],
  },
  'rosenzweig-macarthur': {
    plainWhat:
      'This is a model of two animals that need each other: prey (like rabbits) that eat plants, and predators (like foxes) that eat the prey. It follows how both populations rise and fall over time as the foxes hunt and the rabbits breed.',
    plainWhy:
      'Real nature works like this, and it holds a famous surprise: giving the prey more food to help them can actually make both animals crash into wild boom-and-bust swings. That warning matters for anyone trying to protect wildlife, manage fisheries, or run a farm without accidentally triggering chaos.',
    plainHow:
      'Try slowly turning up the "carrying capacity" (how much food and space the prey have) and watch the two population lines. At first they settle to steady, calm numbers, but past a tipping point they suddenly break into huge repeating boom-and-bust waves that never calm down.',
    terms: [
      {
        term: 'carrying capacity',
        meaning:
          'the largest prey population the land can feed and hold; turning it up is like giving the prey more food',
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
      "In nature, and in real lab and factory tanks, living things constantly compete for limited food. This reveals a famous rule: when two species need the exact same one resource, they can't both keep going forever — the more efficient one takes over and the other fades away.",
    plainHow:
      'Try making one microbe better at grabbing food when it\'s scarce (lower its "break-even food level") and watch that species climb while the other drops to almost nothing. The "surviving species" readout tells you who wins: the winner is the one that can keep growing on the least food, because it eats the shared food down so low that its rival starves.',
    terms: [
      {
        term: 'break-even food level (R*)',
        meaning:
          'The lowest amount of food a microbe needs just to hold steady; the microbe that survives on the least food wins.',
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
      'Imagine a plant or animal that lives in many separate patches of good habitat, like ponds in a valley or woodlands in farmland. This lab tracks what share of those patches have the species living in them, as it spreads into empty patches and dies out of others, and as some patches get bulldozed away.',
    plainWhy:
      'It helps explain how much wild habitat we can lose before a species vanishes for good, and warns that clearing too much land can doom a species even when you still see it around today. That "delayed goodbye" is a real danger for conservation.',
    plainHow:
      'Slide up the amount of habitat destroyed and watch the occupied-patches line. For a while the species hangs on, but push past a tipping point and the line slides all the way to zero, and the species is gone from the whole region, even though it looked fine just before.',
    terms: [
      {
        term: 'occupancy',
        meaning: 'The share of habitat patches that currently have the species living in them.',
      },
      {
        term: 'extinction threshold',
        meaning:
          'The point where so much habitat is gone that the species can no longer survive anywhere in the region.',
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
      'This is a virtual tank where tiny living things like yeast or bacteria eat sugar, multiply, and make a useful product (think brewing beer or growing the cells that make medicine). You pick how the tank is run: a sealed batch that you start and let finish, a tank you keep dripping fresh food into, or a tank with food flowing in and mixture flowing out nM steady stream.',
    plainWhy:
      'This is how we actually make beer, wine, yogurt, insulin, vaccines and lots of other things. Getting the settings right means more product from less food, which saves money and cuts waste in real factories.',
    plainHow:
      'Try lowering the food (substrate) the microbes start with, then watch the biomass line climb and flatten once the food runs out, and see how long it takes to run dry. In the continuous flow mode, try turning up the flow speed: push it too fast and the microbes get washed out of the tank faster than they can breed, so the population crashes to nothing.',
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
      'Change the four "score" numbers that say how well each behavior does against the other, then watch the line for how common the first behavior becomes. It might climb to everyone, drop to no one, settle at a steady mix of both, or tip one way or the other depending on where you start — and the lab tells you which of those four stories you got.',
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
      'This is a color-detective for liquids. Shine light through a clear sample that has two different colored substances mixed together, and the tool works out how much of each one is really there — just from the way the mixture soaks up different colors of light.',
    plainWhy:
      "This is one of the most common real tests in science and medicine: it's how labs measure things like the amount of a protein, a drug, or a dye in a sample. The clever part here is untangling two mixed substances at once, so you can read each one on its own without having to physically pull them apart.",
    plainHow:
      'Try sliding the two substances\' favorite colors closer together, then watch the \\"Spectra separable\\" readout. When their colors sit far apart, the tool cleanly recovers how much of each you put in. Slide them until they overlap and it warns you the two blur into one and can no longer be told apart — you only see their combined signal. Also watch the peak height climb as you add more of either substance.',
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
      'This is the classic school science moment where you slowly drip a strong cleaner-like liquid into a sour, weakly-acidic one, drop by drop, and watch how "sour vs. not-sour" changes. It traces that whole journey as a curve, so you can see the acid getting neutralized step by step.',
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
      'Try shrinking the particle\'s size, or warming things up, and watch the "diffusion coefficient" climb, meaning it spreads faster. Notice the wandering distance grows with the square root of time, so to go twice as far it needs four times as long, and check how many seconds it takes to drift across a cell.',
    terms: [
      {
        term: 'diffusion coefficient',
        meaning:
          'A single number for how quickly something spreads through a liquid; bigger means faster wandering.',
      },
      {
        term: 'hydrodynamic radius',
        meaning:
          'The effective size of the particle as the surrounding liquid feels it as it drifts along.',
      },
      {
        term: 'viscosity',
        meaning: 'How thick or syrupy a liquid is; honey is high, water is low.',
      },
    ],
  },
  'oxygen-transfer': {
    plainWhat:
      'This models how oxygen gets from air bubbles into the liquid where living cells are growing, like in a big tank that brews yeast or grows bacteria. The cells breathe that oxygen, and the tank has to keep resupplying it fast enough.',
    plainWhy:
      "Oxygen barely dissolves in water, so in a crowded tank of cells the oxygen supply often runs out before the food does. If cells can't breathe, they get stressed or die, which can ruin a batch of medicine, food, or fuel, so growers need to know how much stirring and bubbling is enough.",
    plainHow:
      'Try raising or lowering the oxygen supply strength and watch the "steady-state dissolved oxygen" number and the curve. If the supply is too weak, the tank flips to "oxygen-limited" and the oxygen level crashes below the safe line, telling you the cells can\'t get enough air; boost the supply and watch the level climb back to a healthy, steady value.',
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
    ],
  },
  'nicholson-bailey': {
    plainWhat:
      'This models a tiny insect drama that plays out over and over: a "host" bug (like a caterpillar) that breeds each season, and a "parasitoid" wasp that lays its eggs inside those bugs. Each new wasp hatches from a bug it took over, so the two numbers rise and fall together, generation after generation.',
    plainWhy:
      "This is the classic experiment that taught scientists a surprising lesson: when a predator-like attacker depends completely on one prey, their numbers don't settle into a calm balance. Instead they swing wilder and wilder until one side dies out. It's why real pest control and conservation need extra buffers, like hiding spots or crowding limits, to keep both species alive.",
    plainHow:
      'Press run and watch the two population lines: instead of steadying, they swing higher and lower each cycle, a runaway boom and bust. Try nudging the host\'s breeding rate up or down and watch how fast the swings blow up. The "outbreak vs equilibrium" number tells you how huge the wild swings get compared to the calm point the populations can never actually hold.',
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
      'Slide the flow speed up and down and watch the smudge line: go too slow and the parts spread out while they wait, go too fast and they smear on the way through. There is a "just right" speed in the dip of the curve where signals are sharpest, and the lab points it out for you along with how many clean, well-separated signals you can expect.',
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
      'Try raising how much you dissolve, or switch from sugar to salt (salt splits into two particles, so it tugs twice as hard). Watch the pulling strength climb and the readout tell you whether a cell dropped in this water would swell up, stay steady, or shrink.',
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
      'This models how the red stuff in your blood picks up oxygen in your lungs and hands it off to the rest of your body. It shows how full of oxygen your blood gets as the amount of oxygen around it goes up or down.',
    plainWhy:
      'Every cell in you needs a steady supply of oxygen, and this hand-off is how it arrives. The clever shape of this curve is exactly what lets your blood grab lots of oxygen in your lungs and then let go of a big chunk of it right where hard-working muscles and organs need it most.',
    plainHow:
      'Try nudging the "half-point" pressure higher (like the shift that happens in warm, hard-exercising muscle) and watch the amount of oxygen handed off to tissues jump up. The main readout tells you how full your blood is in the lungs, how full it still is coming back, and what share of its oxygen load it dropped off along the way.',
    terms: [
      {
        term: 'saturation',
        meaning: 'How full the blood is with oxygen, from empty to completely loaded.',
      },
      {
        term: 'partial pressure',
        meaning:
          'A measure of how much oxygen is present in a spot — high in the lungs, low in busy tissues.',
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
      'This models which way a chemical reaction naturally wants to go, and how much of it turns into new stuff before it settles into a steady balance. It also shows how heating or cooling can change that answer.',
    plainWhy:
      'Almost everything around you, from batteries and cooking to the reactions inside living cells, depends on whether a reaction runs on its own or needs a push. Knowing the direction and how temperature flips it helps people design medicines, materials, and clean energy.',
    plainHow:
      'Try sliding the temperature up and down and watch the "direction" readout: some reactions that go one way when cold suddenly reverse when hot. The main number tells you which way the reaction runs and what share of the starting material ends up transformed once things settle.',
    terms: [
      {
        term: 'equilibrium',
        meaning:
          'The steady balance point where a reaction stops changing overall, because it goes both ways at the same speed.',
      },
      {
        term: 'spontaneous',
        meaning: 'A reaction that runs on its own without needing an outside push.',
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
      'This models how a disease spreads through a group of people over time. Everyone is sorted into buckets, like still-healthy, currently sick, and recovered, and the tool tracks how people move from one bucket to the next as an outbreak plays out.',
    plainWhy:
      'It is the same kind of math public-health teams use to guess how bad an outbreak could get, how many people might get sick at once, and whether enough people being immune can stop it from spreading.',
    plainHow:
      'Try turning up how easily the disease passes between people and watch the "peak" climb higher and arrive sooner. The main number to watch tells you whether the outbreak takes off and grows or simply fizzles out, and how big a share of everyone eventually catches it.',
    terms: [
      {
        term: 'R-zero (R0)',
        meaning:
          'The average number of people one sick person passes the disease to. Above 1 it spreads, below 1 it dies out.',
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
    ],
  },
  'reed-frost': {
    plainWhat:
      'This models how a contagious illness spreads through a group of people, step by step, in waves called "generations." Each wave, the people who are sick right now can pass the illness to people who haven\'t caught it yet, and you watch how big the outbreak grows.',
    plainWhy:
      'Understanding how fast a disease spreads, how many people it eventually reaches, and how many need to be protected to stop it helps doctors, schools, and health workers plan vaccinations and decide when to act.',
    plainHow:
      'Try nudging the "spread number" up or down and watch the outbreak curve change: below one, it fizzles out fast; above one, it explodes into a big wave. The main result tells you what share of the whole group ends up catching it, and which wave was the worst.',
    terms: [
      {
        term: 'Spread number (R0)',
        meaning:
          'The average number of new people one sick person passes the illness to. Above one, it grows; below one, it dies out.',
      },
      {
        term: 'Generation',
        meaning: "One round of spreading — today's sick people infecting the next batch.",
      },
      {
        term: 'Attack rate',
        meaning: 'The share of the whole group that catches the illness by the end.',
      },
      {
        term: 'Herd-immunity threshold',
        meaning: "How much of the group needs to be protected before the outbreak can't take off.",
      },
    ],
  },
  admet: {
    plainWhat:
      'This is a quick check that tells you whether a molecule could work as a pill you swallow. You type in a molecule (either its recipe-like text code or a few numbers about it), and it scores how likely your body could absorb and use it.',
    plainWhy:
      "Most would-be medicines fail not because they don't fight the disease, but because the body can't take them in as a pill. Catching that early, before anyone spends years and money making the real thing, saves huge effort and helps good medicines reach people faster.",
    plainHow:
      'Paste in a molecule (try aspirin\'s code: CC(=O)Oc1ccccc1C(=O)O) and watch the drug-likeness score, a number from 0 to 1 where higher means more pill-friendly. Then make the molecule bigger or greasier and watch the score drop and warning flags appear, showing you which classic "good medicine" limits it just broke.',
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
    ],
  },
  'pk-two-compartment': {
    plainWhat:
      "This models what happens to a medicine after it's injected straight into a vein all at once. The drug spreads from the blood into the body's tissues and slowly seeps back, while the body steadily removes it, so you can watch its level in the blood rise and fall over time.",
    plainWhy:
      'Doctors need to know how long a medicine stays strong enough to work but not so strong it becomes harmful. This kind of picture helps decide the right dose and how often to give it, so treatments are both safe and effective.',
    plainHow:
      'Try lowering the clearance (how fast the body cleans the drug out) and watch the blood curve stay higher for longer. The two lines show the drug in the blood and in the tissues: the blood level starts at its peak and drops quickly at first as the drug spreads into tissue, then fades slowly as the body clears it away.',
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
      "Some diseases don't burn out after one big wave — they settle in and stay for good, quietly infecting a steady slice of people forever. Knowing whether a bug will fade away or stick around helps health workers decide how hard to push things like treatment and prevention to finally stamp it out.",
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
      "This models how a small molecule (like a possible medicine) settles into a pocket on a much larger protein in your body. You give it a few ways the small piece could be placed and turned, and it works out which fit sits most snugly, the way you'd try a key in a lock.",
    plainWhy:
      'Finding a molecule that fits a protein snugly is the first step in inventing new drugs. Testing fits on a computer first saves scientists years of lab work and helps them zero in on the shapes worth trying for real.',
    plainHow:
      'Nudge one of the placements a little closer or turned a different way, then watch the "best pose energy" number. A lower (more negative) number means a snugger, more comfortable fit; the tool also tells you which placement won and how close the pieces touch.',
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
    ],
  },
  'dose-response': {
    plainWhat:
      'This models how much a drug actually does something as you give more or less of it. It draws the classic S-shaped curve where a tiny dose does almost nothing, a middle dose does more, and past a certain point piling on more barely helps.',
    plainWhy:
      "It's how scientists figure out the right amount of a medicine: enough to work, not so much it's wasteful or harmful. It also helps them see whether two drugs taken together help each other or just get in the way.",
    plainHow:
      "Slide the potency (the amount needed to reach the halfway effect) and watch the whole curve shift left or right; a smaller number means the drug works at a lower dose. Change the steepness to see the curve go from a gentle ramp to a sharp on/off switch, and read off the amount that gets you halfway to the drug's full effect.",
    terms: [
      {
        term: 'EC50',
        meaning:
          "The dose that gets you halfway to the drug's biggest effect — a quick measure of how strong it is.",
      },
      {
        term: 'IC50',
        meaning:
          'For drugs that shut something down, the dose that cuts the response to half of normal.',
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
      'RNA is a long thread of chemical "letters" that a cell makes. Left alone, the thread folds back and sticks to itself, forming loops and stems. This lab takes a sequence you type and works out one neat shape it could fold into, guessing the folding that lets the most letters pair up.',
    plainWhy:
      'The shape an RNA thread folds into decides what job it can do in a living thing, from switching genes on and off to helping build proteins. Being able to guess that shape from just the letters helps scientists understand life and design things like vaccines and new medicines.',
    plainHow:
      'Type a sequence and watch the dot-bracket picture: matching brackets are two letters holding hands, and dots are letters left loose. Try a sequence with a run of one letter followed by its partners (like GGGG then CCCC) and watch a tidy stem snap together. The "base pairs" number tells you how many letters found a partner, so more pairs means a more tightly folded thread.',
    terms: [
      {
        term: 'base pair',
        meaning: 'Two RNA letters that fit together and hold hands, like puzzle pieces.',
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
    ],
  },
  'dna-melting': {
    plainWhat:
      'DNA is made of two matching strands that zip together like the two sides of a zipper. This lab heats them up and shows how the two strands come apart, or "melt," as it gets hotter.',
    plainWhy:
      'Splitting DNA apart by heating it is a key step in tests that read genes, spot viruses, or match a sample to a person. Knowing the exact temperature where the strands let go helps scientists design those tests so they work reliably.',
    plainHow:
      'Set the temperature range and watch the curve slide from fully zipped down to fully apart as things heat up. The melting temperature is the halfway point, where exactly half the strands have come undone. Now try raising the amount of DNA in the mix and notice the melting temperature creep up a little, a giveaway that it takes two strands finding each other to zip up.',
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
          'How wide a temperature span the melt takes; a narrow span means the strands let go sharply, almost all at once.',
      },
    ],
  },
  fret: {
    plainWhat:
      'This is a molecular tape measure. Scientists attach two tiny glowing tags to a protein or a strand of DNA. When the tags are very close, one hands its light-energy to the other instead of glowing on its own, and how much gets handed over tells you exactly how far apart they are.',
    plainWhy:
      "It lets people measure distances a million times smaller than a grain of sand, without ever touching or breaking the thing they're looking at. That's how we watch proteins fold, snap shut, or grab their partners in real time, which helps us understand disease and design medicines.",
    plainHow:
      'Slide the distance between the two tags and watch the transfer number: bring them close and almost all the energy jumps across (near 100%); pull them apart and the handoff fades fast to nearly nothing. Notice how the sweet spot where it changes sharply is the range where the ruler works best.',
    terms: [
      {
        term: 'transfer efficiency',
        meaning:
          "How much of the glow-energy gets passed from one tag to the other; high when they're close, low when far.",
      },
      {
        term: 'Forster radius',
        meaning:
          "The special distance where exactly half the energy gets handed over — the ruler's middle mark, set by which tags you use.",
      },
      {
        term: 'nanometre',
        meaning:
          'A distance so small that millions would fit across the width of a hair; the scale this ruler measures.',
      },
    ],
  },
  'worm-like-chain': {
    plainWhat:
      'This mimics what happens when scientists grab a single strand of DNA by its ends and gently pull it straight. Left alone, DNA flops into a loose, tangled coil; this tool shows how hard you have to tug to stretch it out.',
    plainWhy:
      "DNA doesn't just sit still in your cells — it gets bent, packed, and pulled apart every time a cell copies itself or reads a gene. Knowing exactly how stretchy and springy DNA is helps scientists understand those everyday cell machines and build tiny tools that handle single molecules.",
    plainHow:
      'Try dragging the stretch closer to fully straight and watch the force shoot up fast — at first the DNA gives easily like a soft rubber band, but as it runs out of slack it suddenly fights back hard. The curve you see is the same one real labs measure when they pull on one molecule with a laser or magnet.',
    terms: [
      {
        term: 'persistence length',
        meaning:
          'How floppy or stiff the strand is — a bigger number means it stays straight over a longer stretch before bending.',
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
};

/** The plain-language help card for an engine, or null if none exists yet. */
export function helpForEngine(slug: string): HelpCard | null {
  return ENGINE_HELP[slug] ?? null;
}
