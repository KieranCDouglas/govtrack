import { ExternalLink } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">About Civicism</h1>
      <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
        A nonpartisan civic engagement tool for tracking Congress, exploring political ideology, and understanding your local ballot.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-3">What is Civicism?</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Civicism is a free, open tool designed to make the U.S. political landscape more legible. It aggregates public voting data, interest-group ratings, and ballot initiative information into a unified interface — so anyone can explore how their representatives vote, where they fall ideologically, and how upcoming ballot measures align with their own values.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The project is nonpartisan. It does not advocate for any candidate, party, or policy position. All ideology scores and ballot alignments are derived algorithmically from public data.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-3">Data Sources</h2>
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">GovTrack.us</span>
              <a href="https://www.govtrack.us" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 text-xs">
                govtrack.us <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">Roll-call votes, member rosters, and ideology scores for every member of the 93rd–119th Congress. GovTrack's ideology scores are based on bill co-sponsorship patterns and serve as the foundation for our two-dimensional political compass.</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">Ballotpedia</span>
              <a href="https://www.ballotpedia.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 text-xs">
                ballotpedia.org <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">Ballot measure data including measure descriptions, election dates, and sponsoring organizations. Civicism uses Ballotpedia's public data to surface upcoming local and statewide initiatives.</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <span className="font-semibold text-foreground block mb-1">Interest-Group Ratings</span>
            <p className="text-sm text-muted-foreground">Ratings from organizations including the ACLU, ADA, ACU, Club for Growth, AFL-CIO, NRA, LCV, and others are incorporated into member ideology profiles to capture dimensions of political behavior that roll-call votes alone may not reflect.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-3">Ideology Scores & the Political Compass</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">
          Each member of Congress is placed on a two-dimensional compass using a composite score derived from:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-1.5 mb-3 text-sm leading-relaxed">
          <li>Roll-call voting patterns (the primary signal)</li>
          <li>Bill co-sponsorship networks</li>
          <li>Interest-group ratings across economic and social dimensions</li>
          <li>Media behavior and campaign donor profiles (supplementary)</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed text-sm">
          The horizontal axis (economic) runs from interventionist/collectivist on the left to free-market/individualist on the right. The vertical axis (social) runs from progressive/liberal on the top to traditional/conservative on the bottom. The four quadrants are labeled Populist, American Left, American Right, and Libertarian.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-foreground mb-3">The Ideology Quiz</h2>
        <p className="text-muted-foreground leading-relaxed text-sm">
          The quiz places you on the same compass as members of Congress using a short series of policy questions spanning economic, social, foreign policy, and governance dimensions. Your score is stored locally in your browser — nothing is sent to a server. Once scored, the Ballot Measures page uses your per-category responses to generate personalized alignment nudges for upcoming initiatives.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="text-xl font-bold text-foreground mb-3">Limitations & Caveats</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-1.5 text-sm leading-relaxed">
          <li>Ideology scores reflect <em>observable voting behavior</em>, not stated beliefs or motivations.</li>
          <li>Historical members (pre-2000) have fewer data points and wider confidence intervals.</li>
          <li>Ballot measure partisan leanings are inferred from sponsoring organizations and keyword signals — classification is imperfect.</li>
          <li>Data is updated periodically, not in real time. Vote counts and member rosters may lag by days.</li>
        </ul>
      </section>
    </div>
  );
}
