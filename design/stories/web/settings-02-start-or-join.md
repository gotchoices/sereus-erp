# User Story: Start a new installation, or join one

## Story Overview
As the person setting up WyattERP on a machine for the first time
I want to choose between starting a new installation and joining my company's existing one
So that a new machine never splits off into a separate, empty installation by mistake

Context: deployment.md §4 and §7 set the rules: a first machine founds the party and its catalog strand; every other machine joins by a machine invitation and finds the strand. The invitation may have been made in the web app (settings-03) or from a terminal (`cadre enroll invite`); it is the same text either way.

## Sequence
1. User starts the web app on a machine that has never been set up and opens it in a browser.
2. User sees a first-run page with two choices: **Start a new installation** and **Join an existing one**. Nothing else in the app works until one is chosen.
3. **Start new:** user names this machine ("front office") and the company. The app founds the party, makes this machine's owner key, founds the first catalog strand (named "Catalog", which the user may rename, settings-05), and opens it. A notice says there is only one owner key and offers to make a recovery key now (settings-04).
4. **Join:** user pastes the invitation an owner gave them and names this machine. The app shows "Joining…", then which machine admitted it. The catalog shows as syncing (settings-01) until its copy arrives, then opens.
5. If the invitation is refused (used, expired, withdrawn, or for another machine), the user sees why and can paste another. If no member named in it can be reached, the user sees that and can retry; nothing has been founded meanwhile.

## Acceptance Criteria
- [ ] A machine that chose Join never founds a party, and does not offer to found a catalog strand until it has finished joining.
- [ ] An invitation made from a terminal is accepted exactly like one made in the web app.
- [ ] The choice is made once: later starts open the app directly.
- [ ] A machine started as a storage machine from a terminal is not affected: it joins by its own command.

## Questions (for the owner; the working default is used until answered)
- Q1. Should Join also accept a recovery key or owner grant, so the machine joins as an owner in one step? *Default: yes, as a second paste field, "I also have an owner grant".*
- Q2. Can a running machine leave its party and join another (a test install, then the real one)? *Default: not in the app; the data folder is reset from a terminal.*
