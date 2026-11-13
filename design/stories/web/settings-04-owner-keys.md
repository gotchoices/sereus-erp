# User Story: Keep the installation safe with owner and recovery keys

## Story Overview
As the person responsible for our installation
I want to see our owner keys, make a recovery key, and give another person or machine owner rights
So that losing one machine or one person never locks us out

Context: deployment.md §5. Owner keys belong to people, not machines. The web app's machine holds one when it founded the party (settings-02). A terminal does the same with `cadre owner-key export|import` and `cadre start --owner`.

## Sequence
1. Owner opens Settings, **Owner keys**. Each key shows its label ("office desktop", "paper backup"), its short fingerprint, and whether this machine holds it.
2. While there is only one owner key, a notice says so and offers **Make a recovery key**.
3. **Make a recovery key:** owner chooses between an owner grant (a code that makes a new owner key when redeemed; nothing secret leaves this machine) and an export of this machine's key, locked with a passphrase. Owner labels it, sees it as text and QR code, and is told plainly to store it offline: whoever has it is an owner.
4. **Give owner rights:** to another machine of the party (it redeems an owner grant), or to a person's own key. The new key appears in the list with its label.
5. **Remove an owner key:** the confirmation names it and is refused for the last key, or for the key the owner is signing with.

## Acceptance Criteria
- [ ] A key made or removed from a terminal shows up here the same.
- [ ] No page shows an owner private key except the export the owner asked for, after the warning.
- [ ] A recovery grant redeemed on a fresh machine (settings-02 Q1) makes that machine an owner.

## Questions (for the owner; the working default is used until answered)
- Q1. Should the app refuse ordinary work until a recovery key exists? *Default: no; it keeps the notice up.*
- Q2. Hardware keys (YubiKey)? *Default: later; Sereus has them in its backlog.*
