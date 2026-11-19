[CmdletBinding(SupportsShouldProcess=$true)]
param([ValidateSet('Enable','Disable','Status')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$ruleName = 'ANTITUDE-School-LAN-Web'
$ruleGroup = 'ANTITUDE school exhibition'
try {
    $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if ($existing -and $existing.Group -ne $ruleGroup) {
        throw 'A different application owns this rule name. No firewall changes were made.'
    }
    if ($Action -eq 'Status') {
        if ($existing) {
            $existing | Select-Object Name,Enabled,Direction,Action
            $existing | Get-NetFirewallPortFilter | Select-Object Protocol,LocalPort
            $existing | Get-NetFirewallAddressFilter | Select-Object RemoteAddress
        } else { Write-Output 'ANTITUDE LAN firewall rule is not installed.' }
        exit 0
    }
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $WhatIfPreference -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Right-click enable-school-lan.bat (or disable-school-lan.bat) and choose Run as administrator.'
    }
    if ($Action -eq 'Disable') {
        if ($existing -and $PSCmdlet.ShouldProcess($ruleName, 'Remove only the ANTITUDE LAN rule')) {
            Remove-NetFirewallRule -Name $ruleName
        }
        if ($WhatIfPreference) { Write-Output 'Preview only. No firewall rule was changed.' }
        else { Write-Output 'The ANTITUDE LAN rule has been removed (or was absent). Other firewall rules are unchanged.' }
        exit 0
    }
    $configText = & node (Join-Path $PSScriptRoot 'exhibition.cjs') network-config
    if ($LASTEXITCODE -ne 0) { throw 'Run setup-exhibition.bat first, then check .env.exhibition.' }
    $config = $configText | ConvertFrom-Json
    if ($config.mode -ne 'lan') { throw 'Set NETWORK_ACCESS=lan and HOST=0.0.0.0 in .env.exhibition first.' }
    if (-not $config.addresses.Count) { throw 'Connect to school Wi-Fi (private IPv4 network) first.' }
    if (-not (Test-Path -LiteralPath $config.nodePath -PathType Leaf)) { throw 'Node.js executable was not found.' }
    $taskPort = [int]$config.port
    if ($taskPort -lt 1024 -or $taskPort -gt 65535) { throw 'Invalid PORT in .env.exhibition.' }
    if ($PSCmdlet.ShouldProcess("TCP $taskPort / Node.js / LocalSubnet", 'Allow ANTITUDE from the same subnet only')) {
        $parameters = @{
            DisplayName = 'ANTITUDE school Wi-Fi web'
            Group = $ruleGroup
            Direction = 'Inbound'
            Action = 'Allow'
            Enabled = 'True'
            Profile = 'Any'
            Protocol = 'TCP'
            LocalPort = $taskPort
            Program = [string]$config.nodePath
            RemoteAddress = 'LocalSubnet'
            EdgeTraversalPolicy = 'Block'
        }
        if ($existing) {
            $parameters.Remove('DisplayName')
            $parameters.Remove('Group')
            Set-NetFirewallRule -Name $ruleName @parameters | Out-Null
        }
        else { New-NetFirewallRule -Name $ruleName @parameters | Out-Null }
    }
    if ($WhatIfPreference) { Write-Output "Preview only: TCP $taskPort for Node.js from LocalSubnet. No firewall changes." }
    else { Write-Output "Configured only TCP $taskPort for Node.js from LocalSubnet. Firewall stays enabled." }
    Write-Output 'No router port forwarding, public tunnel, AI ports, or Ollama ports were opened.'
    foreach ($address in $config.addresses) { Write-Output ($address.name + ': ' + $address.url) }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
