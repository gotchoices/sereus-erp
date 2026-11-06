#!/usr/bin/env node
import { MODULES } from '@wyatt/core';

const [command = 'help'] = process.argv.slice(2);

switch (command) {
  case 'modules':
    for (const m of MODULES) {
      const start = m.initial ? 'start' : 'later';
      console.log(`${m.key.padEnd(8)} ${m.strand.padEnd(15)} ${m.sApp.padEnd(6)} ${start}  ${m.title}`);
    }
    break;
  default:
    console.log('usage: wyatt <command>\n\ncommands:\n  modules   list the modules and their strands');
}
