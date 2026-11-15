param([string]$HostName="claude",[string]$Project=".")
node "$PSScriptRoot/../packages/cli/index.mjs" skills install --host $HostName --project $Project
