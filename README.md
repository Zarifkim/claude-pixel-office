# Pixel Office

A Claude Code mod that opens a pane with an isometric pixel-art office. Claude
stands at its desk and every subagent walks in through the door, works at a
desk of its own and walks out when it is done.

- **What they're doing:** the character and its speech bubble follow the tool
  in use: typing for edits, reading for file searches, a terminal for shell
  commands, browsing for web tools.
- **When you're needed:** a yellow "needs you" card appears when an agent is
  waiting for your permission or an answer.
- **Details:** click a name under the office to label that person in the scene
  and see their status, folder, tool calls, tokens and recent actions.
- **Day and night:** the office switches to its night look from 7 pm to 7 am.

Type `/office` to open the pane if it is closed.

## Install

At the prompt of a terminal session:

```
/plugin install pixel-office --marketplace Zarifkim/claude-pixel-office
```

Answer `y` to add the marketplace, then pick a scope (the user scope loads it
in every session).

From a shell:

```bash
claude plugin install pixel-office --marketplace Zarifkim/claude-pixel-office
```

In the desktop app, where `/plugin` does not run: click + next to the prompt
box, then Plugins, Add marketplace with `Zarifkim/claude-pixel-office`, then
Add plugin.

The office picture shows in the Claude Code desktop app. In a terminal the pane
lists the agents and their status as text.

## Credits

The office, furniture, characters, walk cycles and effect icons are the
MIT-licensed default art of [W17ant/Claude-Office](https://github.com/W17ant/Claude-Office),
downscaled and baked into `hooks/sprites.gen.ts`. Its licence is in
`ASSETS-LICENSE`. The Dunder Mifflin skin from that project is not used.

The mod's own code is under the MIT licence in `LICENSE`.
