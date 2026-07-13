/**
 * Completion Command
 *
 * Generates shell tab-completion scripts for bash, zsh, and PowerShell.
 * Commander handles argument/option completion natively; this command
 * wraps that into a user-facing `devdoctor completion <shell>` subcommand.
 *
 * Usage:
 *   devdoctor completion bash   >> ~/.bashrc
 *   devdoctor completion zsh    >> ~/.zshrc
 *   devdoctor completion pwsh   >> $PROFILE
 */

import { Command } from 'commander';
import { theme } from '../ui/formatter.js';
import chalk from 'chalk';

const SHELLS = ['bash', 'zsh', 'fish', 'pwsh'] as const;
type Shell = (typeof SHELLS)[number];

/** Bash/Zsh completion script — registered as a programmable completion. */
function bashScript(binName: string): string {
  return `
# Dev Doctor bash/zsh tab completion
# Source this file or add the line below to your ~/.bashrc or ~/.zshrc:
#   source <(${binName} completion bash)

_${binName.replace(/-/g, '_')}_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="diagnose fix doctor info env completion"
  local plugins="node mysql git"

  case "\${prev}" in
    diagnose|fix)
      COMPREPLY=( $(compgen -W "\${plugins}" -- "\${cur}") )
      return ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish pwsh" -- "\${cur}") )
      return ;;
    --format|-f)
      COMPREPLY=( $(compgen -W "terminal json markdown" -- "\${cur}") )
      return ;;
  esac

  if [[ "\${cur}" == -* ]]; then
    COMPREPLY=( $(compgen -W "--help --version --quiet" -- "\${cur}") )
  else
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
  fi
}

complete -F _${binName.replace(/-/g, '_')}_completions ${binName}
`.trimStart();
}

/** Fish completion script. */
function fishScript(binName: string): string {
  return `
# Dev Doctor fish tab completion
# Save to: ~/.config/fish/completions/${binName}.fish

set -l commands diagnose fix doctor info env completion
set -l plugins node mysql git
set -l formats terminal json markdown

complete -c ${binName} -f
complete -c ${binName} -n "__fish_use_subcommand" -a diagnose   -d "Run diagnostic checks for a plugin"
complete -c ${binName} -n "__fish_use_subcommand" -a fix        -d "Safely repair issues for a plugin"
complete -c ${binName} -n "__fish_use_subcommand" -a doctor     -d "Full health check dashboard"
complete -c ${binName} -n "__fish_use_subcommand" -a info       -d "Display system information"
complete -c ${binName} -n "__fish_use_subcommand" -a env        -d "Display environment variables"
complete -c ${binName} -n "__fish_use_subcommand" -a completion -d "Generate shell completion script"

complete -c ${binName} -n "__fish_seen_subcommand_from diagnose fix" -a "$plugins"
complete -c ${binName} -n "__fish_seen_subcommand_from diagnose doctor" -l format -s f -a "$formats" -d "Output format"
complete -c ${binName} -n "__fish_seen_subcommand_from diagnose doctor" -l output  -s o -d "Write report to file"
complete -c ${binName} -n "__fish_seen_subcommand_from fix"  -l yes    -s y -d "Auto-confirm all repairs"
complete -c ${binName} -n "__fish_seen_subcommand_from fix"  -l dry-run     -d "Preview repairs without applying"
complete -c ${binName} -l quiet -s q -d "Suppress all styling and spinners"
complete -c ${binName} -l version -s V -d "Display version"
`.trimStart();
}

/** PowerShell completion script. */
function pwshScript(binName: string): string {
  return `
# Dev Doctor PowerShell tab completion
# Add the following to your $PROFILE:
#   ${binName} completion pwsh | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName '${binName}' -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @('diagnose', 'fix', 'doctor', 'info', 'env', 'completion')
  $plugins  = @('node', 'mysql', 'git')
  $formats  = @('terminal', 'json', 'markdown')
  $tokens   = $commandAst.ToString() -split ' '
  $subCmd   = if ($tokens.Count -gt 1) { $tokens[1] } else { '' }

  $candidates = switch ($subCmd) {
    { $_ -in 'diagnose', 'fix' } { $plugins }
    'completion'                  { @('bash', 'zsh', 'fish', 'pwsh') }
    default                       { $commands }
  }

  $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`.trimStart();
}

export function createCompletionCommand(binName: string): Command {
  return new Command('completion')
    .description('Generate a shell tab-completion script.')
    .argument(
      '<shell>',
      `Shell to generate completions for: ${SHELLS.join(', ')}`,
    )
    .addHelpText(
      'after',
      `
Examples:
  ${chalk.cyan(`${binName} completion bash`)}   >> ~/.bashrc && source ~/.bashrc
  ${chalk.cyan(`${binName} completion zsh`)}    >> ~/.zshrc  && source ~/.zshrc
  ${chalk.cyan(`${binName} completion fish`)}   > ~/.config/fish/completions/${binName}.fish
  ${chalk.cyan(`${binName} completion pwsh`)}   >> $PROFILE
`,
    )
    .action((shell: string) => {
      const s = shell.toLowerCase() as Shell;

      if (!SHELLS.includes(s)) {
        console.error(
          `  ${theme.error(`✖ Unknown shell: "${shell}"`)}`,
        );
        console.error(
          `  ${theme.muted('Supported shells:')} ${SHELLS.map((x) => chalk.white(x)).join(theme.muted(', '))}`,
        );
        process.exitCode = 1;
        return;
      }

      let script: string;
      switch (s) {
        case 'bash':
        case 'zsh':
          script = bashScript(binName);
          break;
        case 'fish':
          script = fishScript(binName);
          break;
        case 'pwsh':
          script = pwshScript(binName);
          break;
      }

      process.stdout.write(script + '\n');
    });
}
