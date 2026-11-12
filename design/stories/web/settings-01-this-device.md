# User Story: See this device and what it holds

## Story Overview
As anyone using WyattERP on this device
I want to see which device I am on, which of my party's machines it knows, which strands it holds and whether it is connected
So that I know whether my changes are reaching the others, and what to tell someone helping me

Context: WyattERP keeps its data on each member's own devices (domain/architecture.md §1, §8). The top bar says only "Connected" or "This device only"; Settings is where the detail is. Inviting machines and people, and offline mode, come in later stories.

## Sequence
1. User opens Settings from the top bar.
2. User sees this device: its ID (short, with the full one available to copy), whether it is an owner of the party, and where it keeps its data.
3. User sees the party's machines that this device knows: each one's ID, whether it is this device, whether it is trusted, and when it was last heard from.
4. User sees the strands this device holds: what each is (the catalog, for now), its state (starting, syncing, active and so on), and whether it is online or offline. For each, the party's machines that hold it but are not connected now.
5. User sees the connection: how many of the party's machines are connected, and the addresses others could reach this device at (none, if it is not listening).
6. When the app runs on an in-memory catalog (a review variant), Settings says so and shows no device.

## Acceptance Criteria
- [ ] Nothing on Settings changes data in this story: it only shows.
- [ ] The device ID can be copied whole, to give to someone helping.
- [ ] A strand that is not yet writable (still syncing) is shown as such, not as missing.

## Questions (for the owner; the working default is used until answered)
- Q1. Should adding another machine of the party (a cadre invitation) or inviting another person to the catalog strand happen on Settings? *Default: yes, on Settings, in a later story. It needs the device to be reachable (listen addresses or a relay), which the dev setup doesn't configure yet.*
- Q2. Should the user be able to put a strand offline here, to keep working while away? *Default: shown here now, switched here later, with the offline part-numbering work (STATUS open items).*
- Q3. Should machines be given names people recognize ("shop laptop")? *Default: IDs only for now; names come with the invitation story.*
