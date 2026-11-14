# wyatt: the WyattERP command

`wyatt` runs a WyattERP machine without a browser (a server, a closet machine) and manages
an installation from a terminal. It does what the web app's Settings does: start or join an
installation, invite and remove machines, owner and recovery keys, catalogs, backup and
restore. It runs the same code as the web app (`@wyatt/node`), so an installation started
with one works the same in the other (design/specs/domain/deployment.md).

## Terms

* An **installation** is one company's WyattERP: its data, kept on each of its machines and
  shared between them. Sereus calls it a party, and its machines the cadre.
* A **machine** is one running copy: the web app on a desktop, or `wyatt serve` on a server.
  Each has its own folder (`~/.wyatt` by default) and a name people choose.
* An **owner key** admits and removes machines and founds catalogs. The machine that starts
  an installation holds one. Others get one by an owner grant.
* A **catalog** is a strand: the product data every machine holds a copy of.

## Quickstart

On a server, with Node.js 22 or later (developed on 24) and git:

```bash
git clone <this repository> wyatterp && cd wyatterp
corepack enable && yarn install && yarn build
alias wyatt="node $PWD/apps/cli/dist/main.js"

wyatt init new --name "office server" --company "Acme Manufacturing" --public erp.example.com
wyatt serve                                  # leave running (or: wyatt service, below)
```

In a second terminal on the server:

```bash
wyatt owner-grant --label "recovery" --backup > recovery.txt   # print it, keep it offline, delete the file
wyatt invite --label "front office" > invite.txt               # one invitation per machine
```

On a desktop (the same checkout, built), start the web app with `cd apps/web && yarn app` and
open http://localhost:5180. It keeps its data in `~/.wyatt-web` (`WYATT_HOME` to change it).
Choose **Join an existing installation**, and paste the invitation. The catalog
copies over, and the app opens on it. Or join another server from its terminal:

```bash
wyatt init join "$(cat invite.txt)" --name "closet server"
wyatt serve
```

## Setting up a machine

```
wyatt init new --name <machine> --company <company> [options]
```

Starts a new installation on this machine. The machine founds it, holds its first owner key,
and founds the first catalog, named `Catalog` (`--catalog <name>`, `--purpose <text>`). The
catalog gets a starting set of units (each, pair, meter, millimeter, inch, kilogram, liter,
hour…), product classes (assemblies, bought components, raw materials, supplies, kits, custom)
and operations (cut, drill, assemble, test…), to adjust later. `--no-starter` leaves it empty,
for instance to restore an export into it.

```
wyatt init join <invitation> --name <machine> [--owner-grant <grant>]
```

Joins an installation with an invitation an owner made (`wyatt invite`, or the web app's
Settings, Machines). It waits up to 3 minutes for a machine of the installation to answer.
Nothing is set up if the invitation is refused or no machine answers; try again. With
`--owner-grant` the machine joins as an owner too.

A machine is set up once. To set it up again, stop it and delete its folder.

### Network options (for `init`)

| Option | Default | Meaning |
|---|---|---|
| `--port <n>` | 4101 | TCP port. WebSocket listens on the next port (4102); `--no-ws` turns it off. |
| `--public <host>` | none | The name or address machines elsewhere reach this one at. Announced to the others. |
| `--desktop` | | A machine that is not a server: any free port, no relay service. |

A server also relays for machines that cannot be dialed (a laptop behind a home router):
they reserve a slot on it when they join, and the others reach them through it. They need no
port forwarding.

The settings are kept in `<folder>/installation.json` (`network`), which you may edit while
the machine is stopped.

## Running

```
wyatt serve
```

Runs this machine's node until stopped (Ctrl-C). It prints where it can be reached, then a
line whenever the number of connected machines or a catalog's state changes. While it runs,
every other `wyatt` command goes to it over a local admin channel (loopback only, a token in
`<folder>/admin.json`). When it does not run, a command starts the node for itself and stops
it afterwards.

```
wyatt service [--system]
```

Prints a service definition that runs `wyatt serve` at boot (systemd on Linux, launchd on
macOS) and the commands that install it. On Linux the default is a user unit; `--system`
writes a system unit run as you.

## Managing the installation

| Command | What it does |
|---|---|
| `wyatt status` | This machine, its connections, addresses and catalogs |
| `wyatt machines` | The installation's machines, by name |
| `wyatt invite [--label <name>] [--days <n>]` | An invitation for one machine (default 7 days, at most 30). The text goes to stdout |
| `wyatt invitations` / `wyatt withdraw <key>` | Invitations made here; withdraw one not yet used |
| `wyatt remove-machine <name or id> [--accept-loss]` | Remove a machine. Refused while this machine is still copying a catalog the other may hold the only copy of, unless `--accept-loss` |
| `wyatt name-machine <name or id> <new name>` | Rename a machine |
| `wyatt owner-keys` | The owner keys, by label and fingerprint |
| `wyatt owner-grant --label <text> [--backup]` | A grant that makes whoever redeems it an owner (1 day). `--backup` never expires: a recovery key |
| `wyatt redeem-grant <grant>` | Make this machine an owner |
| `wyatt export-owner-key [--passphrase-file <f>]` / `import-owner-key` | Move this machine's owner key as text, locked with a passphrase |
| `wyatt remove-owner-key <fingerprint>` | Remove an owner key (never the last one) |
| `wyatt strands` | The catalogs: name, company, what each is for, and whether it is ready here |
| `wyatt found --name <name> [--purpose <text>]` | Found another, separate catalog |
| `wyatt use <name or id>` | Choose the catalog this machine works in, when there are several |
| `wyatt export [<file>]` | Export the catalog to YAML (stdout without a file) |
| `wyatt restore <file> [--yes]` | Restore an export into this catalog, which must have no families yet |
| `wyatt units`, `classes`, `operations`, `families`, `family <base>`, `parts [<base>]` | Read the catalog |

Add `--json` to any command for machine-readable output, and `--home <dir>` (or
`WYATT_HOME`) to use a folder other than `~/.wyatt`.

## Common tasks

**Make the installation safe.** Right after `init new`, make a recovery key and keep it
offline: `wyatt owner-grant --label "paper backup" --backup`. Whoever holds it can become an
owner, so print it rather than leaving it on a machine.

**Add a server for redundancy.** On an owner machine: `wyatt invite --label "closet server"`.
On the new server: `wyatt init join '<invitation>' --name "closet server" && wyatt serve`.
It copies every catalog and keeps it current.

**Move a server** (house to office, or onto new hardware). Invite the new one and start it.
If the old one held an owner key, give the new one owner rights too (`wyatt owner-grant` on
the old one, `wyatt redeem-grant` on the new one). Wait until `wyatt strands` on the new one
shows every catalog `ready`. Then, from the new one, `wyatt remove-machine "old server"` and,
if no one keeps it, `wyatt remove-owner-key <its fingerprint>`. No files are copied.

**Back up to a file.** `wyatt export acme-catalog.yaml` writes every record, with its
identifiers, part numbers, authors and dates. To restore after losing every machine:
`wyatt init new … --no-starter`, then `wyatt restore acme-catalog.yaml --yes`.

## Deploying on a Linux server

1. A user for it, and the code:
   ```bash
   sudo useradd --create-home --shell /bin/bash wyatt
   sudo -iu wyatt
   git clone <this repository> wyatterp && cd wyatterp && corepack enable && yarn install && yarn build
   ```
2. Open the ports: `sudo ufw allow 4101:4102/tcp`. A server behind a router needs those two
   ports forwarded to it, and `--public` set to the router's public name or address.
3. Set it up and install the service (as the `wyatt` user):
   ```bash
   node apps/cli/dist/main.js init new --name "office server" --company "Acme" --public erp.example.com
   node apps/cli/dist/main.js service > ~/.config/systemd/user/wyatt.service   # mkdir -p ~/.config/systemd/user first
   systemctl --user daemon-reload && systemctl --user enable --now wyatt
   sudo loginctl enable-linger wyatt
   ```
4. `journalctl --user -u wyatt -f` shows its log, and `wyatt status` its state.

The folder (`~/.wyatt`) holds the machine's identity and owner key: keep it private (it is
created readable only by its user). A lost server is replaced by inviting a new one, not by
restoring its folder.

**Reachability.** Machines reach each other by any means libp2p offers (deployment.md §8). A
server with a public address and the two ports open is reachable from anywhere. Machines that
cannot be dialed reach the others through it. Each catalog also runs on its own port, chosen at
start; a machine that can dial those ports talks to it directly, and one that cannot goes
through the relay. A machine no one can reach still works alone, and syncs when it can.

## Upgrading

```bash
cd wyatterp && git pull && yarn install && yarn build
systemctl --user restart wyatt
```

Upgrade every machine of the installation. A newer catalog schema is applied by each machine
when it starts.
